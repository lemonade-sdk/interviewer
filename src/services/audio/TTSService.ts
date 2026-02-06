import axios from 'axios';

/**
 * TTSService - Text-to-Speech using Lemonade Server
 * Uses Kokoros backend via /api/v1/audio/speech endpoint
 * 
 * Per Lemonade Server spec:
 * - Endpoint: POST /api/v1/audio/speech
 * - Model: kokoro-v1 (only supported model)
 * - Response formats: mp3, wav, opus, pcm
 * - Streaming: Supported with stream_format='audio' (outputs PCM)
 * - Voices: OpenAI voices (alloy, echo, fable, onyx, nova, shimmer) 
 *           or Kokoro voices (af_sky, am_echo, etc.)
 */
export class TTSService {
  private baseURL: string;
  private model: string = 'kokoro-v1';
  private voice: string = 'shimmer'; // Default voice
  private speed: number = 1.0;
  private responseFormat: 'mp3' | 'wav' | 'opus' | 'pcm' = 'mp3';
  private currentAudio: HTMLAudioElement | null = null;

  constructor(baseURL: string = 'http://localhost:8000/api/v1') {
    this.baseURL = baseURL;
  }

  /**
   * Get available voices
   * Returns both OpenAI-compatible and Kokoro-specific voices
   */
  async getVoices(): Promise<Array<{ id: string; name: string; type: string }>> {
    return [
      // OpenAI-compatible voices
      { id: 'alloy', name: 'Alloy', type: 'openai' },
      { id: 'echo', name: 'Echo', type: 'openai' },
      { id: 'fable', name: 'Fable', type: 'openai' },
      { id: 'onyx', name: 'Onyx', type: 'openai' },
      { id: 'nova', name: 'Nova', type: 'openai' },
      { id: 'shimmer', name: 'Shimmer', type: 'openai' },
      // Kokoro-specific voices (examples - actual voices may vary)
      { id: 'af_sky', name: 'AF Sky', type: 'kokoro' },
      { id: 'am_echo', name: 'AM Echo', type: 'kokoro' },
    ];
  }

  /**
   * Set voice by ID
   */
  async setVoice(voiceId: string): Promise<void> {
    this.voice = voiceId;
  }

  /**
   * Set pitch (0.5 - 2.0)
   */
  setPitch(pitch: number): void {
    // Kokoro doesn't support pitch adjustment natively yet, 
    // but we can store it for future use or client-side processing
    console.log('Pitch adjustment not supported by backend yet');
  }

  /**
   * Set volume (0.0 - 1.0)
   */
  setVolume(volume: number): void {
    if (this.currentAudio) {
      this.currentAudio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Speak text using Lemonade Server TTS
   * Per spec: POST /api/v1/audio/speech
   */
  async speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      (async () => {
        if (!text.trim()) {
          resolve();
          return;
        }

        try {
          // Stop any currently playing audio
          this.stop();

          // Per spec: POST /api/v1/audio/speech with input, model, voice, speed, response_format
          const response = await axios.post(
            `${this.baseURL}/audio/speech`,
            {
              model: this.model,           // kokoro-v1
              input: text,                 // Text to speak
              voice: this.voice,           // Voice selection
              speed: this.speed,           // Speaking speed (default 1.0)
              response_format: this.responseFormat, // mp3, wav, opus, or pcm
            },
            {
              responseType: 'arraybuffer', // Receive binary audio data
            timeout: 30000,              // 30 seconds timeout
          }
        );

        // Create audio from response
        const audioBlob = new Blob([response.data], { 
          type: this.getAudioMimeType() 
        });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Play audio
        this.currentAudio = new Audio(audioUrl);
        
        this.currentAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          resolve();
        };

        this.currentAudio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          console.error('TTS playback error:', error);
          reject(new Error('Text-to-speech playback failed'));
        };

        await this.currentAudio.play();
      } catch (error: any) {
        console.error('TTS generation error:', error);
        
        if (error.code === 'ECONNREFUSED') {
          reject(new Error('Cannot connect to Lemonade Server. Please ensure it is running at ' + this.baseURL.replace('/api/v1', '')));
        } else if (error.response?.status === 400) {
          reject(new Error('Invalid TTS request. Check model and voice settings.'));
        } else {
          reject(new Error(error.response?.data?.error?.message || error.message || 'Text-to-speech failed'));
        }
      }
      })();
    });
  }

  /**
   * Speak text with streaming (PCM format)
   * Per spec: stream_format='audio' outputs PCM audio stream
   * Note: This requires more complex audio handling and is optional
   */
  async speakStreaming(text: string, onChunk?: (chunk: ArrayBuffer) => void): Promise<void> {
    try {
      const response = await axios.post(
        `${this.baseURL}/audio/speech`,
        {
          model: this.model,
          input: text,
          voice: this.voice,
          speed: this.speed,
          stream_format: 'audio', // Enable streaming (outputs PCM)
        },
        {
          responseType: 'stream',
          timeout: 30000,
        }
      );

      // Handle streaming response
      // This is a placeholder - full implementation would require PCM audio handling
      response.data.on('data', (chunk: Buffer) => {
          if (onChunk) {
          onChunk(chunk.buffer as ArrayBuffer);
        }
      });

      return new Promise((resolve, reject) => {
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });
    } catch (error) {
      console.error('TTS streaming error:', error);
      throw new Error('Text-to-speech streaming failed');
    }
  }

  /**
   * Stop speaking
   */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  /**
   * Pause speaking
   */
  pause(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  /**
   * Resume speaking
   */
  resume(): void {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play();
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }

  /**
   * Set speech rate/speed (0.1 - 10)
   * Per spec: 'speed' parameter, default is 1.0
   */
  setRate(speed: number): void {
    this.speed = Math.max(0.1, Math.min(10, speed));
  }

  /**
   * Set response format
   * Per spec: mp3, wav, opus, pcm
   */
  setFormat(format: 'mp3' | 'wav' | 'opus' | 'pcm'): void {
    this.responseFormat = format;
  }

  /**
   * Get current voice
   */
  getVoice(): string {
    return this.voice;
  }

  /**
   * Get current speed
   */
  getSpeed(): number {
    return this.speed;
  }

  /**
   * Get MIME type for audio format
   */
  private getAudioMimeType(): string {
    switch (this.responseFormat) {
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'opus':
        return 'audio/opus';
      case 'pcm':
        return 'audio/pcm';
      default:
        return 'audio/mpeg';
    }
  }

  /**
   * Test TTS connection and functionality
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseURL}/audio/speech`,
        {
          model: this.model,
          input: 'Test',
          voice: this.voice,
          response_format: 'mp3',
        },
        {
          responseType: 'arraybuffer',
          timeout: 10000,
        }
      );
      
      return response.status === 200 && response.data.byteLength > 0;
    } catch (error) {
      console.error('TTS connection test failed:', error);
      return false;
    }
  }
}
