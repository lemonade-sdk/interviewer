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
  private speed: number = 1.6; // Slightly faster conversational pace
  private responseFormat: 'mp3' | 'wav' | 'opus' | 'pcm' = 'mp3';
  private currentAudio: HTMLAudioElement | null = null;

  // Streaming playback state
  private streamingCtx: AudioContext | null = null;
  private streamingAbort: AbortController | null = null;
  private isStreamingActive: boolean = false;

  /** Kokoro TTS outputs 24 kHz PCM by default */
  private static readonly STREAMING_SAMPLE_RATE = 24000;

  // ─── Pipeline mode: shared AudioContext across sentences ───
  // When active, speakStreaming() reuses the same AudioContext and
  // nextStartTime so sentences chain with ZERO gap between them.
  private pipelineCtx: AudioContext | null = null;
  private pipelineNextStartTime: number = 0;
  private pipelineActive: boolean = false;

  constructor(baseURL: string = 'http://localhost:8000/api/v1') {
    this.baseURL = baseURL;
  }

  // ═══ Pipeline mode API ══════════════════════════════════════

  /**
   * Open a TTS pipeline.
   *
   * While the pipeline is open, consecutive `speakStreaming()` calls
   * share **one AudioContext** and a continuous `nextStartTime` timeline,
   * eliminating the silence gap between sentences.
   */
  async openPipeline(): Promise<void> {
    await this.closePipeline();
    this.pipelineCtx = new AudioContext({ sampleRate: TTSService.STREAMING_SAMPLE_RATE });
    this.pipelineNextStartTime = this.pipelineCtx.currentTime;
    this.pipelineActive = true;
  }

  /**
   * Close the pipeline.  Waits for any remaining scheduled audio to
   * finish, then tears down the shared AudioContext.
   */
  async closePipeline(): Promise<void> {
    console.log('[DEBUG:TTSService] closePipeline() called', { pipelineActive: this.pipelineActive, hasCtx: !!this.pipelineCtx });
    this.pipelineActive = false;
    const ctx = this.pipelineCtx;
    const nextStart = this.pipelineNextStartTime;
    if (ctx) {
      // Clear instance references immediately to prevent race conditions
      this.pipelineCtx = null;
      this.pipelineNextStartTime = 0;
      
      // Wait for remaining scheduled audio
      const remaining = nextStart - ctx.currentTime;
      console.log('[DEBUG:TTSService] closePipeline() waiting for remaining audio', { remaining });
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining * 1000));
      }
      if (ctx.state !== 'closed') {
        console.log('[DEBUG:TTSService] closePipeline() closing AudioContext');
        await ctx.close().catch(() => {});
      }
    }
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
   * Get recommended voice for gender
   * Maps gender to appropriate TTS voice
   */
  getVoiceForGender(gender: 'male' | 'female' | 'neutral' | undefined): string {
    // Male voices: onyx (deep/professional), echo (male), fable (male), am_echo (Kokoro male)
    // Female voices: nova (professional female), shimmer (bright female), af_sky (Kokoro female)
    // Neutral: alloy (versatile, works for any)
    switch (gender) {
      case 'male':
        return 'onyx'; // Professional male voice
      case 'female':
        return 'nova'; // Professional female voice
      case 'neutral':
      default:
        return 'alloy'; // Neutral/versatile voice
    }
  }

  /**
   * Set voice based on gender
   */
  async setVoiceForGender(gender: 'male' | 'female' | 'neutral' | undefined): Promise<void> {
    const voiceId = this.getVoiceForGender(gender);
    this.voice = voiceId;
    console.log(`[TTSService] Voice set to ${voiceId} for gender: ${gender || 'neutral'}`);
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
    console.log('[DEBUG:TTSService] speakStreaming() called', { textLength: text.length, textPreview: text.substring(0, 30), pipelineActive: this.pipelineActive });
    if (!text.trim()) {
      console.log('[DEBUG:TTSService] Empty text, returning early');
      return;
    }

    // ─── Pipeline mode: reuse the shared AudioContext ─────────
    // When a pipeline is open, we do NOT create/destroy a context per
    // sentence.  Instead we schedule into the shared context and carry
    // nextStartTime forward so sentences chain with zero gap.
    const isPipeline = this.pipelineActive && this.pipelineCtx;
    const audioCtx = isPipeline ? this.pipelineCtx! : new AudioContext({ sampleRate: TTSService.STREAMING_SAMPLE_RATE });
    console.log('[DEBUG:TTSService] AudioContext created', { isPipeline, audioContextState: audioCtx.state, sampleRate: audioCtx.sampleRate });

    if (!isPipeline) {
      // Standalone mode — abort any prior stream, own the context
      this.stopStreaming();
      this.streamingCtx = audioCtx;
    }

    const abortCtrl = new AbortController();
    this.streamingAbort = abortCtrl;
    this.isStreamingActive = true;

    // In pipeline mode, pick up where the last sentence left off
    let nextStartTime = isPipeline ? this.pipelineNextStartTime : audioCtx.currentTime;
    let firstChunkFired = false;

    try {
      console.log('[DEBUG:TTSService] Fetching TTS from server', { baseURL: this.baseURL, model: this.model, voice: this.voice });
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
        console.log('[DEBUG:TTSService] TTS HTTP request failed', { status: response.status, error: errText });
        throw new Error(`TTS streaming request failed (${response.status}): ${errText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.log('[DEBUG:TTSService] TTS response has no readable body');
        throw new Error('TTS response has no readable body');
      }
      console.log('[DEBUG:TTSService] TTS response received, starting to read chunks');

      // Remainder buffer for byte-alignment across chunks
      let remainder: Uint8Array | null = null;

      let chunkCount = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done || !this.isStreamingActive) {
          console.log('[DEBUG:TTSService] TTS stream ended', { done, isStreamingActive: this.isStreamingActive, chunkCount });
          break;
        }
        chunkCount++;
        if (chunkCount === 1) {
          console.log('[DEBUG:TTSService] First TTS chunk received', { chunkSize: value.length });
        }

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

        if (bytes.byteLength < 2) continue;

        // Read as 16-bit LE PCM — copy to guarantee 2-byte alignment
        const aligned = new Uint8Array(bytes).buffer;
        const int16 = new Int16Array(aligned);

        // Convert Int16 → Float32
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768;
        }

        // Create AudioBuffer and schedule
        const audioBuffer = audioCtx.createBuffer(
          1,
          float32.length,
          TTSService.STREAMING_SAMPLE_RATE,
        );
        audioBuffer.getChannelData(0).set(float32);

        const srcNode = audioCtx.createBufferSource();
        srcNode.buffer = audioBuffer;
        srcNode.connect(audioCtx.destination);

        if (nextStartTime < audioCtx.currentTime) {
          nextStartTime = audioCtx.currentTime;
        }
        srcNode.start(nextStartTime);
        nextStartTime += audioBuffer.duration;

        if (!firstChunkFired) {
          firstChunkFired = true;
          onFirstChunk?.();
          console.log('[DEBUG:TTSService] First audio chunk scheduled to play', { nextStartTime, audioCtxState: audioCtx.state });
          // CRITICAL: Check if AudioContext is suspended - this is the #1 cause of no audio
          if (audioCtx.state === 'suspended') {
            console.log('[DEBUG:TTSService] WARNING: AudioContext is suspended! Attempting to resume...');
            audioCtx.resume().then(() => {
              console.log('[DEBUG:TTSService] AudioContext resumed successfully, new state:', audioCtx.state);
            }).catch((err) => {
              console.error('[DEBUG:TTSService] Failed to resume AudioContext:', err);
            });
          }
        }
      }

      // Persist the timeline cursor for the next sentence in pipeline mode
      if (isPipeline) {
        this.pipelineNextStartTime = nextStartTime;
        // Do NOT wait — return immediately so the queue can start the
        // next sentence's fetch while this one is still playing.
        console.log('[DEBUG:TTSService] Pipeline mode: returning immediately after stream');
        return;
      }

      // Standalone mode: wait for remaining audio then close
      const remaining = nextStartTime - audioCtx.currentTime;
      if (remaining > 0) {
        await new Promise(res => setTimeout(res, remaining * 1000));
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('TTS streaming aborted');
        console.log('[DEBUG:TTSService] TTS streaming aborted');
        return;
      }
      console.error('TTS streaming error:', error);
      console.log('[DEBUG:TTSService] TTS streaming error', { error: error.message });
      throw new Error(
        error.message || 'Text-to-speech streaming failed',
      );
    } finally {
      this.isStreamingActive = false;
      this.streamingAbort = null;
      // Only close context in standalone mode
      if (!isPipeline) {
        if (audioCtx.state !== 'closed') {
          await audioCtx.close().catch(() => {});
        }
        this.streamingCtx = null;
      }
      console.log('[DEBUG:TTSService] speakStreaming() finally block reached', { isPipeline, audioCtxState: audioCtx.state });
    }
  }

  /**
   * Stop any in-progress streaming playback and tear down the pipeline.
   */
  stopStreaming(): void {
    console.log('[DEBUG:TTSService] stopStreaming() called', { isStreamingActive: this.isStreamingActive, pipelineActive: this.pipelineActive });
    this.isStreamingActive = false;
    this.pipelineActive = false;
    if (this.streamingAbort) {
      this.streamingAbort.abort();
      this.streamingAbort = null;
    }
    if (this.streamingCtx && this.streamingCtx.state !== 'closed') {
      this.streamingCtx.close().catch(() => {});
      this.streamingCtx = null;
    }
    if (this.pipelineCtx && this.pipelineCtx.state !== 'closed') {
      this.pipelineCtx.close().catch(() => {});
      this.pipelineCtx = null;
    }
    this.pipelineNextStartTime = 0;
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
