import { EventEmitter } from '../utils/EventEmitter';
import { AudioService } from './audio/AudioService';
import { TTSService } from './audio/TTSService';
import { VADService } from './audio/VADService';
import { RealtimeASRService } from './audio/RealtimeASRService';
import {
  AudioSettings,
  VADConfig,
  ASRConfig,
  DEFAULT_VAD_CONFIG,
  DEFAULT_ASR_CONFIG,
} from '../types';

/**
 * VoiceInterviewManager - Orchestrates all voice-related services
 * Provides a unified interface for voice interview functionality
 * 
 * Events:
 * - recording-started: When recording begins
 * - recording-stopped: When recording ends
 * - transcription-started: When Whisper ASR begins processing (for UI feedback)
 * - transcription-complete: (text: string) When speech is transcribed
 * - transcription-delta: (text: string) Live transcription delta
 * - speaking-started: When TTS starts
 * - speaking-stopped: When TTS ends
 * - audio-level: (level: number) Current audio input level (0-1)
 * - speech-detected: When VAD detects speech
 * - speech-ended: When VAD detects end of speech
 * - error: (error: Error) When any error occurs
 */
export class VoiceInterviewManager extends EventEmitter {
  private audioService: AudioService;
  private ttsService: TTSService;
  private realtimeASR: RealtimeASRService | null = null;
  private vadService: VADService | null = null;
  private isInitialized: boolean = false;
  private isRecording: boolean = false;
  private isSpeaking: boolean = false;
  private currentAudioStream: MediaStream | null = null;
  private wsPort: number | null = null;
  private asrModel: string;

  // Configs
  private vadConfig: VADConfig;
  private asrConfig: ASRConfig;

  // Accumulator for Tap-to-Speak mode
  private accumulatedTranscript: string = '';

  constructor(
    audioSettings: AudioSettings,
    asrBaseURL?: string,
    asrModel: string = "Whisper-Base",
    wsPort?: number,
    vadConfig?: Partial<VADConfig>,
    asrConfig?: Partial<ASRConfig>,
  ) {
    super();
    
    this.audioService = new AudioService(audioSettings);
    this.ttsService = new TTSService();
    this.wsPort = wsPort ?? null;
    this.asrModel = asrModel;
    this.vadConfig = { ...DEFAULT_VAD_CONFIG, ...vadConfig };
    this.asrConfig = { ...DEFAULT_ASR_CONFIG, ...asrConfig };
    
    this.setupEventListeners();
  }

  /**
   * Initialize the manager (must be called before use)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('VoiceInterviewManager already initialized');
      return;
    }

    try {
      // Initialize TTS voices
      await this.ttsService.getVoices();
      await this.ttsService.setVoice('alloy'); // Default to Alloy
      
      this.isInitialized = true;
      console.log('VoiceInterviewManager initialized');
    } catch (error) {
      console.error('Failed to initialize VoiceInterviewManager:', error);
      throw error;
    }
  }

  /**
   * Start real-time streaming (WebSocket)
   */
  async startRealtimeStreaming(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('VoiceInterviewManager not initialized');
    }

    if (this.realtimeASR) {
      console.warn('Realtime streaming already active');
      return;
    }

    if (!this.wsPort) {
      console.error('WebSocket port not provided to VoiceInterviewManager');
      throw new Error('Realtime streaming unavailable: WebSocket port not found');
    }

