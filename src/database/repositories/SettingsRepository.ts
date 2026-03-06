import { getDatabase } from '../db';
import { UserSettings, InterviewerSettings } from '../../types';

export class SettingsRepository {
  private get storage() {
    return getDatabase();
  }

  async getUserSettings(): Promise<UserSettings> {
    const settings = await this.storage.userSettings.get();
    
    if (!settings) {
      return await this.createDefaultUserSettings();
    }

    // One-time migration: old code stored duration in seconds (e.g. 3600).
    // Any value > 300 is almost certainly seconds — reset to 30 minutes.
    if (settings.defaultInterviewDuration > 300) {
      console.log(`[SettingsRepo] Migrating defaultInterviewDuration from ${settings.defaultInterviewDuration}s → 30 minutes`);
      const migrated = { ...settings, defaultInterviewDuration: 30, updatedAt: new Date().toISOString() };
      await this.storage.userSettings.set(migrated);
      return migrated;
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
      defaultInterviewDuration: 30,  // Fixed: Store as minutes (was 3600 seconds)
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.userSettings.set(defaults);
    return defaults;
  }

  private async createDefaultInterviewerSettings(): Promise<InterviewerSettings> {
    const defaults: InterviewerSettings = {
      modelProvider: 'lemonade-server',
      modelName: 'Qwen3-Coder-30B-A3B-Instruct-GGUF',
      extractionModelName: 'Qwen3-Coder-30B-A3B-Instruct-GGUF',
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
