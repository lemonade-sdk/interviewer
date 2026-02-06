import { AudioDevice, AudioSettings } from '../../types';
import { EventEmitter } from '../../utils/EventEmitter';

/**
 * AudioService - Manages audio input/output devices and recording
 * Handles microphone access, audio recording, and device enumeration
 */
export class AudioService extends EventEmitter {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private settings: AudioSettings;

  constructor(settings: AudioSettings) {
    super();
    this.settings = settings;
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices(): Promise<{
    inputs: AudioDevice[];
    outputs: AudioDevice[];
  }> {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputs: AudioDevice[] = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
          kind: 'audioinput',
          groupId: device.groupId,
        }));

      const outputs: AudioDevice[] = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 5)}`,
          kind: 'audiooutput',
          groupId: device.groupId,
        }));

      return { inputs, outputs };
    } catch (error) {
      console.error('Failed to enumerate audio devices:', error);
      throw new Error('Failed to access audio devices. Please check permissions.');
    }
  }

  /**
   * Start audio recording from microphone
   */
  async startRecording(deviceId?: string): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: this.settings.echoCancellation,
          noiseSuppression: this.settings.noiseSuppression,
          autoGainControl: this.settings.autoGainControl,
        },
      };

      this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create audio context for volume monitoring
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      
      // Create analyzer for audio level monitoring
      const analyzer = this.audioContext.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);

      // Monitor audio levels
      this.monitorAudioLevel(analyzer);

      // Create MediaRecorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType,
        audioBitsPerSecond: this.getAudioBitrate(),
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.emit('recording-complete', audioBlob);
        this.audioChunks = [];
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.emit('recording-started');
      
      console.log('Audio recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Failed to start audio recording. Please check microphone permissions.');
    }
  }

  /**
   * Stop audio recording
   */
  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      this.once('recording-complete', (audioBlob: Blob) => {
        resolve(audioBlob);
      });

      this.mediaRecorder.stop();
      
      // Stop all tracks
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }

      // Close audio context
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      this.emit('recording-stopped');
      console.log('Audio recording stopped');
    });
  }

  /**
   * Get current recording state
   */
  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  /**
   * Play audio from blob or URL
   */
  async playAudio(source: Blob | string, outputDeviceId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio();
        
        // Set output device if supported
        if (outputDeviceId && 'setSinkId' in audio) {
          (audio as any).setSinkId(outputDeviceId).catch((err: Error) => {
            console.warn('Failed to set audio output device:', err);
          });
        }

        // Set volume
        audio.volume = this.settings.outputVolume / 100;

        // Set source
        if (source instanceof Blob) {
          audio.src = URL.createObjectURL(source);
        } else {
          audio.src = source;
        }

        audio.onended = () => {
          if (source instanceof Blob) {
            URL.revokeObjectURL(audio.src);
          }
          this.emit('playback-complete');
          resolve();
        };

        audio.onerror = () => {
          reject(new Error('Failed to play audio'));
        };

        this.emit('playback-started');
        audio.play();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get current settings
   */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Monitor audio input level
   */
  private monitorAudioLevel(analyzer: AnalyserNode): void {
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    
    const checkLevel = () => {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        return;
      }

      analyzer.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedLevel = average / 255; // 0-1 range

      this.emit('audio-level', normalizedLevel);
      requestAnimationFrame(checkLevel);
    };

    checkLevel();
  }

  /**
   * Get supported MIME type for recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  /**
   * Get audio bitrate based on quality setting
   */
  private getAudioBitrate(): number {
    const bitrates = {
      low: 32000,    // 32 kbps
      medium: 64000, // 64 kbps
      high: 128000,  // 128 kbps
    };

    return bitrates[this.settings.recordingQuality || 'medium'];
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.isRecording()) {
      this.stopRecording();
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.removeAllListeners();
  }
}
