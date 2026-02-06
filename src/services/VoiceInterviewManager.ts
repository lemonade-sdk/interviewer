import { EventEmitter } from '../utils/EventEmitter';
import { AudioService } from './audio/AudioService';
import { ASRService } from './audio/ASRService';
import { TTSService } from './audio/TTSService';
import { VADService } from './audio/VADService';
import { AudioSettings, Message } from '../types';

/**
 * VoiceInterviewManager - Orchestrates all voice-related services
 * Provides a unified interface for voice interview functionality
 * 
 * Events:
 * - recording-started: When recording begins
 * - recording-stopped: When recording ends
 * - transcription-complete: (text: string) When speech is transcribed
 * - speaking-started: When TTS starts
 * - speaking-stopped: When TTS ends
 * - audio-level: (level: number) Current audio input level (0-1)
 * - speech-detected: When VAD detects speech
 * - speech-ended: When VAD detects end of speech
 * - error: (error: Error) When any error occurs
 */
export class VoiceInterviewManager extends EventEmitter {
  private audioService: AudioService;
  private asrService: ASRService;
  private ttsService: TTSService;
  private vadService: VADService | null = null;
  private isInitialized: boolean = false;
  private isRecording: boolean = false;
  private isSpeaking: boolean = false;
  private currentAudioStream: MediaStream | null = null;

  constructor(
    audioSettings: AudioSettings,
    asrBaseURL?: string,
    asrModel?: string
  ) {
    super();
    
    this.audioService = new AudioService(audioSettings);
    this.asrService = new ASRService(asrBaseURL, asrModel);
    this.ttsService = new TTSService();
    
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
      await this.ttsService.setVoice(undefined, 'en'); // Default to English
      
      this.isInitialized = true;
      console.log('VoiceInterviewManager initialized');
    } catch (error) {
      console.error('Failed to initialize VoiceInterviewManager:', error);
      throw error;
    }
  }

  /**
   * Start voice input (recording with VAD)
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

    try {
      // Start audio recording
      await this.audioService.startRecording(options?.deviceId);
      this.isRecording = true;

      // Enable VAD if requested
      if (options?.enableVAD) {
        // Get audio stream for VAD
        const devices = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.currentAudioStream = devices;
        
        this.vadService = new VADService(options.vadSensitivity || 0.7);
        
        // Forward VAD events
        this.vadService.on('speech-start', () => {
          this.emit('speech-detected');
        });
        
        this.vadService.on('speech-end', () => {
          this.emit('speech-ended');
        });

        await this.vadService.start(devices);
      }

      console.log('Voice input started');
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

      // Stop audio stream
      if (this.currentAudioStream) {
        this.currentAudioStream.getTracks().forEach(track => track.stop());
        this.currentAudioStream = null;
      }

      // Stop recording and get audio blob
      const audioBlob = await this.audioService.stopRecording();
      this.isRecording = false;

      // Transcribe audio
      const transcription = await this.asrService.transcribe(audioBlob);
      const text = transcription.text;

      this.emit('transcription-complete', text);
      console.log('Transcription:', text);

      return text;
    } catch (error: any) {
      this.isRecording = false;
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
   * Update VAD sensitivity
   */
  updateVADSensitivity(sensitivity: number): void {
    if (this.vadService) {
      this.vadService.setSensitivity(sensitivity);
    }
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
