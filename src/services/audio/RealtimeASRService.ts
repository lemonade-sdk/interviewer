import { EventEmitter } from '../../utils/EventEmitter';

/**
 * RealtimeASRService - Real-time Speech Recognition using Lemonade Server WebSockets
 * Uses the OpenAI-compatible realtime protocol.
 */
export class RealtimeASRService extends EventEmitter {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private model: string;
  private wsUrl: string;
  private isConnected: boolean = false;

  constructor(wsUrl: string, model: string = 'Whisper-Tiny') {
    super();
    this.wsUrl = wsUrl;
    this.model = model;
  }

  /**
   * Start real-time streaming
   */
  async start(stream: MediaStream): Promise<void> {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      try {
        console.log(`Connecting to Realtime ASR at ${this.wsUrl} with model ${this.model}`);
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
   * Stop real-time streaming
   */
  stop(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.stopAudioCapture();
    this.isConnected = false;
  }

  private async setupAudioCapture(stream: MediaStream): Promise<void> {
    try {
      this.stream = stream;
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      // ScriptProcessor is deprecated but widely supported for simple PCM streaming
      // AudioWorklet is preferred but more complex to set up in a single file
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.processor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send as base64 encoded audio delta
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        const event = {
          type: 'input_audio_buffer.append',
          audio: base64Audio
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
    // Do NOT stop the stream tracks here, as the stream is owned by AudioService
    this.stream = null;
  }

  private handleServerEvent(event: any): void {
    // OpenAI Realtime Protocol events
    switch (event.type) {
      case 'conversation.item.input_audio_transcription.delta':
        this.emit('delta', event.delta);
        break;
      case 'conversation.item.input_audio_transcription.completed':
        this.emit('complete', event.transcript);
        break;
      case 'error':
        console.error('Server error:', event.error);
        this.emit('error', new Error(event.error.message || 'Unknown server error'));
        break;
    }
  }
}
