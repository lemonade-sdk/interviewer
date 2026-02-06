// Core type definitions for the AI Interviewer application

export interface Interview {
  id: string;
  jobId?: string;
  title: string;
  company: string;
  position: string;
  interviewType: InterviewType;
  status: InterviewStatus;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  transcript: Message[];
  feedback?: InterviewFeedback;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  description?: string;
  status: JobStatus;
  appliedAt?: string;
  interviewIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  // Audio-related metadata
  audioFile?: string; // Path to recorded audio file
  asrTranscript?: string; // Raw ASR output before any processing
  ttsAudioFile?: string; // Path to generated TTS audio
  agentPersonaId?: string; // Which persona was active
  vadMetadata?: VADMetadata; // Voice activity detection data
  audioDeviceId?: string; // Which device was used
}

export interface VADMetadata {
  speechDetected: boolean;
  confidence: number;
  silenceDuration?: number; // milliseconds
  speechDuration?: number; // milliseconds
  vadEngine: string; // e.g., 'webrtc-vad', 'silero-vad'
}

export interface InterviewFeedback {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  detailedFeedback: string;
}

export interface UserSettings {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
  autoSave: boolean;
  defaultInterviewDuration: number;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewerSettings {
  modelProvider: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  interviewStyle: InterviewStyle;
  questionDifficulty: 'easy' | 'medium' | 'hard';
  numberOfQuestions: number;
  includeFollowUps: boolean;
  provideFeedback: boolean;
  // Voice settings
  voiceMode: boolean; // Enable voice interaction
  asrModel?: string; // ASR model for speech recognition
  ttsVoice?: string; // TTS voice selection
  vadSensitivity: number; // 0-1, sensitivity for voice detection
  autoPlayTTS: boolean; // Automatically play TTS responses
  recordingQuality: 'low' | 'medium' | 'high';
  // Active persona
  activePersonaId?: string;
}

export interface AgentPersona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  interviewStyle: InterviewStyle;
  questionDifficulty: 'easy' | 'medium' | 'hard';
  ttsVoice?: string;
  avatarUrl?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  groupId?: string;
}

export interface AudioSettings {
  inputDeviceId?: string;
  outputDeviceId?: string;
  inputVolume: number; // 0-100
  outputVolume: number; // 0-100
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  recordingQuality?: 'low' | 'medium' | 'high';
}

export interface MCPConfig {
  servers: MCPServer[];
  enabled: boolean;
}

export interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export interface LemonadeConfig {
  serverURL: string;
  models: ModelConfig[];
  defaultModel: string;
  isConnected: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  temperature: number;
  isLoaded?: boolean;
}

export type InterviewType = 
  | 'technical'
  | 'behavioral'
  | 'system-design'
  | 'coding'
  | 'general'
  | 'mixed';

export type InterviewStatus = 
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

export type JobStatus = 
  | 'interested'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'accepted'
  | 'declined';

export type InterviewStyle = 
  | 'conversational'
  | 'formal'
  | 'challenging'
  | 'supportive';

export interface AppState {
  currentInterview?: Interview;
  interviews: Interview[];
  jobs: Job[];
  settings: UserSettings;
  interviewerSettings: InterviewerSettings;
  isLoading: boolean;
  error?: string;
}

export interface SystemInfo {
  processor: string;
  physicalMemory: string;
  devices: {
    cpu?: {
      cores: number;
      available: boolean;
    };
    amd_igpu?: {
      vram_gb: number;
      available?: boolean;
    };
    nvidia_dgpu?: {
      vram_gb: number;
      available?: boolean;
    };
    npu?: {
      available: boolean;
    };
  };
  recipes?: {
    llamacpp?: {
      backends: {
        vulkan?: { available: boolean };
        rocm?: { available: boolean };
        cuda?: { available: boolean };
        cpu?: { available: boolean };
      };
    };
    whispercpp?: {
      backends: {
        vulkan?: { available: boolean };
        cuda?: { available: boolean };
        cpu?: { available: boolean };
      };
    };
  };
}

export interface LoadedModel {
  model_name: string;
  type: 'llm' | 'audio' | 'embedding' | 'reranking' | 'image';
  device: string; // e.g., "cpu", "gpu", "npu", "gpu npu"
  backend?: string;
}

export interface ServerHealth {
  status: string;
  all_models_loaded: LoadedModel[];
  max_models?: {
    llm?: number;
    audio?: number;
    embedding?: number;
    reranking?: number;
    image?: number;
  };
}

export interface IPC {
  // Interview operations
  startInterview: (config: Partial<Interview>) => Promise<Interview>;
  endInterview: (interviewId: string) => Promise<Interview>;
  sendMessage: (interviewId: string, message: string) => Promise<Message>;
  getInterview: (interviewId: string) => Promise<Interview>;
  getAllInterviews: () => Promise<Interview[]>;
  deleteInterview: (interviewId: string) => Promise<void>;
  updateInterviewTranscript: (interviewId: string, transcript: Message[]) => Promise<void>;
  
  // Job operations
  createJob: (job: Partial<Job>) => Promise<Job>;
  updateJob: (jobId: string, updates: Partial<Job>) => Promise<Job>;
  getJob: (jobId: string) => Promise<Job>;
  getAllJobs: () => Promise<Job[]>;
  deleteJob: (jobId: string) => Promise<void>;
  
  // Settings operations
  getSettings: () => Promise<UserSettings>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<UserSettings>;
  getInterviewerSettings: () => Promise<InterviewerSettings>;
  updateInterviewerSettings: (settings: Partial<InterviewerSettings>) => Promise<InterviewerSettings>;
  
  // Model operations
  getAvailableModels: () => Promise<ModelConfig[]>;
  testModelConnection: (modelId: string) => Promise<boolean>;
  loadModel: (modelId: string) => Promise<boolean>;
  unloadModel: (modelId: string) => Promise<boolean>;
  pullModel: (modelId: string) => Promise<boolean>;
  deleteModel: (modelId: string) => Promise<boolean>;
  
  // Server operations
  checkServerHealth: () => Promise<boolean>;
  getServerStatus: () => Promise<{ isRunning: boolean; url: string }>;
  refreshModels: () => Promise<ModelConfig[]>;
  getSystemInfo: () => Promise<SystemInfo | null>;
  getServerHealth: () => Promise<ServerHealth | null>;
  
  // Persona operations
  createPersona: (personaData: Partial<AgentPersona>) => Promise<AgentPersona>;
  getAllPersonas: () => Promise<AgentPersona[]>;
  getPersonaById: (personaId: string) => Promise<AgentPersona>;
  updatePersona: (personaId: string, updates: Partial<AgentPersona>) => Promise<AgentPersona>;
  deletePersona: (personaId: string) => Promise<boolean>;
  setDefaultPersona: (personaId: string) => Promise<boolean>;
  getDefaultPersona: () => Promise<AgentPersona | null>;

  // Audio operations
  saveAudioRecording: (audioData: { interviewId: string; messageId: string; audioBlob: string }) => Promise<{ success: boolean; filepath: string }>;
  getAudioRecordingsPath: () => Promise<string>;
  deleteAudioRecording: (filepath: string) => Promise<{ success: boolean; error?: string }>;

  // MCP operations
  getMCPServers: () => Promise<MCPServer[]>;
  updateMCPServers: (servers: MCPServer[]) => Promise<void>;
}
