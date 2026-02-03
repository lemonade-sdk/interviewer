import axios from 'axios';
import FormData from 'form-data';

/**
 * ASRService - Automatic Speech Recognition using Lemonade Server
 * Converts audio to text using /api/v1/audio/transcriptions endpoint
 */
export class ASRService {
  private baseURL: string;
  private model: string;

  constructor(baseURL: string = 'http://localhost:8000/api/v1', model: string = 'whisper') {
    this.baseURL = baseURL;
    this.model = model;
  }

  /**
   * Transcribe audio blob to text
   */
  async transcribe(audioBlob: Blob, language?: string): Promise<{
    text: string;
    confidence?: number;
    segments?: Array<{ start: number; end: number; text: string }>;
  }> {
    try {
      const formData = new FormData();
      
      // Convert blob to file
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', this.model);
      
      if (language) {
        formData.append('language', language);
      }

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

      return {
        text: response.data.text || '',
        confidence: response.data.confidence,
        segments: response.data.segments,
      };
    } catch (error: any) {
      console.error('ASR transcription failed:', error);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Lemonade Server. Please ensure it is running.');
      }
      
      throw new Error(error.response?.data?.error || 'Speech recognition failed');
    }
  }

  /**
   * Update ASR model
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }
}
