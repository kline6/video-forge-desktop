import { create } from 'zustand';

declare global {
  interface Window {
    electronAPI: {
      createTask: (params: any) => Promise<string>;
      getTasks: () => Promise<any[]>;
      getTask: (id: string) => Promise<any>;
      cancelTask: (id: string) => Promise<boolean>;
      getSettings: () => Promise<Record<string, any>>;
      saveSettings: (key: string, value: string) => Promise<boolean>;
      getProviders: () => Promise<{
        talkingPhoto: any[];
        tts: any[];
        asr: any[];
      }>;
      openFile: (options?: any) => Promise<string | null>;
      revealInFolder: (path: string) => Promise<void>;
      onTaskProgress: (callback: (data: any) => void) => () => void;
      // AI Services
      getAiServices: () => Promise<any[]>;
      saveAiService: (service: any) => Promise<string>;
      deleteAiService: (id: string) => Promise<boolean>;
      fetchAiModels: (params: { apiKey: string; endpoint: string }) => Promise<{ success: boolean; models?: string[]; error?: string }>;
      aiTextGenerate: (params: { serviceId: string; prompt: string; systemPrompt?: string }) => Promise<string>;
      aiImageGenerate: (params: { serviceId: string; prompt: string; size?: string }) => Promise<string[]>;
      aiImageEdit: (params: { serviceId: string; prompt: string; imagePath: string; maskPath?: string }) => Promise<string[]>;
      aiVoiceClone: (params: { serviceId: string; name: string; description: string; audioPaths: string[] }) => Promise<{ voiceId: string; name: string }>;
      aiVoiceSynthesize: (params: { serviceId: string; voiceId: string; text: string }) => Promise<string>;
      aiListVoices: (params: { serviceId: string }) => Promise<{ voiceId: string; name: string; category: string }[]>;
    };
  }
}

interface Task {
  id: string;
  mode: string;
  status: string;
  scriptText: string;
  avatarPath: string | null;
  audioPath: string | null;
  outputVideoPath: string | null;
  didVideoPath: string | null;
  subtitleSrtPath: string | null;
  talkingPhotoProviderId: string;
  ttsProviderId: string | null;
  asrProviderId: string | null;
  talkingPhotoConfig: string;
  ttsConfig: string;
  asrConfig: string;
  createdAt: number;
  updatedAt: number;
  errorMessage: string | null;
  logFilePath: string | null;
  progress?: number;
  progressMessage?: string;
  progressStep?: string;
}

interface ProviderSummary {
  talkingPhoto: any[];
  tts: any[];
  asr: any[];
}

interface Store {
  tasks: Task[];
  providers: ProviderSummary | null;
  settings: Record<string, any>;
  loading: boolean;

  fetchTasks: () => Promise<void>;
  fetchProviders: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  createTask: (params: any) => Promise<string>;
  cancelTask: (id: string) => Promise<void>;
  saveSettings: (key: string, value: any) => Promise<void>;
  updateTaskProgress: (taskId: string, data: { step: string; progress: number; message: string }) => void;
}

export const useStore = create<Store>((set, get) => ({
  tasks: [],
  providers: null,
  settings: {},
  loading: false,

  fetchTasks: async () => {
    set({ loading: true });
    try {
      const tasks = await window.electronAPI.getTasks();
      set({ tasks, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchProviders: async () => {
    try {
      const providers = await window.electronAPI.getProviders();
      set({ providers });
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    }
  },

  fetchSettings: async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      set({ settings });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  },

  createTask: async (params) => {
    const taskId = await window.electronAPI.createTask(params);
    await get().fetchTasks();
    return taskId;
  },

  cancelTask: async (id) => {
    await window.electronAPI.cancelTask(id);
    await get().fetchTasks();
  },

  saveSettings: async (key, value) => {
    await window.electronAPI.saveSettings(key, JSON.stringify(value));
    await get().fetchSettings();
  },

  updateTaskProgress: (taskId, data) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, progress: data.progress, progressMessage: data.message, progressStep: data.step }
          : t
      )
    }));
  }
}));
