import { getDatabase } from '../db';
import { UserSettings, InterviewerSettings } from '../../types';

export class SettingsRepository {
  private db = getDatabase();

  getUserSettings(): UserSettings {
    const stmt = this.db.prepare('SELECT * FROM user_settings WHERE user_id = ?');
    const row = stmt.get('default') as any;
    
    if (!row) {
      // Create default settings if not exists
      return this.createDefaultUserSettings();
    }
    
    return {
      userId: row.user_id,
      theme: row.theme,
      language: row.language,
      notifications: row.notifications === 1,
      autoSave: row.auto_save === 1,
      defaultInterviewDuration: row.default_interview_duration,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  updateUserSettings(updates: Partial<UserSettings>): UserSettings {
    const existing = this.getUserSettings();
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE user_settings SET
        theme = ?,
        language = ?,
        notifications = ?,
        auto_save = ?,
        default_interview_duration = ?,
        updated_at = ?
      WHERE user_id = ?
    `);

    stmt.run(
      updated.theme,
      updated.language,
      updated.notifications ? 1 : 0,
      updated.autoSave ? 1 : 0,
      updated.defaultInterviewDuration,
      updated.updatedAt,
      'default'
    );

    return updated;
  }

  getInterviewerSettings(): InterviewerSettings {
    const stmt = this.db.prepare('SELECT * FROM interviewer_settings WHERE id = 1');
    const row = stmt.get() as any;
    
    if (!row) {
      return this.createDefaultInterviewerSettings();
    }
    
    return {
      modelProvider: row.model_provider,
      modelName: row.model_name,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      interviewStyle: row.interview_style,
      questionDifficulty: row.question_difficulty,
      numberOfQuestions: row.number_of_questions,
      includeFollowUps: row.include_follow_ups === 1,
      provideFeedback: row.provide_feedback === 1,
    };
  }

  updateInterviewerSettings(updates: Partial<InterviewerSettings>): InterviewerSettings {
    const existing = this.getInterviewerSettings();
    const updated = {
      ...existing,
      ...updates,
    };

    const stmt = this.db.prepare(`
      UPDATE interviewer_settings SET
        model_provider = ?,
        model_name = ?,
        temperature = ?,
        max_tokens = ?,
        interview_style = ?,
        question_difficulty = ?,
        number_of_questions = ?,
        include_follow_ups = ?,
        provide_feedback = ?,
        updated_at = ?
      WHERE id = 1
    `);

    stmt.run(
      updated.modelProvider,
      updated.modelName,
      updated.temperature,
      updated.maxTokens,
      updated.interviewStyle,
      updated.questionDifficulty,
      updated.numberOfQuestions,
      updated.includeFollowUps ? 1 : 0,
      updated.provideFeedback ? 1 : 0,
      new Date().toISOString()
    );

    return updated;
  }

  private createDefaultUserSettings(): UserSettings {
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

    const stmt = this.db.prepare(`
      INSERT INTO user_settings (
        user_id, theme, language, notifications, auto_save,
        default_interview_duration, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      defaults.userId,
      defaults.theme,
      defaults.language,
      defaults.notifications ? 1 : 0,
      defaults.autoSave ? 1 : 0,
      defaults.defaultInterviewDuration,
      defaults.createdAt,
      defaults.updatedAt
    );

    return defaults;
  }

  private createDefaultInterviewerSettings(): InterviewerSettings {
    const defaults: InterviewerSettings = {
      modelProvider: 'openai',
      modelName: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      interviewStyle: 'conversational',
      questionDifficulty: 'medium',
      numberOfQuestions: 10,
      includeFollowUps: true,
      provideFeedback: true,
    };

    const stmt = this.db.prepare(`
      INSERT INTO interviewer_settings (
        id, model_provider, model_name, temperature, max_tokens,
        interview_style, question_difficulty, number_of_questions,
        include_follow_ups, provide_feedback, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      defaults.modelProvider,
      defaults.modelName,
      defaults.temperature,
      defaults.maxTokens,
      defaults.interviewStyle,
      defaults.questionDifficulty,
      defaults.numberOfQuestions,
      defaults.includeFollowUps ? 1 : 0,
      defaults.provideFeedback ? 1 : 0,
      new Date().toISOString()
    );

    return defaults;
  }
}
