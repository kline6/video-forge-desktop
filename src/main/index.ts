import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';

// Disable GPU acceleration to avoid network service crash on some Windows systems
app.disableHardwareAcceleration();

import { writeFileSync, appendFileSync } from 'fs';

const logFile = join(app.getPath('userData'), 'crash.log');
function logToFile(msg: string) {
  try { appendFileSync(logFile, new Date().toISOString() + ' ' + msg + '\n'); } catch {}
}

process.on('uncaughtException', (error) => {
  logToFile('Uncaught Exception: ' + (error?.stack || error));
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason: any) => {
  logToFile('Unhandled Rejection: ' + (reason?.stack || reason));
  console.error('Unhandled Rejection:', reason);
});
import { join } from 'path';
import { initDatabase, getDb, insertTask, updateTask, getTask, getAllTasks, getSetting, saveSetting, getAllAiServices, upsertAiService, deleteAiService } from './database';
import { ProviderManager } from './ProviderManager';
import { enqueueTask } from './task-queue';
import { EdgeTTSProvider } from './providers/tts/EdgeTTSProvider';
import { WhisperProvider } from './providers/asr/WhisperProvider';
import { DIDProvider } from './providers/talkingphoto/DIDProvider';
import { getLogPath, getTempDir } from './utils';
import { v4 as uuidv4 } from 'uuid';
import { fetchOpenAICompatibleModels, generateTextWithAI, generateImageWithAI, editImageWithAI, cloneVoiceWithElevenLabs, synthesizeWithElevenLabs, listElevenLabsVoices, synthesizeWithXiaomiTTS, listXiaomiVoices, cloneVoiceWithXiaomi } from './ai-utils';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function registerProviders(): void {
  const pm = ProviderManager.getInstance();
  pm.registerTTS(new EdgeTTSProvider());
  pm.registerASR(new WhisperProvider());
  pm.registerTalkingPhoto(new DIDProvider());
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'VideoForge Desktop',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIPC(): void {
  const pm = ProviderManager.getInstance();

  ipcMain.handle('providers:get', () => pm.getProviderSummary());

  ipcMain.handle('task:create', async (_event, params) => {
    const id = uuidv4();
    const now = Date.now();
    const task = {
      id,
      mode: params.mode,
      status: 'pending',
      scriptText: params.scriptText || '',
      avatarPath: params.avatarPath || null,
      audioPath: params.audioPath || null,
      talkingPhotoProviderId: params.talkingPhotoProviderId,
      ttsProviderId: params.ttsProviderId || null,
      asrProviderId: params.asrProviderId || null,
      talkingPhotoConfig: JSON.stringify(params.talkingPhotoConfig || {}),
      ttsConfig: JSON.stringify(params.ttsConfig || {}),
      asrConfig: JSON.stringify(params.asrConfig || {}),
      createdAt: now,
      updatedAt: now,
      logFilePath: getLogPath(id)
    };

    await insertTask(task);

    enqueueTask(id, params.mode, {
      scriptText: params.scriptText,
      avatarPath: params.avatarPath,
      audioPath: params.audioPath,
      talkingPhotoProviderId: params.talkingPhotoProviderId,
      ttsProviderId: params.ttsProviderId,
      asrProviderId: params.asrProviderId,
      talkingPhotoConfig: params.talkingPhotoConfig || {},
      ttsConfig: params.ttsConfig || {},
      asrConfig: params.asrConfig || {},
      onProgress: (data: any) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('task:progress', { taskId: id, ...data });
        }
      }
    });

    return id;
  });

  ipcMain.handle('tasks:get', async () => getAllTasks());

  ipcMain.handle('task:get', async (_event, id: string) => getTask(id));

  ipcMain.handle('task:cancel', async (_event, id: string) => {
    await updateTask(id, { status: 'cancelled' });
    return true;
  });

  ipcMain.handle('settings:get', async () => {
    const sqlite = await getDb();
    const stmt = sqlite.prepare('SELECT key, value FROM settings');
    stmt.bind();

    const settings: Record<string, unknown> = {};
    while (stmt.step()) {
      const row = stmt.getAsObject() as { key?: string; value?: string };
      const rawValue = row.value ?? null;

      if (typeof rawValue === 'string') {
        try {
          settings[row.key ?? ''] = JSON.parse(rawValue);
        } catch {
          settings[row.key ?? ''] = rawValue;
        }
      } else {
        settings[row.key ?? ''] = rawValue;
      }
    }

    stmt.free();
    return settings;
  });

  ipcMain.handle('settings:save', async (_event, key: string, value: string) => {
    await saveSetting(key, value);
    return true;
  });

  ipcMain.handle('dialog:openFile', async (_event, options?: any) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options?.filters || []
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('shell:reveal', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // AI Services
  ipcMain.handle('ai_services:get', async () => getAllAiServices());

  ipcMain.handle('ai_services:save', async (_event, service: any) => {
    const now = Date.now();
    const id = service.id || uuidv4();
    await upsertAiService({
      id,
      name: service.name,
      type: service.type,
      apiKey: service.apiKey || '',
      endpoint: service.endpoint || '',
      model: service.model || '',
      modelsList: service.modelsList ? JSON.stringify(service.modelsList) : '[]',
      isDefault: service.isDefault ? 1 : 0,
      protocol: service.protocol || 'chat_completions',
      userAgent: service.userAgent || 'VideoForge/1.0',
      enabled: service.enabled !== false ? 1 : 0,
      createdAt: service.createdAt || now,
      updatedAt: now
    });
    return id;
  });

  ipcMain.handle('ai_services:delete', async (_event, id: string) => {
    await deleteAiService(id);
    return true;
  });

  ipcMain.handle('ai_services:fetch_models', async (_event, params: { apiKey: string; endpoint: string }) => {
    try {
      const models = await fetchOpenAICompatibleModels(params.apiKey, params.endpoint);
      return { success: true, models };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ai:text_generate', async (_event, params: { serviceId: string; prompt: string; systemPrompt?: string }) => {
    const services = await getAllAiServices();
    const service = services.find((s: any) => s.id === params.serviceId);
    if (!service) throw new Error('AI service not found. Please configure it in Settings.');
    if (!service.api_key) throw new Error('API Key not configured for this service.');
    return generateTextWithAI(service.api_key, service.endpoint, service.model, params.prompt, params.systemPrompt);
  });

  ipcMain.handle('ai:image_generate', async (_event, params: { serviceId: string; prompt: string; size?: string }) => {
    const services = await getAllAiServices();
    const service = services.find((s: any) => s.id === params.serviceId);
    if (!service) throw new Error('AI service not found. Please configure it in Settings.');
    if (!service.api_key) throw new Error('API Key not configured for this service.');
    return generateImageWithAI(service.api_key, service.endpoint, service.model, params.prompt, { size: params.size });
  });

  ipcMain.handle('ai:image_edit', async (_event, params: { serviceId: string; prompt: string; imagePath: string; maskPath?: string }) => {
    const services = await getAllAiServices();
    const service = services.find((s: any) => s.id === params.serviceId);
    if (!service) throw new Error('AI service not found. Please configure it in Settings.');
    if (!service.api_key) throw new Error('API Key not configured for this service.');
    return editImageWithAI(service.api_key, service.endpoint, service.model, params.prompt, params.imagePath, params.maskPath);
  });

  ipcMain.handle('ai:list_voices', async (_event, params: { serviceId: string }) => {
    const services = await getAllAiServices();
    const service = services.find((s: any) => s.id === params.serviceId);
    if (!service) throw new Error('Voice service not found.');
    if (!service.api_key) throw new Error('API Key not configured for this service.');
    const isElevenLabs = (service.endpoint || '').includes('elevenlabs');
    if (isElevenLabs) return listElevenLabsVoices(service.api_key);
    return listXiaomiVoices(service.api_key, service.endpoint);
  });

  ipcMain.handle('ai:voice_clone', async (_event, params: { serviceId: string; name: string; description: string; audioPaths: string[] }) => {
    const services = await getAllAiServices();
    const service = services.find((s: any) => s.id === params.serviceId);
    if (!service) throw new Error('Voice service not found.');
    if (!service.api_key) throw new Error('API Key not configured for this service.');
    const isElevenLabs = (service.endpoint || '').includes('elevenlabs');
    if (isElevenLabs) return cloneVoiceWithElevenLabs(service.api_key, params.name, params.description, params.audioPaths);
    return cloneVoiceWithXiaomi(service.api_key, service.endpoint, params.name, params.audioPaths);
  });

  ipcMain.handle('ai:voice_synthesize', async (_event, params: { serviceId: string; voiceId: string; text: string }) => {
    const services = await getAllAiServices();
    const service = services.find((s: any) => s.id === params.serviceId);
    if (!service) throw new Error('Voice service not found.');
    if (!service.api_key) throw new Error('API Key not configured for this service.');
    const outputPath = join(getTempDir(), `voice-${uuidv4()}.mp3`);
    const isElevenLabs = (service.endpoint || '').includes('elevenlabs');
    if (isElevenLabs) {
      await synthesizeWithElevenLabs(service.api_key, params.voiceId, params.text, outputPath, service.model || undefined);
    } else {
      await synthesizeWithXiaomiTTS(service.api_key, service.endpoint, params.text, params.voiceId, outputPath);
    }
    return outputPath;
  });
}

app.whenReady().then(async () => {
  try {
    logToFile('App starting...');
    await initDatabase();
    logToFile('Database initialized');
    registerProviders();
    logToFile('Providers registered');
    registerIPC();
    logToFile('IPC registered');
    createWindow();
    logToFile('Window created');

  app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error: any) {
    logToFile('Startup error: ' + (error?.stack || error));
    console.error('Startup error:', error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
