import { create } from 'zustand';
import { Interview, Job, UserSettings, InterviewerSettings, AgentPersona } from '../../types';

interface AppStore {
  // State
  interviews: Interview[];
  jobs: Job[];
  currentInterview: Interview | null;
  settings: UserSettings | null;
  interviewerSettings: InterviewerSettings | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setInterviews: (interviews: Interview[]) => void;
  setJobs: (jobs: Job[]) => void;
  setCurrentInterview: (interview: Interview | null) => void;
  setSettings: (settings: UserSettings) => void;
  setInterviewerSettings: (settings: InterviewerSettings) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Async actions
  loadInterviews: () => Promise<void>;
  loadJobs: () => Promise<void>;
  loadSettings: () => Promise<void>;
  loadInterviewerSettings: () => Promise<void>;
}

export const useStore = create<AppStore>((set) => ({
  // Initial state
  interviews: [],
  jobs: [],
  currentInterview: null,
  settings: null,
  interviewerSettings: null,
  isLoading: false,
  error: null,

  // Actions
  setInterviews: (interviews) => set({ interviews }),
  setJobs: (jobs) => set({ jobs }),
  setCurrentInterview: (interview) => set({ currentInterview: interview }),
  setSettings: (settings) => set({ settings }),
  setInterviewerSettings: (settings) => set({ interviewerSettings: settings }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Async actions
  loadInterviews: async () => {
    try {
      set({ isLoading: true, error: null });
      const interviews = await window.electronAPI.getAllInterviews();
      set({ interviews, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadJobs: async () => {
    try {
      set({ isLoading: true, error: null });
      const jobs = await window.electronAPI.getAllJobs();
      set({ jobs, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadSettings: async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      set({ settings });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadInterviewerSettings: async () => {
    try {
      const settings = await window.electronAPI.getInterviewerSettings();
      set({ interviewerSettings: settings });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));

// Type declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      startInterview: (config: any) => Promise<Interview>;
      endInterview: (interviewId: string) => Promise<Interview>;
      sendMessage: (interviewId: string, message: string) => Promise<any>;
      getInterview: (interviewId: string) => Promise<Interview>;
      getAllInterviews: () => Promise<Interview[]>;
      deleteInterview: (interviewId: string) => Promise<void>;
      createJob: (jobData: any) => Promise<Job>;
      updateJob: (jobId: string, updates: any) => Promise<Job>;
      getJob: (jobId: string) => Promise<Job>;
      getAllJobs: () => Promise<Job[]>;
      deleteJob: (jobId: string) => Promise<void>;
      getSettings: () => Promise<UserSettings>;
      updateSettings: (updates: any) => Promise<UserSettings>;
      getInterviewerSettings: () => Promise<InterviewerSettings>;
      updateInterviewerSettings: (updates: any) => Promise<InterviewerSettings>;
      getAvailableModels: () => Promise<any[]>;
      testModelConnection: (modelId: string) => Promise<boolean>;
      loadModel: (modelId: string) => Promise<boolean>;
      unloadModel: (modelId: string) => Promise<boolean>;
      pullModel: (modelId: string) => Promise<boolean>;
      deleteModel: (modelId: string) => Promise<boolean>;
      refreshModels: () => Promise<any[]>;
      checkServerHealth: () => Promise<boolean>;
      getServerStatus: () => Promise<{ isRunning: boolean; url: string }>;
      getMCPServers: () => Promise<any[]>;
      updateMCPServers: (servers: any[]) => Promise<void>;
      
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
    };
  }
}
