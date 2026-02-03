/**
 * TTSService - Text-to-Speech Service
 * Converts text to speech using Web Speech API or external TTS service
 */
export class TTSService {
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private rate: number = 1.0;
  private pitch: number = 1.0;
  private volume: number = 1.0;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      let voices = this.synth.getVoices();
      
      if (voices.length > 0) {
        resolve(voices);
      } else {
        // Voices may load asynchronously
        this.synth.onvoiceschanged = () => {
          voices = this.synth.getVoices();
          resolve(voices);
        };
      }
    });
  }

  /**
   * Set voice by name or language
   */
  async setVoice(voiceName?: string, lang?: string): Promise<void> {
    const voices = await this.getVoices();
    
    if (voiceName) {
      this.voice = voices.find(v => v.name === voiceName) || null;
    } else if (lang) {
      this.voice = voices.find(v => v.lang.startsWith(lang)) || null;
    }

    if (!this.voice && voices.length > 0) {
      // Fallback to first English voice or any voice
      this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    }
  }

  /**
   * Speak text
   */
  async speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!text.trim()) {
        resolve();
        return;
      }

      // Cancel any ongoing speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      if (this.voice) {
        utterance.voice = this.voice;
      }
      
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      utterance.onend = () => resolve();
      utterance.onerror = (error) => {
        console.error('TTS error:', error);
        reject(new Error('Text-to-speech failed'));
      };

      this.synth.speak(utterance);
    });
  }

  /**
   * Stop speaking
   */
  stop(): void {
    this.synth.cancel();
  }

  /**
   * Pause speaking
   */
  pause(): void {
    this.synth.pause();
  }

  /**
   * Resume speaking
   */
  resume(): void {
    this.synth.resume();
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synth.speaking;
  }

  /**
   * Set speech rate (0.1 - 10)
   */
  setRate(rate: number): void {
    this.rate = Math.max(0.1, Math.min(10, rate));
  }

  /**
   * Set speech pitch (0 - 2)
   */
  setPitch(pitch: number): void {
    this.pitch = Math.max(0, Math.min(2, pitch));
  }

  /**
   * Set speech volume (0 - 1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }
}
