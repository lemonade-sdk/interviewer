import axios from 'axios';
import FormData from 'form-data';

/**
 * ASRService - Automatic Speech Recognition using Lemonade Server
 * Uses whisper.cpp backend via /api/v1/audio/transcriptions endpoint
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
        console.warn('ASRService: Audio blob is not WAV format. Attempting to convert...');
        // In a real implementation, we would convert here
        // For now, we'll proceed and let the server handle it
      }

      const formData = new FormData();
      
      // Convert blob to buffer for Node.js environment (Electron main process)
      const buffer = Buffer.from(await audioBlob.arrayBuffer());
      
      // Per spec: 'file' parameter with WAV audio
      formData.append('file', buffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav',
      });
      
      // Per spec: 'model' parameter with Whisper model name
      formData.append('model', this.model);
      
      // Optional: language parameter (ISO 639-1 code like 'en', 'es', 'fr')
      if (language) {
        formData.append('language', language);
      }

      // Per spec: POST /api/v1/audio/transcriptions
      const response = await axios.post(
        `${this.baseURL}/audio/transcriptions`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 30000, // 30 seconds for transcription
        }
      );

      // Per spec: Response format is { text: string }
      return {
        text: response.data.text || '',
        // Note: spec doesn't mention confidence/segments, but we'll keep for backwards compat
        confidence: response.data.confidence,
        segments: response.data.segments,
      };
    } catch (error: any) {
      console.error('ASR transcription failed:', error);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Lemonade Server. Please ensure it is running at ' + this.baseURL.replace('/api/v1', ''));
      }
      
      if (error.response?.status === 400) {
        throw new Error('Invalid audio format. Lemonade Server requires WAV format.');
      }
      
      throw new Error(error.response?.data?.error?.message || error.message || 'Speech recognition failed');
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
   * This is a helper for browser-based audio recording
   * Note: In Electron, you may need to use a different conversion method
   */
  async convertToWav(audioBlob: Blob): Promise<Blob> {
    // This is a placeholder - actual implementation would use Web Audio API
    // or a library like audiobuffer-to-wav
    if (audioBlob.type === 'audio/wav' || audioBlob.type === 'audio/wave') {
      return audioBlob;
    }
    
    // TODO: Implement actual WAV conversion using Web Audio API
    // For now, we'll just return the blob and let server handle errors
    console.warn('WAV conversion not implemented. Audio may fail transcription if not WAV format.');
    return audioBlob;
  }
}
