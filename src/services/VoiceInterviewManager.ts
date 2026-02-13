import { EventEmitter } from '../utils/EventEmitter';
import { AudioService } from './audio/AudioService';
import { TTSService } from './audio/TTSService';
import { VADService } from './audio/VADService';
import { RealtimeASRService } from './audio/RealtimeASRService';
import {
  AudioSettings,
  VADConfig,
  ASRConfig,
  DEFAULT_VAD_CONFIG,
  DEFAULT_ASR_CONFIG,
} from '../types';

/**
 * VoiceInterviewManager - Orchestrates all voice-related services
 * Provides a unified interface for voice interview functionality
 *
 * Supports **two ASR transport modes** that are chosen automatically:
 *
 *   1. **WebSocket streaming** (preferred) — requires a lemonade-server build
 *      with WebSocket support (`LEMON_HAS_WEBSOCKET`).  Provides live partial
 *      transcripts while the user speaks.
 *
 *   2. **VAD + HTTP fallback** — works with any lemonade-server that has Whisper
 *      loaded.  VAD detects speech boundaries; recorded audio is sent to
 *      `POST /api/v1/audio/transcriptions` after each utterance.  No partial
 *      results, but latency is minimal (~0.5-2 s after speech ends).
 *
 * The mode is selected automatically based on whether `wsPort` is provided.
 * Both paths emit the same events so the UI code is transport-agnostic.
 * 
 * Events:
 * - recording-started: When recording begins
 * - recording-stopped: When recording ends
 * - transcription-started: When Whisper ASR begins processing (for UI feedback)
 * - transcription-complete: (text: string) When speech is transcribed
 * - transcription-delta: (text: string) Live transcription delta (WebSocket only)
 * - utterance-complete: (text: string) Hands-free mode: user finished speaking (auto-submit)
 * - listening-started: Hands-free mode: now listening for user speech
 * - listening-stopped: Hands-free mode: stopped listening
 * - speaking-started: When TTS starts
 * - speaking-stopped: When TTS ends
 * - audio-level: (level: number) Current audio input level (0-1)
 * - speech-detected: When VAD detects speech
 * - speech-ended: When VAD detects end of speech
 * - error: (error: Error) When any error occurs
 */
export class VoiceInterviewManager extends EventEmitter {
  private audioService: AudioService;
  private ttsService: TTSService;
  private realtimeASR: RealtimeASRService | null = null;
  private vadService: VADService | null = null;
  private isInitialized: boolean = false;
  private isRecording: boolean = false;
  private isSpeaking: boolean = false;
  private currentAudioStream: MediaStream | null = null;
  private wsPort: number | null = null;
  private asrModel: string;
  private asrBaseURL: string;

  // Configs
  private vadConfig: VADConfig;
  private asrConfig: ASRConfig;

  // Hands-free mode state
  private _isHandsFreeMode: boolean = false;
  private isProcessingUtterance: boolean = false;

  // Accumulator for transcript across modes
  private accumulatedTranscript: string = '';
  // Delta accumulator — captures incremental delta text as a fallback
  // when the server never sends a 'complete' event.
  private deltaAccumulator: string = '';

  // HTTP-fallback recording state (used when wsPort is not available)
  private httpMediaRecorder: MediaRecorder | null = null;
  private httpRecordingChunks: Blob[] = [];
  private httpSpeechDetected: boolean = false;

  // ─── Streaming TTS pipeline state ──────────────────────────
  private ttsQueue: string[] = [];
  private isTTSQueueRunning: boolean = false;
  private streamingCancelled: boolean = false;
  /** Abbreviations that should NOT be treated as sentence endings */
  private static readonly ABBREVIATIONS = new Set([
    'dr.', 'mr.', 'mrs.', 'ms.', 'prof.', 'sr.', 'jr.',
    'inc.', 'ltd.', 'corp.', 'vs.', 'etc.', 'approx.',
    'dept.', 'est.', 'vol.', 'i.e.', 'e.g.', 'a.m.', 'p.m.',
  ]);

