import { getDatabase } from '../db';
import { UserSettings, InterviewerSettings } from '../../types';

export class SettingsRepository {
  private get storage() {
    return getDatabase();
  }

  async getUserSettings(): Promise<UserSettings> {
    const settings = await this.storage.userSettings.get();
    
    if (!settings) {
      // Create default settings if not exists
      return await this.createDefaultUserSettings();
    }
    
    return settings;
  }

  async updateUserSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
    const existing = await this.getUserSettings();
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.userSettings.set(updated);
    return updated;
  }

  async getInterviewerSettings(): Promise<InterviewerSettings> {
    const settings = await this.storage.interviewerSettings.get();
    
    if (!settings) {
      return await this.createDefaultInterviewerSettings();
    }
    
    return settings;
  }

  async updateInterviewerSettings(updates: Partial<InterviewerSettings>): Promise<InterviewerSettings> {
    const existing = await this.getInterviewerSettings();
    
    const updated = {
      ...existing,
      ...updates,
    };

    await this.storage.interviewerSettings.set(updated);
    return updated;
  }

  private async createDefaultUserSettings(): Promise<UserSettings> {
    const now = new Date().toISOString();
    const defaults: UserSettings = {
      userId: 'default',
      theme: 'system',
      language: 'en',
      notifications: true,
      autoSave: true,
      defaultInterviewDuration: 3600,
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.userSettings.set(defaults);
    return defaults;
  }

  private async createDefaultInterviewerSettings(): Promise<InterviewerSettings> {
    const defaults: InterviewerSettings = {
      modelProvider: 'lemonade-server',
      modelName: 'Llama-3.2-1B-Instruct-Hybrid',
      temperature: 0.7,
      maxTokens: 2000,
      interviewStyle: 'conversational',
      questionDifficulty: 'medium',
      numberOfQuestions: 10,
      includeFollowUps: true,
      provideFeedback: true,
      // Voice settings
      voiceMode: false,
      vadSensitivity: 0.5,
      autoPlayTTS: true,
      recordingQuality: 'medium',
    };

    await this.storage.interviewerSettings.set(defaults);
    return defaults;
  }
}
