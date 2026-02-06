import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs';
import { initializeDatabase, closeDatabase } from '../database/db';
import { InterviewRepository } from '../database/repositories/InterviewRepository';
import { JobRepository } from '../database/repositories/JobRepository';
import { SettingsRepository } from '../database/repositories/SettingsRepository';
import { PersonaRepository } from '../database/repositories/PersonaRepository';
import { MCPManager } from '../mcp/MCPManager';
import { InterviewService } from '../services/InterviewService';

// Define types for our repositories and services
let mainWindow: BrowserWindow | null = null;
let mcpManager: MCPManager | null = null;

// Repositories
let interviewRepo: InterviewRepository;
let jobRepo: JobRepository;
let settingsRepo: SettingsRepository;
let personaRepo: PersonaRepository;

// Services
let interviewService: InterviewService;

// Audio recordings directory
let audioRecordingsPath: string;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: process.env.NODE_ENV === 'development'
        ? path.join(__dirname, '../../dist/electron/src/electron_app/preload.js')
        : path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#ffffff',
    show: false,
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    // Try multiple ports in case 5173 is in use
    const tryLoadDev = async () => {
      const ports = [5173, 5174, 5175, 5176];
      for (const port of ports) {
        const devURL = `http://localhost:${port}`;
        try {
          // Simple check if the port responds
          const http = await import('http');
          await new Promise<void>((resolve, reject) => {
            const req = http.get(devURL, (res) => {
              console.log(`✓ Vite dev server found on port ${port}`);
              mainWindow?.loadURL(devURL);
              mainWindow?.webContents.openDevTools();
              resolve();
            });
            req.on('error', reject);
            req.setTimeout(500, reject);
          });
          return; // Success, exit function
        } catch (err) {
          console.log(`✗ Port ${port} not available, trying next...`);
        }
      }
      console.error('❌ Could not find Vite dev server on any port. Please ensure "npm run dev:react" is running.');
    };
    
    tryLoadDev().catch(err => {
      console.error('Failed to load dev server:', err);
    });
  } else {
    // In production, __dirname is: dist/electron/src/electron_app/
    // We need to go up 4 levels to reach the app root, then into dist/renderer/
    const htmlPath = path.join(__dirname, '../../../../dist/renderer/index.html');
    console.log('Loading production HTML from:', htmlPath);
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeApp(): Promise<void> {
  try {
    // Initialize database (now async with JSON storage)
    await initializeDatabase();
    
    // Initialize repositories
    interviewRepo = new InterviewRepository();
    jobRepo = new JobRepository();
    settingsRepo = new SettingsRepository();
    personaRepo = new PersonaRepository();
    
    // Setup audio recordings directory
    const userDataPath = app.getPath('userData');
    audioRecordingsPath = path.join(userDataPath, 'audio_recordings');
    if (!fs.existsSync(audioRecordingsPath)) {
      fs.mkdirSync(audioRecordingsPath, { recursive: true });
    }
    
    // Initialize services
    const interviewerSettings = await settingsRepo.getInterviewerSettings();
    interviewService = new InterviewService(interviewerSettings, interviewRepo);
    console.log('Interview Service initialized');
    
    // Initialize MCP Manager
    mcpManager = new MCPManager();
    await mcpManager.initialize();
    
    console.log('Application initialized successfully');
    console.log('Audio recordings will be saved to:', audioRecordingsPath);
  } catch (error) {
    console.error('Failed to initialize application:', error);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  await initializeApp();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDatabase();
  if (mcpManager) {
    mcpManager.shutdown();
  }
});

// IPC Handlers - Interview Operations
ipcMain.handle('interview:start', async (event: IpcMainInvokeEvent, config: any) => {
  try {
    const interview = await interviewRepo.create(config);
    await interviewService.startInterview(interview.id, config);
    return interview;
  } catch (error) {
    console.error('Failed to start interview:', error);
    throw error;
  }
});

ipcMain.handle('interview:end', async (event: IpcMainInvokeEvent, interviewId: string) => {
  try {
    const feedback = await interviewService.endInterview(interviewId);
    const interview = await interviewRepo.findById(interviewId);
    
    if (interview) {
      const endedAt = new Date().toISOString();
      const duration = Math.floor(
        (new Date(endedAt).getTime() - new Date(interview.startedAt).getTime()) / 1000
      );
      
      return await interviewRepo.update(interviewId, {
        status: 'completed',
        endedAt,
        duration,
        feedback,
      });
    }
    
    return null;
  } catch (error) {
    console.error('Failed to end interview:', error);
    throw error;
  }
});

ipcMain.handle('interview:sendMessage', async (event: IpcMainInvokeEvent, interviewId: string, message: string) => {
  try {
    const response = await interviewService.sendMessage(interviewId, message);
    
    // Update interview transcript
    const interview = await interviewRepo.findById(interviewId);
    if (interview) {
      // Messages are already added to session in InterviewService, 
      // but we need to persist them to the repository
      // The sendMessage method in InterviewService returns the response string,
      // so we need to construct the messages here for persistence or update InterviewService to return them
      
      // Let's fetch the updated transcript from the service if possible, 
      // but InterviewService keeps state in memory. 
      // Ideally InterviewService should update the repo itself or return the full messages.
      // For now, let's reconstruct the messages to save them to the repo as before
      
      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: message,
        timestamp: new Date().toISOString(),
      };
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: response,
        timestamp: new Date().toISOString(),
      };
      
      interview.transcript.push(userMessage, assistantMessage);
      await interviewRepo.update(interviewId, { transcript: interview.transcript });
      
      return assistantMessage;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
});

ipcMain.handle('interview:get', async (event: IpcMainInvokeEvent, interviewId: string) => {
  try {
    return await interviewRepo.findById(interviewId);
  } catch (error) {
    console.error('Failed to get interview:', error);
    throw error;
  }
});

ipcMain.handle('interview:getAll', async () => {
  try {
    return await interviewRepo.findAll();
  } catch (error) {
    console.error('Failed to get all interviews:', error);
    throw error;
  }
});

ipcMain.handle('interview:delete', async (event: IpcMainInvokeEvent, interviewId: string) => {
  try {
    return await interviewRepo.delete(interviewId);
  } catch (error) {
    console.error('Failed to delete interview:', error);
    throw error;
  }
});

ipcMain.handle('interview:updateTranscript', async (event: IpcMainInvokeEvent, interviewId: string, transcript: any[]) => {
  try {
    return await interviewRepo.updateTranscript(interviewId, transcript);
  } catch (error) {
    console.error('Failed to update interview transcript:', error);
    throw error;
  }
});

// IPC Handlers - Job Operations
ipcMain.handle('job:create', async (event: IpcMainInvokeEvent, jobData: any) => {
  try {
    return await jobRepo.create(jobData);
  } catch (error) {
    console.error('Failed to create job:', error);
    throw error;
  }
});

ipcMain.handle('job:update', async (event: IpcMainInvokeEvent, jobId: string, updates: any) => {
  try {
    return await jobRepo.update(jobId, updates);
  } catch (error) {
    console.error('Failed to update job:', error);
    throw error;
  }
});

ipcMain.handle('job:get', async (event: IpcMainInvokeEvent, jobId: string) => {
  try {
    return await jobRepo.findById(jobId);
  } catch (error) {
    console.error('Failed to get job:', error);
    throw error;
  }
});

ipcMain.handle('job:getAll', async () => {
  try {
    return await jobRepo.findAll();
  } catch (error) {
    console.error('Failed to get all jobs:', error);
    throw error;
  }
});

ipcMain.handle('job:delete', async (event: IpcMainInvokeEvent, jobId: string) => {
  try {
    return await jobRepo.delete(jobId);
  } catch (error) {
    console.error('Failed to delete job:', error);
    throw error;
  }
});

// IPC Handlers - Settings Operations
ipcMain.handle('settings:get', async () => {
  try {
    return await settingsRepo.getUserSettings();
  } catch (error) {
    console.error('Failed to get settings:', error);
    throw error;
  }
});

ipcMain.handle('settings:update', async (event: IpcMainInvokeEvent, updates: any) => {
  try {
    return await settingsRepo.updateUserSettings(updates);
  } catch (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
});

ipcMain.handle('settings:getInterviewer', async () => {
  try {
    return await settingsRepo.getInterviewerSettings();
  } catch (error) {
    console.error('Failed to get interviewer settings:', error);
    throw error;
  }
});

ipcMain.handle('settings:updateInterviewer', async (event: IpcMainInvokeEvent, updates: any) => {
  try {
    const updated = await settingsRepo.updateInterviewerSettings(updates);
    // Reinitialize interview service with new settings
    interviewService = new InterviewService(updated, interviewRepo);
    return updated;
  } catch (error) {
    console.error('Failed to update interviewer settings:', error);
    throw error;
  }
});

// IPC Handlers - Model Operations
ipcMain.handle('model:getAvailable', async () => {
  try {
    return await interviewService.getAvailableModels();
  } catch (error) {
    console.error('Failed to get available models:', error);
    throw error;
  }
});

ipcMain.handle('model:testConnection', async (event: IpcMainInvokeEvent, modelId: string) => {
  try {
    return await interviewService.testModelConnection(modelId);
  } catch (error) {
    console.error('Failed to test model connection:', error);
    return false;
  }
});

ipcMain.handle('model:load', async (event: IpcMainInvokeEvent, modelId: string) => {
  try {
    return await interviewService.loadModel(modelId);
  } catch (error) {
    console.error('Failed to load model:', error);
    return false;
  }
});

ipcMain.handle('model:unload', async (event: IpcMainInvokeEvent, modelId: string) => {
  try {
    return await interviewService.unloadModel(modelId);
  } catch (error) {
    console.error('Failed to unload model:', error);
    return false;
  }
});

ipcMain.handle('model:pull', async (event: IpcMainInvokeEvent, modelId: string) => {
  try {
    return await interviewService.pullModel(modelId);
  } catch (error) {
    console.error('Failed to pull model:', error);
    return false;
  }
});

ipcMain.handle('model:delete', async (event: IpcMainInvokeEvent, modelId: string) => {
  try {
    return await interviewService.deleteModel(modelId);
  } catch (error) {
    console.error('Failed to delete model:', error);
    return false;
  }
});

ipcMain.handle('model:refresh', async () => {
  try {
    return await interviewService.refreshModels();
  } catch (error) {
    console.error('Failed to refresh models:', error);
    throw error;
  }
});

// IPC Handlers - Server Operations
ipcMain.handle('server:checkHealth', async () => {
  try {
    return await interviewService.checkServerHealth();
  } catch (error) {
    console.error('Failed to check server health:', error);
    return false;
  }
});

ipcMain.handle('server:getStatus', async () => {
  try {
    // Basic check if we can connect
    const isHealthy = await interviewService.checkServerHealth();
    return {
      isRunning: isHealthy,
      url: 'http://localhost:8000' // Default URL
    };
  } catch (error) {
    console.error('Failed to get server status:', error);
    return { isRunning: false, url: 'http://localhost:8000' };
  }
});

ipcMain.handle('server:getSystemInfo', async () => {
  try {
    return await interviewService.getSystemInfo();
  } catch (error) {
    console.error('Failed to get system info:', error);
    return null;
  }
});

ipcMain.handle('server:getHealth', async () => {
  try {
    return await interviewService.getServerHealth();
  } catch (error) {
    console.error('Failed to get server health:', error);
    return null;
  }
});

// ===========================================
// IPC Handlers - Agent Personas
// ===========================================

ipcMain.handle('persona:create', async (event: IpcMainInvokeEvent, personaData: any) => {
  try {
    return await personaRepo.create(personaData);
  } catch (error) {
    console.error('Failed to create persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:getAll', async () => {
  try {
    return await personaRepo.findAll();
  } catch (error) {
    console.error('Failed to get all personas:', error);
    throw error;
  }
});

ipcMain.handle('persona:getById', async (event: IpcMainInvokeEvent, personaId: string) => {
  try {
    return await personaRepo.findById(personaId);
  } catch (error) {
    console.error('Failed to get persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:update', async (event: IpcMainInvokeEvent, personaId: string, updates: any) => {
  try {
    return await personaRepo.update(personaId, updates);
  } catch (error) {
    console.error('Failed to update persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:delete', async (event: IpcMainInvokeEvent, personaId: string) => {
  try {
    return await personaRepo.delete(personaId);
  } catch (error) {
    console.error('Failed to delete persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:setDefault', async (event: IpcMainInvokeEvent, personaId: string) => {
  try {
    return await personaRepo.setDefault(personaId);
  } catch (error) {
    console.error('Failed to set default persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:getDefault', async () => {
  try {
    return await personaRepo.findDefault();
  } catch (error) {
    console.error('Failed to get default persona:', error);
    return null;
  }
});

// ===========================================
// IPC Handlers - Audio Services
// ===========================================

ipcMain.handle('audio:saveRecording', async (event: IpcMainInvokeEvent, audioData: any) => {
  try {
    const { interviewId, messageId, audioBlob } = audioData;
    const filename = `${interviewId}_${messageId}_${Date.now()}.webm`;
    const filepath = path.join(audioRecordingsPath, filename);
    
    // Convert base64 to buffer and save
    const buffer = Buffer.from(audioBlob, 'base64');
    fs.writeFileSync(filepath, buffer);
    
    return { success: true, filepath };
  } catch (error) {
    console.error('Failed to save audio recording:', error);
    throw error;
  }
});

ipcMain.handle('audio:getRecordingsPath', async () => {
  return audioRecordingsPath;
});

ipcMain.handle('audio:deleteRecording', async (event: IpcMainInvokeEvent, filepath: string) => {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Failed to delete audio recording:', error);
    throw error;
  }
});

// IPC Handlers - MCP Operations
ipcMain.handle('mcp:getServers', async () => {
  try {
    return mcpManager?.getServers() || [];
  } catch (error) {
    console.error('Failed to get MCP servers:', error);
    throw error;
  }
});

ipcMain.handle('mcp:updateServers', async (event: IpcMainInvokeEvent, servers: any[]) => {
  try {
    await mcpManager?.updateServers(servers);
  } catch (error) {
    console.error('Failed to update MCP servers:', error);
    throw error;
  }
});