  constructor(
    audioSettings: AudioSettings,
    asrBaseURL: string = 'http://localhost:8000/api/v1',
    asrModel: string = "Whisper-Base",
    wsPort?: number,
    vadConfig?: Partial<VADConfig>,
    asrConfig?: Partial<ASRConfig>,
  ) {
    super();
    
    this.audioService = new AudioService(audioSettings);
    this.ttsService = new TTSService();
    this.wsPort = wsPort ?? null;
    this.asrModel = asrModel;
    this.asrBaseURL = asrBaseURL;
    this.vadConfig = { ...DEFAULT_VAD_CONFIG, ...vadConfig };
    this.asrConfig = { ...DEFAULT_ASR_CONFIG, ...asrConfig };

    console.log(
      `[VoiceInterviewManager] ASR mode: ${this.wsPort ? 'WebSocket (port ' + this.wsPort + ')' : 'VAD + HTTP fallback (' + this.asrBaseURL + ')'}`,
    );
    
    this.setupEventListeners();
  }

  /**
   * Initialize the manager (must be called before use)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('VoiceInterviewManager already initialized');
      return;
    }

    try {
      // Initialize TTS voices
      await this.ttsService.getVoices();
      await this.ttsService.setVoice('alloy'); // Default to Alloy
      
      this.isInitialized = true;
      console.log('VoiceInterviewManager initialized');
    } catch (error) {
      console.error('Failed to initialize VoiceInterviewManager:', error);
      throw error;
    }
  }

  /**
   * Start real-time streaming (WebSocket)
   */
  async startRealtimeStreaming(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('VoiceInterviewManager not initialized');
    }

    if (this.realtimeASR) {
      console.warn('Realtime streaming already active');
      return;
    }

    if (!this.wsPort) {
      console.error('WebSocket port not provided to VoiceInterviewManager');
      throw new Error('Realtime streaming unavailable: WebSocket port not found');
    }

