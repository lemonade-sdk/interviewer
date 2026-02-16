import { EventEmitter } from '../../utils/EventEmitter';
import { ASRConfig, DEFAULT_ASR_CONFIG } from '../../types';

/**
 * RealtimeASRService - Real-time Speech Recognition using Lemonade Server WebSockets
 * Uses the OpenAI-compatible realtime protocol.
 *
 * Tunable parameters (via ASRConfig):
 *   bufferSize        – ScriptProcessor buffer size (samples). Default: 4096
 *   targetSampleRate  – Audio context sample rate (Hz). Default: 16000
 *   wsCloseDelayMs    – Delay before closing the socket after stop(). Default: 3000
 */
export class RealtimeASRService extends EventEmitter {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private model: string;
  private wsUrl: string;
  private isConnected: boolean = false;
  private config: ASRConfig;

  /** Circuit breaker: consecutive empty transcripts received from server */
  private consecutiveEmptyTranscripts: number = 0;
  private static readonly MAX_EMPTY_TRANSCRIPTS = 5;
  private circuitBroken: boolean = false;

  constructor(wsUrl: string, model: string = 'Whisper-Tiny', config?: Partial<ASRConfig>) {
    super();
    this.wsUrl = wsUrl;
    this.model = model;
    this.config = { ...DEFAULT_ASR_CONFIG, ...config };
  }

  /**
   * Start real-time streaming
   */
  async start(stream: MediaStream): Promise<void> {
    if (this.isConnected) return;

    // Reset circuit breaker state
    this.consecutiveEmptyTranscripts = 0;
    this.circuitBroken = false;

    return new Promise((resolve, reject) => {
      try {
        console.log(
          `Connecting to Realtime ASR at ${this.wsUrl} with model ${this.model}`,
          this.config,
        );
        this.socket = new WebSocket(`${this.wsUrl}/realtime?model=${this.model}`);

        this.socket.onopen = async () => {
          this.isConnected = true;
          console.log('Realtime ASR WebSocket connected');
          await this.setupAudioCapture(stream);
          this.emit('connected');
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleServerEvent(data);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.socket.onerror = (error) => {
          console.error('Realtime ASR WebSocket error:', error);
          this.emit('error', new Error('WebSocket connection failed'));
          reject(error);
        };

        this.socket.onclose = () => {
          this.isConnected = false;
          console.log('Realtime ASR WebSocket closed');
          this.stopAudioCapture();
          this.emit('disconnected');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop real-time streaming.
   *
   * If `graceful` is true (default), audio capture stops immediately but the
   * WebSocket stays open for `wsCloseDelayMs` to receive any final transcript.
   * Set `graceful = false` for an immediate hard close.
   */
  stop(graceful: boolean = true): void {
    // Always stop capturing audio immediately
    this.stopAudioCapture();

    if (!this.socket) {
      this.isConnected = false;
      return;
    }

    if (graceful && this.config.wsCloseDelayMs > 0) {
      // Keep the socket open briefly to receive the final transcript
      const sock = this.socket;
      this.socket = null; // prevent double-close
      setTimeout(() => {
        try {
          sock.close();
        } catch { /* already closed */ }
      }, this.config.wsCloseDelayMs);
    } else {
      this.socket.close();
      this.socket = null;
    }

    this.isConnected = false;
  }

  /**
   * Get the active config
   */
  getConfig(): ASRConfig {
    return { ...this.config };
  }

  // ────────────────────────────────────────────────────────
  // Audio capture
  // ────────────────────────────────────────────────────────

  private async setupAudioCapture(stream: MediaStream): Promise<void> {
    try {
      this.stream = stream;

      // Use native sample rate to avoid Chromium silence bug when requesting
      // non-native rates with ScriptProcessorNode. Downsample to targetSampleRate
      // in the onaudioprocess callback instead.
      this.audioContext = new AudioContext();
      const nativeSR = this.audioContext.sampleRate;
      const targetSR = this.config.targetSampleRate;
      const source = this.audioContext.createMediaStreamSource(this.stream);

      this.processor = this.audioContext.createScriptProcessor(this.config.bufferSize, 1, 1);

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.processor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        if (this.circuitBroken) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Downsample from native rate to target rate (e.g. 48000 → 16000)
        const ratio = nativeSR / targetSR;
        const downLen = Math.floor(inputData.length / ratio);
        const pcmData = new Int16Array(downLen);
        for (let i = 0; i < downLen; i++) {
          const srcIdx = Math.floor(i * ratio);
          const s = Math.max(-1, Math.min(1, inputData[srcIdx]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send as base64-encoded audio delta
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));

        const event = {
          type: 'input_audio_buffer.append',
          audio: base64Audio,
        };

        this.socket.send(JSON.stringify(event));
      };
    } catch (error) {
      console.error('Failed to setup audio capture:', error);
      throw error;
    }
  }

  private stopAudioCapture(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    // Do NOT stop stream tracks — the stream is owned by AudioService
    this.stream = null;
  }

  // ────────────────────────────────────────────────────────
  // Server events
  // ────────────────────────────────────────────────────────

  private handleServerEvent(event: any): void {
    switch (event.type) {
      case 'conversation.item.input_audio_transcription.delta':
        this.emit('delta', event.delta);
        break;
      case 'conversation.item.input_audio_transcription.completed': {
        const text = event.transcript || '';
        this.emit('complete', text);

        // Circuit breaker: detect loop of empty/silence responses
        const isBasicallyEmpty = !text.trim() || 
          text.includes('[BLANK_AUDIO]') || 
          text.includes('(silence)');

        if (isBasicallyEmpty) {
          this.consecutiveEmptyTranscripts++;
          if (this.consecutiveEmptyTranscripts >= RealtimeASRService.MAX_EMPTY_TRANSCRIPTS) {
            console.warn('RealtimeASRService: Circuit breaker tripped (too many empty transcripts). Stopping audio capture.');
            this.circuitBroken = true;
            this.stopAudioCapture(); // Stop sending audio but keep socket open
            this.emit('error', new Error('No speech detected for too long. Please try again.'));
          }
        } else {
          this.consecutiveEmptyTranscripts = 0;
        }
        break;
      }
      case 'error':
        console.error('Server error:', event.error);
        this.emit('error', new Error(event.error?.message || 'Unknown server error'));
        break;
    }
  }
}
