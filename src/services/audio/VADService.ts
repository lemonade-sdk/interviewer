import { EventEmitter } from '../../utils/EventEmitter';
import { VADMetadata, VADConfig, DEFAULT_VAD_CONFIG } from '../../types';

/**
 * VADService - Voice Activity Detection
 * Detects when user starts/stops speaking using audio analysis.
 *
 * Tunable parameters (via VADConfig):
 *   energyThreshold  – energy level to count as speech (0-1)
 *   minSpeechMs      – ms of speech before triggering speech-start
 *   minSilenceMs     – ms of silence before triggering speech-end
 *   onsetFrames      – consecutive frames above threshold to trigger onset
 *   hangoverFrames   – extra frames to keep after energy drops
 */
export class VADService extends EventEmitter {
  private audioContext: AudioContext | null = null;
  private analyzer: AnalyserNode | null = null;
  private isMonitoring: boolean = false;
  private config: VADConfig;

  // Internal state
  private silenceDuration: number = 0;
  private speechDuration: number = 0;
  private isSpeaking: boolean = false;
  private consecutiveOnsetFrames: number = 0;
  private hangoverRemaining: number = 0;
  private checkInterval: number = 50; // ms per polling tick

  constructor(config?: Partial<VADConfig>) {
    super();
    this.config = { ...DEFAULT_VAD_CONFIG, ...config };
  }

  /**
   * Start monitoring an audio stream for voice activity
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

      console.log('VAD monitoring started', this.config);
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
   * Update the full config at runtime
   */
  updateConfig(partial: Partial<VADConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Convenience: update just the energy threshold
   */
  setSensitivity(sensitivity: number): void {
    // Map 0-1 sensitivity to an energy threshold:
    // high sensitivity (1.0) → low threshold (0.005)
    // low  sensitivity (0.0) → high threshold (0.10)
    this.config.energyThreshold = 0.005 + (1 - Math.max(0, Math.min(1, sensitivity))) * 0.095;
  }

  /**
   * Get current VAD metadata
   */
  getMetadata(): VADMetadata {
    return {
      speechDetected: this.isSpeaking,
      confidence: this.isSpeaking ? 0.8 : 0.2,
      silenceDuration: this.silenceDuration,
      speechDuration: this.speechDuration,
      vadEngine: 'web-audio-api',
    };
  }

  /**
   * Get the active config (useful for debugging / UI display)
   */
  getConfig(): VADConfig {
    return { ...this.config };
  }

  // ────────────────────────────────────────────────────────
  // Internal
  // ────────────────────────────────────────────────────────

  private monitorVoiceActivity(): void {
    if (!this.isMonitoring || !this.analyzer) return;

    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    this.analyzer.getByteFrequencyData(dataArray);

    // Normalised energy: 0-1
    const average = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
    const energy = average / 255;

    const frameIsSpeech = energy > this.config.energyThreshold;

    // ── Onset detection (consecutive frames above threshold) ──
    if (frameIsSpeech) {
      this.consecutiveOnsetFrames++;
      this.hangoverRemaining = this.config.hangoverFrames; // reset hangover
    } else {
      this.consecutiveOnsetFrames = 0;
      if (this.hangoverRemaining > 0) {
        this.hangoverRemaining--;
      }
    }

    // Effective speech = onset met OR still in hangover
    const effectiveSpeech =
      this.consecutiveOnsetFrames >= this.config.onsetFrames || this.hangoverRemaining > 0;

    if (effectiveSpeech) {
      this.speechDuration += this.checkInterval;
      this.silenceDuration = 0;

      if (!this.isSpeaking && this.speechDuration >= this.config.minSpeechMs) {
        // Speech started (met minimum duration)
        this.isSpeaking = true;
        this.emit('speech-start', {
          energy,
          timestamp: Date.now(),
        });
      }
    } else {
      this.silenceDuration += this.checkInterval;

      if (this.isSpeaking && this.silenceDuration >= this.config.minSilenceMs) {
        // Speech ended
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

    // Continue polling
    setTimeout(() => this.monitorVoiceActivity(), this.checkInterval);
  }

  private resetCounters(): void {
    this.silenceDuration = 0;
    this.speechDuration = 0;
    this.consecutiveOnsetFrames = 0;
    this.hangoverRemaining = 0;
  }
}
