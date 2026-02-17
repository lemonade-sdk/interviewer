import { create } from 'zustand';
import { Interview, Job, UserSettings, InterviewerSettings } from '../../types';

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
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;

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
  setTheme: async (theme) => {
    try {
      if (window.electronAPI) {
        const updated = await window.electronAPI.updateSettings({ theme });
        set({ settings: updated });
      } else {
        set((state) => ({
          settings: state.settings ? { ...state.settings, theme } : null,
        }));
      }
      // Apply to DOM immediately
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
      }
    } catch (error) {
      console.error('Failed to update theme:', error);
    }
  },

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

// Type declaration for window.electronAPI is handled in vite-env.d.ts
