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

  // Streaming playback state
  private streamingCtx: AudioContext | null = null;
  private streamingAbort: AbortController | null = null;
  private isStreamingActive: boolean = false;

  /** Kokoro TTS outputs 24 kHz PCM by default */
  private static readonly STREAMING_SAMPLE_RATE = 24000;

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
  setPitch(_pitch: number): void {
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
   * Speak text with real-time streaming playback.
   *
   * Uses `stream_format='audio'` so Kokoro returns raw **16-bit PCM** at
   * 24 kHz.  Chunks are read from a `fetch()` `ReadableStream` and queued
   * as `AudioBufferSourceNode`s on a `Web Audio API` context so playback
   * begins as soon as the first chunk arrives — no waiting for the whole
   * file.
   *
   * @param text          Text to speak
   * @param onFirstChunk  Optional callback fired when the first audio chunk
   *                      starts playing (useful for UI "speaking" state).
   */
  async speakStreaming(
    text: string,
    onFirstChunk?: () => void,
  ): Promise<void> {
    if (!text.trim()) return;

    // Abort any in-progress stream
    this.stopStreaming();

    const abortCtrl = new AbortController();
    this.streamingAbort = abortCtrl;
    this.isStreamingActive = true;

    const audioCtx = new AudioContext({ sampleRate: TTSService.STREAMING_SAMPLE_RATE });
    this.streamingCtx = audioCtx;

    try {
      const response = await fetch(`${this.baseURL}/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice: this.voice,
          speed: this.speed,
          stream_format: 'audio',   // PCM streaming
        }),
        signal: abortCtrl.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown');
        throw new Error(`TTS streaming request failed (${response.status}): ${errText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('TTS response has no readable body');

      // We schedule AudioBufferSourceNodes end-to-end so there are no gaps.
      let nextStartTime = audioCtx.currentTime;
      let firstChunkFired = false;

      // Remainder buffer: if a chunk has an odd byte count, the trailing
      // byte is the first half of a 16-bit sample.  We save it and prepend
      // it to the next chunk so that Int16 alignment is never broken.
      let remainder: Uint8Array | null = null;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done || !this.isStreamingActive) break;

        // Merge any leftover byte from the previous chunk
        let bytes: Uint8Array;
        if (remainder) {
          bytes = new Uint8Array(remainder.length + value.length);
          bytes.set(remainder, 0);
          bytes.set(value, remainder.length);
          remainder = null;
        } else {
          bytes = value;
        }

        // If odd number of bytes, stash the last one for next iteration
        if (bytes.byteLength % 2 !== 0) {
          remainder = bytes.slice(bytes.byteLength - 1);
          bytes = bytes.slice(0, bytes.byteLength - 1);
        }

        if (bytes.byteLength < 2) continue; // not enough data yet

        // Read as 16-bit LE PCM — copy into a fresh ArrayBuffer so that
        // the Int16Array view is guaranteed to be 2-byte aligned.
        const aligned = new Uint8Array(bytes).buffer;
        const int16 = new Int16Array(aligned);

        // Convert Int16 → Float32 for the Web Audio API
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768;
        }

        // Create an AudioBuffer for this chunk
        const audioBuffer = audioCtx.createBuffer(
          1,
          float32.length,
          TTSService.STREAMING_SAMPLE_RATE,
        );
        audioBuffer.getChannelData(0).set(float32);

        const srcNode = audioCtx.createBufferSource();
        srcNode.buffer = audioBuffer;
        srcNode.connect(audioCtx.destination);

        // Schedule right after the previous chunk ends
        if (nextStartTime < audioCtx.currentTime) {
          nextStartTime = audioCtx.currentTime;
        }
        srcNode.start(nextStartTime);
        nextStartTime += audioBuffer.duration;

        if (!firstChunkFired) {
          firstChunkFired = true;
          onFirstChunk?.();
        }
      }

      // Wait until all scheduled audio finishes playing
      const remaining = nextStartTime - audioCtx.currentTime;
      if (remaining > 0) {
        await new Promise(res => setTimeout(res, remaining * 1000));
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('TTS streaming aborted');
        return;
      }
      console.error('TTS streaming error:', error);
      throw new Error(
        error.message || 'Text-to-speech streaming failed',
      );
    } finally {
      this.isStreamingActive = false;
      if (audioCtx.state !== 'closed') {
        await audioCtx.close().catch(() => {});
      }
      this.streamingCtx = null;
      this.streamingAbort = null;
    }
  }

  /**
   * Stop any in-progress streaming playback.
   */
  stopStreaming(): void {
    this.isStreamingActive = false;
    if (this.streamingAbort) {
      this.streamingAbort.abort();
      this.streamingAbort = null;
    }
    if (this.streamingCtx && this.streamingCtx.state !== 'closed') {
      this.streamingCtx.close().catch(() => {});
      this.streamingCtx = null;
    }
  }

  /**
   * Stop speaking (both non-streaming and streaming)
   */
  stop(): void {
    // Stop non-streaming playback
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    // Stop streaming playback
    this.stopStreaming();
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
   * Check if currently speaking (non-streaming or streaming)
   */
  isSpeaking(): boolean {
    return (this.currentAudio !== null && !this.currentAudio.paused) || this.isStreamingActive;
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
