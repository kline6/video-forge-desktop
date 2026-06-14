import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // Task operations
  createTask: (params: any) => ipcRenderer.invoke('task:create', params),
  getTasks: () => ipcRenderer.invoke('tasks:get'),
  getTask: (id: string) => ipcRenderer.invoke('task:get', id),
  cancelTask: (id: string) => ipcRenderer.invoke('task:cancel', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (key: string, value: string) => ipcRenderer.invoke('settings:save', key, value),

  // Providers
  getProviders: () => ipcRenderer.invoke('providers:get'),

  // File dialogs
  openFile: (options?: any) => ipcRenderer.invoke('dialog:openFile', options),

  // Shell
  revealInFolder: (path: string) => ipcRenderer.invoke('shell:reveal', path),

  // Progress listener
  onTaskProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('task:progress', handler);
    return () => ipcRenderer.removeListener('task:progress', handler);
  },

  // AI Services
  getAiServices: () => ipcRenderer.invoke('ai_services:get'),
  saveAiService: (service: any) => ipcRenderer.invoke('ai_services:save', service),
  deleteAiService: (id: string) => ipcRenderer.invoke('ai_services:delete', id),
  fetchAiModels: (params: { apiKey: string; endpoint: string }) => ipcRenderer.invoke('ai_services:fetch_models', params),

  // AI Generation
  aiTextGenerate: (params: { serviceId: string; prompt: string; systemPrompt?: string }) => ipcRenderer.invoke('ai:text_generate', params),
  aiImageGenerate: (params: { serviceId: string; prompt: string; size?: string }) => ipcRenderer.invoke('ai:image_generate', params),
  aiImageEdit: (params: { serviceId: string; prompt: string; imagePath: string; maskPath?: string }) => ipcRenderer.invoke('ai:image_edit', params),
  aiVoiceClone: (params: { serviceId: string; name: string; description: string; audioPaths: string[] }) => ipcRenderer.invoke('ai:voice_clone', params),
  aiVoiceSynthesize: (params: { serviceId: string; voiceId: string; text: string }) => ipcRenderer.invoke('ai:voice_synthesize', params),
  aiListVoices: (params: { serviceId: string }) => ipcRenderer.invoke('ai:list_voices', params),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
