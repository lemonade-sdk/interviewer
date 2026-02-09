/**
 * ASRService - Automatic Speech Recognition using Lemonade Server
 * Uses whisper.cpp backend via /api/v1/audio/transcriptions endpoint
 *
 * IMPORTANT: This service runs in the RENDERER process (browser context).
 * It must only use browser-native APIs (fetch, FormData, File).
 * Do NOT use Node.js APIs (Buffer, require('form-data'), etc.).
 *
 * Per Lemonade Server spec:
 * - Endpoint: POST /api/v1/audio/transcriptions
 * - Models: Whisper-Tiny, Whisper-Base, Whisper-Small
 * - Format: WAV only (currently supported)
 * - Response: { text: string }
 */
export class ASRService {
  private baseURL: string;
  private model: 'Whisper-Tiny' | 'Whisper-Base' | 'Whisper-Small';

  constructor(
    baseURL: string = 'http://localhost:8000/api/v1',
    model: 'Whisper-Tiny' | 'Whisper-Base' | 'Whisper-Small' = 'Whisper-Tiny'
  ) {
    this.baseURL = baseURL;
    this.model = model;
  }

  /**
   * Transcribe audio blob to text
   * Note: Audio must be in WAV format per Lemonade Server spec
   * If audioBlob is not WAV, it should be converted before calling this method
   */
  async transcribe(audioBlob: Blob, language?: string): Promise<{
    text: string;
    confidence?: number;
    segments?: Array<{ start: number; end: number; text: string }>;
  }> {
    try {
      // Ensure we're using WAV format
      const isWav = audioBlob.type === 'audio/wav' || audioBlob.type === 'audio/wave';

      if (!isWav) {
        console.warn('ASRService: Audio blob is not WAV format. Attempting to send as-is...');
      }

      // Use browser-native FormData + File (renderer process — no Node.js APIs)
      const formData = new FormData();

      // Per spec: 'file' parameter with WAV audio
      const audioFile = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });
      formData.append('file', audioFile);

      // Per spec: 'model' parameter with Whisper model name
      formData.append('model', this.model);

      // Optional: language parameter (ISO 639-1 code like 'en', 'es', 'fr')
      if (language) {
        formData.append('language', language);
      }

      // Per spec: POST /api/v1/audio/transcriptions
      // Use fetch (browser-native) — no axios needed for multipart uploads
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(`${this.baseURL}/audio/transcriptions`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg =
          errorData?.error?.message ||
          errorData?.error ||
          errorData?.message ||
          `HTTP ${response.status}: ${response.statusText}`;

        if (response.status === 400) {
          throw new Error('Invalid audio format. Lemonade Server requires WAV format.');
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      // Per spec: Response format is { text: string }
      return {
        text: data.text || '',
        confidence: data.confidence,
        segments: data.segments,
      };
    } catch (error: any) {
      console.error('ASR transcription failed:', error);

      if (error.name === 'AbortError') {
        throw new Error('Speech recognition timed out. Please try again.');
      }

      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error(
          'Cannot connect to Lemonade Server. Please ensure it is running at ' +
            this.baseURL.replace('/api/v1', '')
        );
      }

      throw error;
    }
  }

  /**
   * Update ASR model
   * Valid models: Whisper-Tiny (fastest), Whisper-Base, Whisper-Small (most accurate)
   */
  setModel(model: 'Whisper-Tiny' | 'Whisper-Base' | 'Whisper-Small'): void {
    this.model = model;
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get list of available Whisper models
   */
  getAvailableModels(): string[] {
    return ['Whisper-Tiny', 'Whisper-Base', 'Whisper-Small'];
  }

  /**
   * Convert audio blob from WebM/other format to WAV
   * Uses Web Audio API for browser-compatible conversion
   */
  async convertToWav(audioBlob: Blob): Promise<Blob> {
    if (audioBlob.type === 'audio/wav' || audioBlob.type === 'audio/wave') {
      return audioBlob;
    }

    try {
      // Decode the audio using Web Audio API
      const audioContext = new AudioContext();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Convert AudioBuffer to WAV
      const wavBlob = this.audioBufferToWav(audioBuffer);
      await audioContext.close();
      return wavBlob;
    } catch (error) {
      console.warn('WAV conversion failed, returning original blob:', error);
      return audioBlob;
    }
  }

  /**
   * Convert an AudioBuffer to a WAV Blob (browser-compatible)
   */
  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    // Interleave channels
    const length = buffer.length * numChannels;
    const samples = new Float32Array(length);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        samples[i * numChannels + channel] = channelData[i];
      }
    }

    // Create WAV file
    const byteRate = (sampleRate * numChannels * bitDepth) / 8;
    const blockAlign = (numChannels * bitDepth) / 8;
    const dataSize = samples.length * (bitDepth / 8);
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    this.writeString(view, 8, 'WAVE');

    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}
