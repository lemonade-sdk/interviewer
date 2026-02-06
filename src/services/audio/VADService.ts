import { EventEmitter } from '../../utils/EventEmitter';
import { VADMetadata } from '../../types';

/**
 * VADService - Voice Activity Detection
 * Detects when user starts/stops speaking using audio analysis
 */
export class VADService extends EventEmitter {
  private audioContext: AudioContext | null = null;
  private analyzer: AnalyserNode | null = null;
  private isMonitoring: boolean = false;
  private sensitivity: number;
  private silenceThreshold: number;
  private silenceDuration: number = 0;
  private speechDuration: number = 0;
  private isSpeaking: boolean = false;
  private checkInterval: number = 50; // ms

  constructor(sensitivity: number = 0.7) {
    super();
    this.sensitivity = sensitivity;
    this.silenceThreshold = this.calculateSilenceThreshold(sensitivity);
  }

  /**
   * Start monitoring audio stream for voice activity
   */
  async start(audioStream: MediaStream): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(audioStream);
      
      this.analyzer = this.audioContext.createAnalyser();
      this.analyzer.fftSize = 2048;
      this.analyzer.smoothingTimeConstant = 0.8;
      
      source.connect(this.analyzer);

      this.isMonitoring = true;
      this.monitorVoiceActivity();

      console.log('VAD monitoring started');
    } catch (error) {
      console.error('Failed to start VAD:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isMonitoring = false;
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyzer = null;
    this.resetCounters();
    console.log('VAD monitoring stopped');
  }

  /**
   * Update sensitivity (0-1)
   */
  setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0, Math.min(1, sensitivity));
    this.silenceThreshold = this.calculateSilenceThreshold(this.sensitivity);
  }

  /**
   * Get current VAD metadata
   */
  getMetadata(): VADMetadata {
    return {
      speechDetected: this.isSpeaking,
      confidence: this.isSpeaking ? 0.8 : 0.2, // Simplified confidence
      silenceDuration: this.silenceDuration,
      speechDuration: this.speechDuration,
      vadEngine: 'web-audio-api',
    };
  }

  /**
   * Monitor voice activity in a loop
   */
  private monitorVoiceActivity(): void {
    if (!this.isMonitoring || !this.analyzer) {
      return;
    }

    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    this.analyzer.getByteFrequencyData(dataArray);

    // Calculate audio energy
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedEnergy = average / 255;

    const isSpeechDetected = normalizedEnergy > this.silenceThreshold;

    if (isSpeechDetected) {
      this.speechDuration += this.checkInterval;
      
      if (!this.isSpeaking) {
        // Speech started
        this.isSpeaking = true;
        this.silenceDuration = 0;
        this.emit('speech-start', {
          energy: normalizedEnergy,
          timestamp: Date.now(),
        });
      }
    } else {
      this.silenceDuration += this.checkInterval;
      
      if (this.isSpeaking && this.silenceDuration > 1000) {
        // Speech ended (1 second of silence)
        this.isSpeaking = false;
        const metadata = this.getMetadata();
        this.emit('speech-end', {
          speechDuration: this.speechDuration,
          metadata,
          timestamp: Date.now(),
        });
        this.resetCounters();
      }
    }

    // Continue monitoring
    setTimeout(() => this.monitorVoiceActivity(), this.checkInterval);
  }

  /**
   * Calculate silence threshold based on sensitivity
   */
  private calculateSilenceThreshold(sensitivity: number): number {
    // Higher sensitivity = lower threshold (easier to trigger)
    // Lower sensitivity = higher threshold (harder to trigger)
    return 0.1 + (1 - sensitivity) * 0.3; // Range: 0.1 to 0.4
  }

  /**
   * Reset duration counters
   */
  private resetCounters(): void {
    this.silenceDuration = 0;
    this.speechDuration = 0;
  }
}