    try {
      // Get shared stream from AudioService
      const stream = await this.audioService.getStream();
      this.currentAudioStream = stream;

      const wsUrl = `ws://localhost:${this.wsPort}`;
      this.realtimeASR = new RealtimeASRService(wsUrl, this.asrModel, this.asrConfig);

      this.realtimeASR.on('delta', (delta: string) => {
        this.emit('transcription-delta', delta);
      });

      this.realtimeASR.on('complete', (text: string) => {
        this.emit('transcription-complete', text);
      });

      this.realtimeASR.on('error', (error: Error) => {
        this.emit('error', error);
      });

      await this.realtimeASR.start(stream);
      this.isRecording = true;
      this.emit('recording-started');
    } catch (error) {
      console.error('Failed to start realtime streaming:', error);
      throw error;
    }
  }

  /**
   * Stop real-time streaming (graceful by default — waits wsCloseDelayMs for final transcript)
   */
  stopRealtimeStreaming(graceful: boolean = true): void {
    if (this.realtimeASR) {
      this.realtimeASR.stop(graceful);
      this.realtimeASR = null;
      this.isRecording = false;
      this.emit('recording-stopped');
    }
  }

  // ─── Hands-free conversational mode ─────────────────────
  // After AI speaks, automatically listen for user speech via VAD + ASR.
  // When VAD detects end of speech, collects the transcript and emits
  // 'utterance-complete' so the UI can auto-submit it.

  /**
   * Enter hands-free mode.
   * Begins listening immediately; VAD will auto-detect speech boundaries.
   *
   * Automatically selects the best ASR transport:
   *   - WebSocket streaming (if wsPort is available)
   *   - VAD + HTTP fallback (if wsPort is null)
   */
  async startHandsFreeListening(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('VoiceInterviewManager not initialized');
    }
    if (this.isRecording) {
      console.warn('startHandsFreeListening: already recording, skipping');
      return;
    }
    if (this.isProcessingUtterance) {
      console.warn('startHandsFreeListening: still processing previous utterance, skipping');
      return;
    }

    this._isHandsFreeMode = true;

    try {
      const stream = await this.audioService.getStream();
      this.currentAudioStream = stream;

      if (this.wsPort) {
        // ═══ WebSocket streaming mode ═══
        await this.startHandsFreeWebSocket(stream);
      } else {
        // ═══ VAD + HTTP fallback mode ═══
        await this.startHandsFreeHTTP(stream);
      }

      this.isRecording = true;
      this.emit('recording-started');
      this.emit('listening-started');
      console.log(`Hands-free listening started (${this.wsPort ? 'WebSocket' : 'HTTP fallback'})`);
    } catch (error: any) {
      console.error('Failed to start hands-free listening:', error);
      this.isRecording = false;
      this._isHandsFreeMode = false;
      this.emit('error', error);
      throw error;
    }
  }

  // ─── WebSocket hands-free (existing path, refactored into helper) ──

  private async startHandsFreeWebSocket(stream: MediaStream): Promise<void> {
    const wsUrl = `ws://localhost:${this.wsPort}`;
    this.realtimeASR = new RealtimeASRService(wsUrl, this.asrModel, this.asrConfig);
    this.accumulatedTranscript = '';
    this.deltaAccumulator = '';

    this.realtimeASR.on('delta', (delta: string) => {
      // Whisper streaming sends REPLACEMENT deltas (full transcript so far),
      // not incremental fragments. Use assignment, not concatenation.
      this.deltaAccumulator = delta;
      this.emit('transcription-delta', delta);
    });

    this.realtimeASR.on('complete', (text: string) => {
      if (text.trim()) {
        this.accumulatedTranscript += (this.accumulatedTranscript ? ' ' : '') + text.trim();
      }
    });

    this.realtimeASR.on('error', (error: Error) => {
      this.emit('error', error);
    });

    await this.realtimeASR.start(stream);

    // VAD for speech boundary detection
    this.vadService = new VADService(this.vadConfig);

    this.vadService.on('speech-start', () => {
      this.emit('speech-detected');
    });

    this.vadService.on('speech-end', async () => {
      this.emit('speech-ended');
      await this.handleHandsFreeUtteranceEnd();
    });

    await this.vadService.start(stream);
  }

  // ─── HTTP fallback hands-free (VAD + MediaRecorder + POST) ──────

  private async startHandsFreeHTTP(stream: MediaStream): Promise<void> {
    this.accumulatedTranscript = '';
    this.httpSpeechDetected = false;

    // Start recording immediately so we capture speech onset
    this.httpRecordingChunks = [];
    const mimeType = this.getSupportedMimeType();
    this.httpMediaRecorder = new MediaRecorder(stream, { mimeType });

    this.httpMediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.httpRecordingChunks.push(e.data);
      }
    };

    this.httpMediaRecorder.start(100); // collect data every 100ms

    // VAD for speech boundary detection
    this.vadService = new VADService(this.vadConfig);

    this.vadService.on('speech-start', () => {
      this.httpSpeechDetected = true;
      this.emit('speech-detected');
    });

    this.vadService.on('speech-end', async () => {
      this.emit('speech-ended');
      await this.handleHTTPUtteranceEnd();
    });

    await this.vadService.start(stream);
  }

  /**
   * Stop hands-free listening (e.g. when AI starts speaking, or interview ends)
   */
  stopHandsFreeListening(graceful: boolean = false): void {
    if (this.vadService) {
      this.vadService.stop();
      this.vadService = null;
    }
    // WebSocket mode cleanup
    if (this.realtimeASR) {
      this.realtimeASR.stop(graceful);
      this.realtimeASR = null;
    }
    // HTTP fallback mode cleanup
    if (this.httpMediaRecorder && this.httpMediaRecorder.state !== 'inactive') {
      this.httpMediaRecorder.stop();
    }
    this.httpMediaRecorder = null;
    this.httpRecordingChunks = [];
    this.httpSpeechDetected = false;

    if (this.isRecording) {
      this.isRecording = false;
      this.emit('recording-stopped');
      this.emit('listening-stopped');
    }
  }

  /**
   * Exit hands-free mode entirely
   */
  exitHandsFreeMode(): void {
    this._isHandsFreeMode = false;
    this.stopHandsFreeListening(false);
    console.log('Exited hands-free mode');
  }

  /**
   * Whether we are currently in hands-free mode
   */
  get isHandsFreeMode(): boolean {
    return this._isHandsFreeMode;
  }

  /**
   * Internal: called when VAD detects speech-end in hands-free **WebSocket** mode.
   * Stops ASR gracefully, waits for final transcript, emits 'utterance-complete'.
   */
  private async handleHandsFreeUtteranceEnd(): Promise<void> {
    if (this.isProcessingUtterance) return;
    this.isProcessingUtterance = true;

    let shouldResumListening = false;

    try {
      // Stop VAD + ASR (graceful — gives time for final transcript)
      if (this.vadService) {
        this.vadService.stop();
        this.vadService = null;
      }
      if (this.realtimeASR) {
        this.realtimeASR.stop(true); // keeps socket open for wsCloseDelayMs
        this.realtimeASR = null;
      }

      this.isRecording = false;
      this.emit('recording-stopped');
      this.emit('listening-stopped');

      // Wait for final transcript to arrive via the still-open socket
      await new Promise((resolve) => setTimeout(resolve, this.asrConfig.wsCloseDelayMs));

      // Prefer 'complete' event text; fall back to latest delta (replacement)
      let text = this.accumulatedTranscript.trim();
      if (!text) {
        text = this.deltaAccumulator.trim();
        if (text) {
          console.log('Hands-free: using delta text (no complete event received)');
        }
      }
      this.accumulatedTranscript = '';
      this.deltaAccumulator = '';

      // Clean Whisper artifacts (e.g. [BLANK_AUDIO])
      text = this.cleanTranscript(text);

      if (text) {
        console.log('Hands-free utterance complete (WebSocket):', text);
        this.emit('utterance-complete', text);
      } else {
        console.log('Hands-free: no speech detected, resuming listening');
        shouldResumListening = true;
      }
    } catch (error: any) {
      console.error('Error handling hands-free utterance end:', error);
      this.emit('error', error);
      shouldResumListening = true;
    } finally {
      // MUST clear processing flag BEFORE attempting to restart listening
      // to avoid the "still processing previous utterance" guard in startHandsFreeListening
      this.isProcessingUtterance = false;
    }

    // Restart listening outside the try/finally so isProcessingUtterance is already false
    if (shouldResumListening && this._isHandsFreeMode) {
      try {
        await this.startHandsFreeListening();
      } catch (error) {
        console.error('Failed to resume hands-free listening:', error);
      }
    }
  }

  /**
   * Internal: called when VAD detects speech-end in hands-free **HTTP fallback** mode.
   * Stops recording, sends audio to Whisper HTTP endpoint, emits 'utterance-complete'.
   */
  private async handleHTTPUtteranceEnd(): Promise<void> {
    if (this.isProcessingUtterance) return;
    this.isProcessingUtterance = true;

    try {
      // If VAD never fired speech-start (e.g. only noise), skip transcription
      if (!this.httpSpeechDetected) {
        console.log('HTTP fallback: speech-end but no speech was detected, resuming');
        this.isProcessingUtterance = false;
        return;
      }

      // Stop VAD
      if (this.vadService) {
        this.vadService.stop();
        this.vadService = null;
      }

      // Stop MediaRecorder and collect the audio blob
      const audioBlob = await this.stopHTTPRecording();

      this.isRecording = false;
      this.emit('recording-stopped');
      this.emit('listening-stopped');

      if (!audioBlob || audioBlob.size === 0) {
        console.log('HTTP fallback: empty audio blob, resuming');
        if (this._isHandsFreeMode) {
          await this.startHandsFreeListening();
        }
        return;
      }

      // Send to Whisper HTTP endpoint
      this.emit('transcription-started');
      console.log(`HTTP fallback: transcribing ${audioBlob.size} bytes of audio...`);
      const rawText = await this.transcribeAudioHTTP(audioBlob);
      const text = this.cleanTranscript(rawText);
      this.emit('transcription-complete', text);

      if (text) {
        console.log('Hands-free utterance complete (HTTP):', text);
        this.emit('utterance-complete', text);
      } else {
        console.log('HTTP fallback: Whisper returned empty transcript, resuming');
        if (this._isHandsFreeMode) {
          await this.startHandsFreeListening();
        }
      }
    } catch (error: any) {
      console.error('Error handling HTTP utterance end:', error);
      this.emit('error', error);
      // Try to resume listening even after error
      if (this._isHandsFreeMode) {
        try { await this.startHandsFreeListening(); } catch { /* give up */ }
      }
    } finally {
      this.isProcessingUtterance = false;
    }
  }

  /**
   * Stop the HTTP-fallback MediaRecorder and return the audio blob.
   */
  private stopHTTPRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.httpMediaRecorder || this.httpMediaRecorder.state === 'inactive') {
        resolve(this.httpRecordingChunks.length > 0
          ? new Blob(this.httpRecordingChunks, { type: this.httpRecordingChunks[0]?.type || 'audio/webm' })
          : null);
        this.httpRecordingChunks = [];
        return;
      }

      this.httpMediaRecorder.onstop = () => {
        const blob = new Blob(this.httpRecordingChunks, {
          type: this.httpMediaRecorder?.mimeType || 'audio/webm',
        });
        this.httpRecordingChunks = [];
        this.httpMediaRecorder = null;
        resolve(blob);
      };

      this.httpMediaRecorder.stop();
    });
  }

  /**
   * Send an audio blob to the Whisper HTTP transcription endpoint.
   * POST /api/v1/audio/transcriptions  (OpenAI-compatible)
   *
   * Lemonade Server only accepts WAV format, so we convert the browser's
   * webm/opus recording to 16-bit PCM WAV (16 kHz mono) before sending.
   */
  private async transcribeAudioHTTP(audioBlob: Blob): Promise<string> {
    // Convert webm → WAV (Lemonade Server only accepts wav)
    const wavBlob = await this.convertBlobToWav(audioBlob);

    const formData = new FormData();
    formData.append('file', wavBlob, 'audio.wav');
    formData.append('model', this.asrModel);

    const response = await fetch(`${this.asrBaseURL}/audio/transcriptions`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      throw new Error(`Whisper HTTP transcription failed (${response.status}): ${errText}`);
    }

    const result = await response.json();
    return result.text ?? '';
  }

  /**
   * Convert an audio Blob (webm/opus, mp4, ogg, etc.) to a 16-bit PCM WAV
   * at 16 kHz mono — the format expected by Whisper / Lemonade Server.
   *
   * Uses the Web Audio API's OfflineAudioContext for decoding and resampling.
   */
  private async convertBlobToWav(blob: Blob): Promise<Blob> {
    const TARGET_SAMPLE_RATE = 16000;

    // 1. Decode the compressed audio into raw PCM samples
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();

    // 2. Resample to 16 kHz mono using OfflineAudioContext
    // Guard: OfflineAudioContext requires length > 0
    const numFrames = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, numFrames, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();

    // 3. Encode as 16-bit PCM WAV
    const samples = rendered.getChannelData(0);
    const wavBuffer = this.encodeWav(samples, TARGET_SAMPLE_RATE);

    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  /**
   * Encode Float32 PCM samples into a 16-bit WAV file (mono).
   */
  private encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const numSamples = samples.length;
    const bytesPerSample = 2; // 16-bit
    const dataSize = numSamples * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);           // sub-chunk size
    view.setUint16(20, 1, true);            // PCM format
    view.setUint16(22, 1, true);            // mono
    view.setUint32(24, sampleRate, true);   // sample rate
    view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
    view.setUint16(32, bytesPerSample, true); // block align
    view.setUint16(34, 16, true);           // bits per sample

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM samples (clamp Float32 → Int16)
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return buffer;
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /**
   * Resume hands-free listening (called after AI finishes speaking)
   */
  async resumeHandsFreeListening(): Promise<void> {
    if (!this._isHandsFreeMode) return;
    if (this.isRecording || this.isSpeaking) return;
    await this.startHandsFreeListening();
  }

  /**
   * Start voice input (Tap to Speak)
   * Uses WebSocket streaming when available, HTTP fallback otherwise.
   */
  async startVoiceInput(options?: {
    deviceId?: string;
    enableVAD?: boolean;
    vadSensitivity?: number;
  }): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('VoiceInterviewManager not initialized. Call initialize() first.');
    }

    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      // Get shared stream
      const stream = await this.audioService.getStream(options?.deviceId);
      this.currentAudioStream = stream;

      if (this.wsPort) {
        // ═══ WebSocket mode ═══
        const wsUrl = `ws://localhost:${this.wsPort}`;
        this.realtimeASR = new RealtimeASRService(wsUrl, this.asrModel, this.asrConfig);
        this.accumulatedTranscript = '';
        this.deltaAccumulator = '';

        this.realtimeASR.on('delta', (delta: string) => {
          // Whisper streaming sends REPLACEMENT deltas — use assignment, not concatenation
          this.deltaAccumulator = delta;
          this.emit('transcription-delta', delta);
        });

        this.realtimeASR.on('complete', (text: string) => {
          if (text.trim()) {
            this.accumulatedTranscript += (this.accumulatedTranscript ? ' ' : '') + text.trim();
          }
        });

        this.realtimeASR.on('error', (error: Error) => {
          this.emit('error', error);
        });

        await this.realtimeASR.start(stream);
      } else {
        // ═══ HTTP fallback mode ═══
        this.httpRecordingChunks = [];
        const mimeType = this.getSupportedMimeType();
        this.httpMediaRecorder = new MediaRecorder(stream, { mimeType });

        this.httpMediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            this.httpRecordingChunks.push(e.data);
          }
        };

        this.httpMediaRecorder.start(100);
      }

      this.isRecording = true;
      this.emit('recording-started');

      // Enable VAD if requested
      if (options?.enableVAD) {
        const vadCfg = { ...this.vadConfig };
        if (options.vadSensitivity !== undefined) {
          vadCfg.energyThreshold =
            0.005 + (1 - Math.max(0, Math.min(1, options.vadSensitivity))) * 0.095;
        }
        this.vadService = new VADService(vadCfg);
        
        this.vadService.on('speech-start', () => {
          this.emit('speech-detected');
        });
        
        this.vadService.on('speech-end', () => {
          this.emit('speech-ended');
        });

        await this.vadService.start(stream);
      }

      console.log(`Voice input started (Tap to Speak — ${this.wsPort ? 'WebSocket' : 'HTTP fallback'})`);
    } catch (error: any) {
      this.isRecording = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop voice input and get transcription
   */
  async stopVoiceInput(): Promise<string> {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }

    try {
      // Stop VAD if running
      if (this.vadService) {
        this.vadService.stop();
        this.vadService = null;
      }

      let text = '';

      if (this.realtimeASR) {
        // ═══ WebSocket mode ═══
        this.realtimeASR.stop(true); // graceful: waits wsCloseDelayMs
        this.realtimeASR = null;

        this.isRecording = false;
        this.emit('recording-stopped');

        // Wait for the WS close delay so the final transcript can arrive
        await new Promise((resolve) => setTimeout(resolve, this.asrConfig.wsCloseDelayMs));
        // Prefer 'complete' event text; fall back to latest delta (replacement)
        text = this.cleanTranscript(this.accumulatedTranscript.trim() || this.deltaAccumulator.trim());
        this.deltaAccumulator = '';
      } else if (this.httpMediaRecorder) {
        // ═══ HTTP fallback mode ═══
        const audioBlob = await this.stopHTTPRecording();

        this.isRecording = false;
        this.emit('recording-stopped');

        if (audioBlob && audioBlob.size > 0) {
          this.emit('transcription-started');
          text = await this.transcribeAudioHTTP(audioBlob);
        }
      } else {
        this.isRecording = false;
        this.emit('recording-stopped');
      }

      this.emit('transcription-complete', text);
      console.log('Transcription (Tap to Speak):', text);

      return text;
    } catch (error: any) {
      this.isRecording = false;
      this.emit('transcription-complete', '');
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Speak text using TTS.
   *
   * Attempts **streaming playback** first (starts audio as soon as the first
   * PCM chunk arrives from Kokoro).  If the streaming request fails, falls
   * back to the non-streaming endpoint which downloads the full audio file
   * before playing.
   */
  async speak(text: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('VoiceInterviewManager not initialized');
    }

    if (this.isSpeaking) {
      console.warn('Already speaking, stopping previous speech');
      this.ttsService.stop();
    }

    try {
      this.isSpeaking = true;
      this.emit('speaking-started');

      // Try streaming first for faster time-to-first-audio
      try {
        await this.ttsService.speakStreaming(text, () => {
          console.log('TTS streaming: first chunk playing');
        });
      } catch (streamErr: any) {
        console.warn('TTS streaming failed, falling back to non-streaming:', streamErr.message);
        await this.ttsService.speak(text);
      }

      this.isSpeaking = false;
      this.emit('speaking-stopped');
    } catch (error: any) {
      this.isSpeaking = false;
      this.emit('speaking-stopped');
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop speaking
   */
  stopSpeaking(): void {
    this.ttsService.stop();
    this.streamingCancelled = true;
    this.ttsQueue = [];
    this.isTTSQueueRunning = false;
    this.isSpeaking = false;
    this.emit('speaking-stopped');
  }

  // ═══════════════════════════════════════════════════════════════
  //  LLM Streaming → Sentence Chunker → TTS Pipeline
  // ═══════════════════════════════════════════════════════════════

  /**
   * Feed a single LLM token into the sentence chunker.
   *
   * Call this from the renderer's `onLLMToken` listener.  When a
   * sentence boundary is detected, the sentence is flushed to the
   * TTS queue and playback starts immediately (if not already running).
   */
  feedToken(token: string): void {
    this.sentenceBuffer += token;

    // Check if the buffer contains a sentence boundary
    const flushed = this.tryFlushSentence();
    if (flushed) {
      this.enqueueTTS(flushed);
    }
  }

  /**
   * Signal that the LLM stream has ended.  Flush any remaining text
   * in the sentence buffer to TTS.
   */
  flushRemainingText(): void {
    const remaining = this.sentenceBuffer.trim();
    this.sentenceBuffer = '';
    if (remaining.length > 0) {
      this.enqueueTTS(remaining);
    }
  }

  /**
   * Prepare the streaming pipeline for a new response.
   * Call BEFORE starting to feed tokens.
   */
  startStreamingPipeline(): void {
    this.sentenceBuffer = '';
    this.ttsQueue = [];
    this.isTTSQueueRunning = false;
    this.streamingCancelled = false;
    this.isSpeaking = true;
    this.emit('speaking-started');
  }

  /**
   * Wait until the TTS queue has finished playing all queued sentences.
   * Resolves when the queue is empty and the last sentence has finished.
   */
  waitForTTSQueueDrain(): Promise<void> {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!this.isTTSQueueRunning && this.ttsQueue.length === 0) {
          this.isSpeaking = false;
          this.emit('speaking-stopped');
          resolve();
        } else if (this.streamingCancelled) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // ─── Internal sentence chunker ─────────────────────────────

  private sentenceBuffer: string = '';

  /**
   * Try to extract a complete sentence from the buffer.
   *
   * Returns the sentence text if a boundary was found, or `null`.
   * The buffer is updated to contain only the unconsumed remainder.
   */
  private tryFlushSentence(): string | null {
    const buf = this.sentenceBuffer;

    // Look for sentence-ending punctuation followed by whitespace
    // (or end-of-buffer if buffer is long enough)
    const boundaryRe = /([.!?])\s/g;
    let match: RegExpExecArray | null;
    let lastValidEnd = -1;

    while ((match = boundaryRe.exec(buf)) !== null) {
      const endPos = match.index + 1; // position right after the punctuation
      const candidate = buf.slice(0, endPos).trim();

      // Skip abbreviations (e.g. "Dr. " should not split)
      if (this.isAbbreviation(candidate)) continue;

      // Minimum sentence length to avoid flushing tiny fragments
      if (candidate.length >= 15) {
        lastValidEnd = endPos;
        break; // flush eagerly on the first valid boundary
      }
    }

    // Also flush on newlines (paragraph breaks) if buffer has content
    if (lastValidEnd === -1) {
      const nlPos = buf.indexOf('\n');
      if (nlPos > 0 && buf.slice(0, nlPos).trim().length >= 10) {
        lastValidEnd = nlPos;
      }
    }

    // For very long buffers without punctuation, flush at a comma
    if (lastValidEnd === -1 && buf.length > 120) {
      const commaPos = buf.lastIndexOf(', ');
      if (commaPos > 30) {
        lastValidEnd = commaPos + 1; // include the comma
      }
    }

    if (lastValidEnd === -1) return null;

    const sentence = buf.slice(0, lastValidEnd).trim();
    this.sentenceBuffer = buf.slice(lastValidEnd).trimStart();
    return sentence;
  }

  private isAbbreviation(text: string): boolean {
    const lower = text.toLowerCase();
    for (const abbr of VoiceInterviewManager.ABBREVIATIONS) {
      if (lower.endsWith(abbr)) return true;
    }
    return false;
  }

  // ─── Internal TTS queue processor ──────────────────────────

  private enqueueTTS(sentence: string): void {
    this.ttsQueue.push(sentence);
    if (!this.isTTSQueueRunning) {
      this.processTTSQueue();
    }
  }

  private async processTTSQueue(): Promise<void> {
    if (this.isTTSQueueRunning) return;
    this.isTTSQueueRunning = true;

    while (this.ttsQueue.length > 0 && !this.streamingCancelled) {
      const sentence = this.ttsQueue.shift()!;
      try {
        // Use streaming TTS with fallback — same as speak()
        try {
          await this.ttsService.speakStreaming(sentence);
        } catch {
          await this.ttsService.speak(sentence);
        }
      } catch (error) {
        console.error('TTS queue: failed to speak sentence:', error);
        // Continue with next sentence rather than stopping entirely
      }
    }

    this.isTTSQueueRunning = false;
  }

  /**
   * Update audio settings
   */
  updateAudioSettings(settings: Partial<AudioSettings>): void {
    this.audioService.updateSettings(settings);
  }

  /**
   * Update TTS settings
   */
  updateTTSSettings(settings: {
    voice?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
  }): void {
    if (settings.voice) {
      this.ttsService.setVoice(settings.voice);
    }
    if (settings.rate !== undefined) {
      this.ttsService.setRate(settings.rate);
    }
    if (settings.pitch !== undefined) {
      this.ttsService.setPitch(settings.pitch);
    }
    if (settings.volume !== undefined) {
      this.ttsService.setVolume(settings.volume);
    }
  }

  /**
   * Update VAD sensitivity (convenience wrapper)
   */
  updateVADSensitivity(sensitivity: number): void {
    if (this.vadService) {
      this.vadService.setSensitivity(sensitivity);
    }
  }

  /**
   * Update VAD config at runtime
   */
  updateVADConfig(partial: Partial<VADConfig>): void {
    this.vadConfig = { ...this.vadConfig, ...partial };
    if (this.vadService) {
      this.vadService.updateConfig(partial);
    }
  }

  /**
   * Update ASR config at runtime (takes effect on next session)
   */
  updateASRConfig(partial: Partial<ASRConfig>): void {
    this.asrConfig = { ...this.asrConfig, ...partial };
  }

  /**
   * Get the current VAD + ASR configs
   */
  getConfigs(): { vad: VADConfig; asr: ASRConfig } {
    return {
      vad: { ...this.vadConfig },
      asr: { ...this.asrConfig },
    };
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices() {
    return this.audioService.getAudioDevices();
  }

  /**
   * Get available TTS voices
   */
  async getTTSVoices() {
    return this.ttsService.getVoices();
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      isRecording: this.isRecording,
      isSpeaking: this.isSpeaking,
      isHandsFreeMode: this._isHandsFreeMode,
    };
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Exit hands-free mode
    this._isHandsFreeMode = false;
    this.isProcessingUtterance = false;

    // Stop any ongoing operations
    if (this.vadService) {
      this.vadService.stop();
      this.vadService = null;
    }

    if (this.realtimeASR) {
      this.realtimeASR.stop(false);
      this.realtimeASR = null;
    }

    // HTTP fallback cleanup
    if (this.httpMediaRecorder && this.httpMediaRecorder.state !== 'inactive') {
      this.httpMediaRecorder.stop();
    }
    this.httpMediaRecorder = null;
    this.httpRecordingChunks = [];
    this.httpSpeechDetected = false;
    this.deltaAccumulator = '';
    this.accumulatedTranscript = '';

    if (this.isSpeaking) {
      this.ttsService.stop();
    }

    if (this.currentAudioStream) {
      this.currentAudioStream.getTracks().forEach(track => track.stop());
      this.currentAudioStream = null;
    }

    // Clean up services
    this.audioService.cleanup();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    this.isInitialized = false;
    this.isRecording = false;
    this.isSpeaking = false;

    console.log('VoiceInterviewManager cleaned up');
  }

  // ─── Helpers ─────────────────────────────────────────────

  /**
   * Clean Whisper transcription artifacts from text.
   * Removes tokens like [BLANK_AUDIO], (silence), etc. that Whisper
   * sometimes emits, and collapses leftover whitespace.
   */
  private cleanTranscript(text: string): string {
    return text
      .replace(/\[BLANK_AUDIO\]/gi, '')
      .replace(/\(silence\)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Get a supported MediaRecorder MIME type.
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }

  /**
   * Setup event listeners to forward service events
   */
  private setupEventListeners(): void {
    // Forward audio service events
    this.audioService.on('recording-started', () => {
      this.emit('recording-started');
    });

    this.audioService.on('recording-stopped', () => {
      this.emit('recording-stopped');
    });

    this.audioService.on('audio-level', (level: number) => {
      this.emit('audio-level', level);
    });

    this.audioService.on('playback-started', () => {
      this.emit('playback-started');
    });

    this.audioService.on('playback-complete', () => {
      this.emit('playback-complete');
    });
  }
}