    try {
      // Get shared stream from AudioService
      const stream = await this.audioService.getStream();
      this.currentAudioStream = stream;

      const wsUrl = `ws://localhost:${this.wsPort}`;
      this.realtimeASR = new RealtimeASRService(wsUrl, this.asrModel, this.asrConfig);

      this.realtimeASR.on('delta', (delta: string) => {
        this.emit('transcription-delta', delta);
      });

      this.realtimeASR.on('complete', (text: string) => {
        this.emit('transcription-complete', text);
      });

      this.realtimeASR.on('error', (error: Error) => {
        this.emit('error', error);
      });

      await this.realtimeASR.start(stream);
      this.isRecording = true;
      this.emit('recording-started');
    } catch (error) {
      console.error('Failed to start realtime streaming:', error);
      throw error;
    }
  }

  /**
   * Stop real-time streaming (graceful by default — waits wsCloseDelayMs for final transcript)
   */
  stopRealtimeStreaming(graceful: boolean = true): void {
    if (this.realtimeASR) {
      this.realtimeASR.stop(graceful);
      this.realtimeASR = null;
      this.isRecording = false;
      this.emit('recording-stopped');
    }
  }

  /**
   * Start voice input (Tap to Speak)
   * Uses RealtimeASRService under the hood for consistency
   */
  async startVoiceInput(options?: {
    deviceId?: string;
    enableVAD?: boolean;
    vadSensitivity?: number;
  }): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('VoiceInterviewManager not initialized. Call initialize() first.');
    }

    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    if (!this.wsPort) {
      throw new Error('WebSocket port unavailable for voice input');
    }

    try {
      // Get shared stream
      const stream = await this.audioService.getStream(options?.deviceId);
      this.currentAudioStream = stream;

      // Initialize RealtimeASR for this session
      const wsUrl = `ws://localhost:${this.wsPort}`;
      this.realtimeASR = new RealtimeASRService(wsUrl, this.asrModel, this.asrConfig);
      this.accumulatedTranscript = '';

      this.realtimeASR.on('delta', (delta: string) => {
        // Optional: emit delta for UI feedback even in Tap-to-Speak
        this.emit('transcription-delta', delta);
      });

      this.realtimeASR.on('complete', (text: string) => {
        if (text.trim()) {
          this.accumulatedTranscript += (this.accumulatedTranscript ? ' ' : '') + text.trim();
        }
      });

      this.realtimeASR.on('error', (error: Error) => {
        this.emit('error', error);
      });

      await this.realtimeASR.start(stream);
      this.isRecording = true;
      this.emit('recording-started');

      // Enable VAD if requested
      if (options?.enableVAD) {
        // Merge user-provided vadSensitivity into the VAD config
        const vadCfg = { ...this.vadConfig };
        if (options.vadSensitivity !== undefined) {
          // Convert 0-1 sensitivity → energyThreshold
          vadCfg.energyThreshold =
            0.005 + (1 - Math.max(0, Math.min(1, options.vadSensitivity))) * 0.095;
        }
        this.vadService = new VADService(vadCfg);
        
        this.vadService.on('speech-start', () => {
          this.emit('speech-detected');
        });
        
        this.vadService.on('speech-end', () => {
          this.emit('speech-ended');
        });

        await this.vadService.start(stream);
      }

      console.log('Voice input started (Tap to Speak)');
    } catch (error: any) {
      this.isRecording = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop voice input and get transcription
   */
  async stopVoiceInput(): Promise<string> {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }

    try {
      // Stop VAD if running
      if (this.vadService) {
        this.vadService.stop();
        this.vadService = null;
      }

      // Stop audio capture immediately but keep socket open for final transcript
      if (this.realtimeASR) {
        this.realtimeASR.stop(true); // graceful: waits wsCloseDelayMs
        this.realtimeASR = null;
      }

      this.isRecording = false;
      this.emit('recording-stopped');

      // Wait for the WS close delay so the final transcript can arrive
      // before we read accumulatedTranscript
      await new Promise((resolve) => setTimeout(resolve, this.asrConfig.wsCloseDelayMs));

      const text = this.accumulatedTranscript;
      
      this.emit('transcription-complete', text);
      console.log('Transcription (Tap to Speak):', text);

      return text;
    } catch (error: any) {
      this.isRecording = false;
      this.emit('transcription-complete', '');
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Speak text using TTS
   */
  async speak(text: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('VoiceInterviewManager not initialized');
    }

    if (this.isSpeaking) {
      console.warn('Already speaking, stopping previous speech');
      this.ttsService.stop();
    }

    try {
      this.isSpeaking = true;
      this.emit('speaking-started');

      await this.ttsService.speak(text);

      this.isSpeaking = false;
      this.emit('speaking-stopped');
    } catch (error: any) {
      this.isSpeaking = false;
      this.emit('speaking-stopped');
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop speaking
   */
  stopSpeaking(): void {
    this.ttsService.stop();
    this.isSpeaking = false;
    this.emit('speaking-stopped');
  }

  /**
   * Update audio settings
   */
  updateAudioSettings(settings: Partial<AudioSettings>): void {
    this.audioService.updateSettings(settings);
  }

  /**
   * Update TTS settings
   */
  updateTTSSettings(settings: {
    voice?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
  }): void {
    if (settings.voice) {
      this.ttsService.setVoice(settings.voice);
    }
    if (settings.rate !== undefined) {
      this.ttsService.setRate(settings.rate);
    }
    if (settings.pitch !== undefined) {
      this.ttsService.setPitch(settings.pitch);
    }
    if (settings.volume !== undefined) {
      this.ttsService.setVolume(settings.volume);
    }
  }

  /**
   * Update VAD sensitivity (convenience wrapper)
   */
  updateVADSensitivity(sensitivity: number): void {
    if (this.vadService) {
      this.vadService.setSensitivity(sensitivity);
    }
  }

  /**
   * Update VAD config at runtime
   */
  updateVADConfig(partial: Partial<VADConfig>): void {
    this.vadConfig = { ...this.vadConfig, ...partial };
    if (this.vadService) {
      this.vadService.updateConfig(partial);
    }
  }

  /**
   * Update ASR config at runtime (takes effect on next session)
   */
  updateASRConfig(partial: Partial<ASRConfig>): void {
    this.asrConfig = { ...this.asrConfig, ...partial };
  }

  /**
   * Get the current VAD + ASR configs
   */
  getConfigs(): { vad: VADConfig; asr: ASRConfig } {
    return {
      vad: { ...this.vadConfig },
      asr: { ...this.asrConfig },
    };
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices() {
    return this.audioService.getAudioDevices();
  }

  /**
   * Get available TTS voices
   */
  async getTTSVoices() {
    return this.ttsService.getVoices();
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      isRecording: this.isRecording,
      isSpeaking: this.isSpeaking,
    };
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Stop any ongoing operations
    if (this.isRecording) {
      this.audioService.stopRecording().catch(console.error);
    }

    if (this.isSpeaking) {
      this.ttsService.stop();
    }

    if (this.vadService) {
      this.vadService.stop();
    }

    if (this.currentAudioStream) {
      this.currentAudioStream.getTracks().forEach(track => track.stop());
      this.currentAudioStream = null;
    }

    // Clean up services
    this.audioService.cleanup();
    
    if (this.realtimeASR) {
      this.realtimeASR.stop();
      this.realtimeASR = null;
    }
    
    // Remove all event listeners
    this.removeAllListeners();
    
    this.isInitialized = false;
    this.isRecording = false;
    this.isSpeaking = false;

    console.log('VoiceInterviewManager cleaned up');
  }

  /**
   * Setup event listeners to forward service events
   */
  private setupEventListeners(): void {
    // Forward audio service events
    this.audioService.on('recording-started', () => {
      this.emit('recording-started');
    });

    this.audioService.on('recording-stopped', () => {
      this.emit('recording-stopped');
    });

    this.audioService.on('audio-level', (level: number) => {
      this.emit('audio-level', level);
    });

    this.audioService.on('playback-started', () => {
      this.emit('playback-started');
    });

    this.audioService.on('playback-complete', () => {
      this.emit('playback-complete');
    });
  }
}
