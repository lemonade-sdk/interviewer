/**
 * Storage Manager
 * 
 * Central facade for managing all data stores in the application.
 * Provides access to individual stores and handles initialization.
 */

import { app } from 'electron';
import path from 'path';
import { IDataStore } from './IDataStore';
import { JsonFileStore } from './JsonFileStore';
import { CachedStore } from './CachedStore';
import { Interview, Job, AgentPersona, UserSettings, InterviewerSettings, UploadedDocument } from '../../types';

/**
 * Singleton settings store (only one instance of each setting type)
 * Used for settings that don't follow the entity pattern (no id field)
 */
class SingletonStore<T> {
  private data: T | null = null;
  private backend: IDataStore<any>;
  private key: string;

  constructor(backend: IDataStore<any>, key: string) {
    this.backend = backend;
    this.key = key;
  }

  async initialize(): Promise<void> {
    await this.backend.initialize();
  }

  async get(): Promise<T | null> {
    if (this.data) return this.data;
    
    const result = await this.backend.findById(this.key);
    if (result) {
      // Remove the 'id' property that was added for storage
      const { id, ...data } = result;
      this.data = data as T;
    }
    return this.data;
  }

  async set(data: T): Promise<T> {
    const dataWithId = { ...(data as object), id: this.key };
    
    if (await this.backend.exists(this.key)) {
      await this.backend.update(this.key, dataWithId);
    } else {
      await this.backend.create(dataWithId);
    }
    
    this.data = data;
    return data;
  }

  async update(updates: Partial<T>): Promise<T | null> {
    const current = await this.get();
    if (!current) return null;
    
    const updated = { ...(current as object), ...(updates as object) } as T;
    return await this.set(updated);
  }
}

export class StorageManager {
  private static instance: StorageManager | null = null;
  
  private basePath: string;
  private initialized: boolean = false;
  
  // Entity stores
  public interviews!: IDataStore<Interview>;
  public jobs!: IDataStore<Job>;
  public personas!: IDataStore<AgentPersona>;
  public documents!: IDataStore<UploadedDocument>;
  
  // Settings stores (singleton pattern)
  public userSettings!: SingletonStore<UserSettings>;
  public interviewerSettings!: SingletonStore<InterviewerSettings>;

  private constructor() {
    this.basePath = path.join(app.getPath('userData'), 'data');
  }

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing JSON Storage Manager...');
    console.log('Data directory:', this.basePath);

    // Create entity stores with caching
    this.interviews = new CachedStore(
      new JsonFileStore<Interview>(this.basePath, 'interviews')
    );

    this.jobs = new CachedStore(
      new JsonFileStore<Job>(this.basePath, 'jobs')
    );

    this.personas = new CachedStore(
      new JsonFileStore<AgentPersona>(this.basePath, 'personas')
    );

    this.documents = new CachedStore(
      new JsonFileStore<UploadedDocument>(this.basePath, 'documents')
    );

    // Create settings stores (singleton pattern, no caching needed)
    const settingsBackend = new JsonFileStore<any>(this.basePath, 'settings');
    await settingsBackend.initialize();
    
    this.userSettings = new SingletonStore<UserSettings>(settingsBackend, 'user');
    this.interviewerSettings = new SingletonStore<InterviewerSettings>(settingsBackend, 'interviewer');

    // Initialize all stores
    await Promise.all([
      this.interviews.initialize(),
      this.jobs.initialize(),
      this.personas.initialize(),
      this.documents.initialize(),
      this.userSettings.initialize(),
      this.interviewerSettings.initialize(),
    ]);

    // Create default settings if they don't exist
    await this.ensureDefaultSettings();

    this.initialized = true;
    console.log('✓ Storage Manager initialized successfully');
  }

  private async ensureDefaultSettings(): Promise<void> {
    // Create default user settings if not exist
    const userSettings = await this.userSettings.get();
    if (!userSettings) {
      const now = new Date().toISOString();
      await this.userSettings.set({
        userId: 'default',
        theme: 'system',
        language: 'en',
        notifications: true,
        autoSave: true,
        defaultInterviewDuration: 1800,
        createdAt: now,
        updatedAt: now,
      });
      console.log('✓ Created default user settings');
    }

    // Create default interviewer settings if not exist
    const interviewerSettings = await this.interviewerSettings.get();
    if (!interviewerSettings) {
      await this.interviewerSettings.set({
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
      });
      console.log('✓ Created default interviewer settings');
    }
  }

  getBasePath(): string {
    return this.basePath;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    return {
      interviews: await this.interviews.count(),
      jobs: await this.jobs.count(),
      personas: await this.personas.count(),
      documents: await this.documents.count(),
      basePath: this.basePath,
    };
  }
}

// Export singleton instance getter
export function getStorageManager(): StorageManager {
  return StorageManager.getInstance();
}
