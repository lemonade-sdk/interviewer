import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { initializeDatabase, closeDatabase } from '../database/db';
import { InterviewRepository } from '../database/repositories/InterviewRepository';
import { JobRepository } from '../database/repositories/JobRepository';
import { SettingsRepository } from '../database/repositories/SettingsRepository';
import { PersonaRepository } from '../database/repositories/PersonaRepository';
import { MCPManager } from '../mcp/MCPManager';
import { DocumentRepository } from '../database/repositories/DocumentRepository';
import { InterviewService } from '../services/InterviewService';
import { PersonaGeneratorService, PersonaGenerationInput } from '../services/PersonaGeneratorService';

// Define types for our repositories and services
let mainWindow: BrowserWindow | null = null;
let mcpManager: MCPManager | null = null;

// Repositories
let interviewRepo: InterviewRepository;
let jobRepo: JobRepository;
let settingsRepo: SettingsRepository;
let personaRepo: PersonaRepository;
let documentRepo: DocumentRepository;

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
      // preload.js is always compiled to the same directory as main.js
      preload: path.join(__dirname, 'preload.js'),
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
            const req = http.get(devURL, (_res) => {
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
    // __dirname is: dist/electron/src/electron_app/
    // Go up 4 levels to app root, then into dist/renderer/
    const htmlPath = path.join(__dirname, '..', '..', '..', '..', 'dist', 'renderer', 'index.html');
    console.log('Loading production HTML from:', htmlPath);
    console.log('App is packaged:', app.isPackaged);
    console.log('Resolved path:', path.resolve(htmlPath));
    
    if (!fs.existsSync(htmlPath)) {
      console.error('ERROR: Production HTML not found at:', htmlPath);
      console.error('__dirname is:', __dirname);
    }
    
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
    documentRepo = new DocumentRepository();
    
    // Setup directories
    const userDataPath = app.getPath('userData');
    
    audioRecordingsPath = path.join(userDataPath, 'audio_recordings');
    if (!fs.existsSync(audioRecordingsPath)) {
      fs.mkdirSync(audioRecordingsPath, { recursive: true });
    }

    const documentsPath = path.join(userDataPath, 'documents');
    if (!fs.existsSync(documentsPath)) {
      fs.mkdirSync(documentsPath, { recursive: true });
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

    // Pre-load audio models (Whisper + Kokoro) so both are ready for
    // real-time ASR and TTS without evicting each other mid-interview.
    // This runs in the background — does not block window creation.
    interviewService.getLemonadeClient().preloadAudioModels().catch((err) => {
      console.error('Background audio model preload failed:', err);
    });
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
ipcMain.handle('interview:start', async (_event: IpcMainInvokeEvent, config: any, personaId?: string) => {
  try {
    const interview = await interviewRepo.create(config);

    // If a persona ID is provided, look it up and pass it to the interview service
    let persona = null;
    if (personaId) {
      persona = await personaRepo.findById(personaId);
    }

    await interviewService.startInterview(interview.id, config, persona);
    return interview;
  } catch (error) {
    console.error('Failed to start interview:', error);
    throw error;
  }
});

ipcMain.handle('interview:end', async (_event: IpcMainInvokeEvent, interviewId: string) => {
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

ipcMain.handle('interview:sendMessage', async (_event: IpcMainInvokeEvent, interviewId: string, message: string) => {
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

// ─── Streaming variant: tokens are forwarded to the renderer in real-time ───
ipcMain.handle(
  'interview:sendMessageStreaming',
  async (event: IpcMainInvokeEvent, interviewId: string, message: string) => {
    try {
      // Forward each token to the renderer via IPC event
      const response = await interviewService.sendMessageStreaming(
        interviewId,
        message,
        (token: string) => {
          event.sender.send('llm:token', token);
        },
      );

      // Persist to DB (same logic as non-streaming path)
      const interview = await interviewRepo.findById(interviewId);
      if (interview) {
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

        // Signal stream end
        event.sender.send('llm:done', response);

        return assistantMessage;
      }

      event.sender.send('llm:done', response);
      return null;
    } catch (error) {
      console.error('Failed to send streaming message:', error);
      event.sender.send('llm:error', (error as Error).message);
      throw error;
    }
  },
);

// ─── Detailed feedback generation: grades each Q/A pair individually ───
ipcMain.handle('feedback:generate', async (event: IpcMainInvokeEvent, interviewId: string) => {
  try {
    const interview = await interviewRepo.findById(interviewId);
    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`);
    }

    const feedback = await interviewService.generateDetailedFeedback(
      interviewId,
      interview.transcript,
      (progressData) => {
        event.sender.send('feedback:progress', progressData);
      },
    );

    // Persist feedback to DB
    await interviewRepo.update(interviewId, { feedback });

    return feedback;
  } catch (error) {
    console.error('Failed to generate feedback:', error);
    throw error;
  }
});

ipcMain.handle('interview:get', async (_event: IpcMainInvokeEvent, interviewId: string) => {
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

ipcMain.handle('interview:delete', async (_event: IpcMainInvokeEvent, interviewId: string) => {
  try {
    return await interviewRepo.delete(interviewId);
  } catch (error) {
    console.error('Failed to delete interview:', error);
    throw error;
  }
});

ipcMain.handle('interview:updateTranscript', async (_event: IpcMainInvokeEvent, interviewId: string, transcript: any[]) => {
  try {
    return await interviewRepo.updateTranscript(interviewId, transcript);
  } catch (error) {
    console.error('Failed to update interview transcript:', error);
    throw error;
  }
});

// IPC Handlers - Job Operations
ipcMain.handle('job:create', async (_event: IpcMainInvokeEvent, jobData: any) => {
  try {
    return await jobRepo.create(jobData);
  } catch (error) {
    console.error('Failed to create job:', error);
    throw error;
  }
});

ipcMain.handle('job:update', async (_event: IpcMainInvokeEvent, jobId: string, updates: any) => {
  try {
    return await jobRepo.update(jobId, updates);
  } catch (error) {
    console.error('Failed to update job:', error);
    throw error;
  }
});

ipcMain.handle('job:get', async (_event: IpcMainInvokeEvent, jobId: string) => {
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

ipcMain.handle('job:delete', async (_event: IpcMainInvokeEvent, jobId: string) => {
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

ipcMain.handle('settings:update', async (_event: IpcMainInvokeEvent, updates: any) => {
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

ipcMain.handle('settings:updateInterviewer', async (_event: IpcMainInvokeEvent, updates: any) => {
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

ipcMain.handle('model:testConnection', async (_event: IpcMainInvokeEvent, modelId: string) => {
  try {
    return await interviewService.testModelConnection(modelId);
  } catch (error) {
    console.error('Failed to test model connection:', error);
    return false;
  }
});

ipcMain.handle('model:load', async (_event: IpcMainInvokeEvent, modelId: string, options?: {
  ctx_size?: number;
  llamacpp_backend?: 'vulkan' | 'rocm' | 'metal' | 'cpu';
  llamacpp_args?: string;
  save_options?: boolean;
}) => {
  try {
    return await interviewService.loadModel(modelId, options);
  } catch (error) {
    console.error('Failed to load model:', error);
    return false;
  }
});

ipcMain.handle('model:unload', async (_event: IpcMainInvokeEvent, modelId: string) => {
  try {
    return await interviewService.unloadModel(modelId);
  } catch (error) {
    console.error('Failed to unload model:', error);
    return false;
  }
});

ipcMain.handle('model:pull', async (_event: IpcMainInvokeEvent, modelId: string) => {
  try {
    return await interviewService.pullModel(modelId);
  } catch (error) {
    console.error('Failed to pull model:', error);
    return false;
  }
});

ipcMain.handle('model:pullStreaming', async (event: IpcMainInvokeEvent, modelId: string) => {
  try {
    const result = await interviewService.pullModelStreaming(modelId, (progressData) => {
      // Relay each SSE progress event to the renderer process
      try {
        event.sender.send('pull:progress', progressData);
      } catch {
        // sender may have been destroyed if window closed during download
      }
    });
    return result;
  } catch (error) {
    console.error('Failed to pull model (streaming):', error);
    return false;
  }
});

ipcMain.handle('model:delete', async (_event: IpcMainInvokeEvent, modelId: string) => {
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

ipcMain.handle('model:listAll', async () => {
  try {
    return await interviewService.listAllModels();
  } catch (error) {
    console.error('Failed to list all models:', error);
    return [];
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

ipcMain.handle('server:getWebSocketPort', async () => {
  try {
    return await interviewService.getWebSocketPort();
  } catch (error) {
    console.error('Failed to get WebSocket port:', error);
    return null;
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

ipcMain.handle('server:checkInstallation', async () => {
  try {
    const isWindows = process.platform === 'win32';

    // Primary check: look for lemonade-server.exe at the known install location
    // Windows: %LOCALAPPDATA%\lemonade_server\bin\lemonade-server.exe
    if (isWindows) {
      const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
      const binaryPath = path.join(localAppData, 'lemonade_server', 'bin', 'lemonade-server.exe');

      if (fs.existsSync(binaryPath)) {
        // Found at the known location — try to get version
        const version = await new Promise<string | null>((resolve) => {
          exec(`"${binaryPath}" --version`, (error, stdout) => {
            resolve(error ? null : stdout.trim());
          });
        });

        return {
          installed: true,
          version: version,
          binaryPath: binaryPath,
        };
      }
    }

    // Fallback: check if lemonade-server is on PATH
    const pathCmd = isWindows ? 'where lemonade-server' : 'which lemonade-server';
    const onPath = await new Promise<boolean>((resolve) => {
      exec(pathCmd, (error) => resolve(!error));
    });

    if (onPath) {
      const version = await new Promise<string | null>((resolve) => {
        exec('lemonade-server --version', (error, stdout) => {
          resolve(error ? null : stdout.trim());
        });
      });

      return {
        installed: true,
        version: version,
        binaryPath: null,
      };
    }

    // Not found anywhere
    return {
      installed: false,
      version: null,
      binaryPath: null,
    };
  } catch (error) {
    console.error('Failed to check lemonade-server installation:', error);
    return {
      installed: false,
      version: null,
      binaryPath: null,
    };
  }
});

// ===========================================
// IPC Handlers - Agent Personas
// ===========================================

ipcMain.handle('persona:create', async (_event: IpcMainInvokeEvent, personaData: any) => {
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

ipcMain.handle('persona:getById', async (_event: IpcMainInvokeEvent, personaId: string) => {
  try {
    return await personaRepo.findById(personaId);
  } catch (error) {
    console.error('Failed to get persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:update', async (_event: IpcMainInvokeEvent, personaId: string, updates: any) => {
  try {
    return await personaRepo.update(personaId, updates);
  } catch (error) {
    console.error('Failed to update persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:delete', async (_event: IpcMainInvokeEvent, personaId: string) => {
  try {
    return await personaRepo.delete(personaId);
  } catch (error) {
    console.error('Failed to delete persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:setDefault', async (_event: IpcMainInvokeEvent, personaId: string) => {
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
// IPC Handlers - Persona Generation
// ===========================================

ipcMain.handle('persona:generate', async (_event: IpcMainInvokeEvent, input: {
  jobDescriptionText: string;
  resumeText: string;
  interviewType: string;
  company: string;
  position: string;
}) => {
  try {
    const lemonadeClient = interviewService.getLemonadeClient();
    const generator = new PersonaGeneratorService(lemonadeClient);

    const result = await generator.generatePersona(input as PersonaGenerationInput);

    // Persist the generated persona
    const savedPersona = await personaRepo.create({
      name: result.persona.name,
      description: result.persona.description,
      systemPrompt: result.persona.systemPrompt,
      interviewStyle: result.persona.interviewStyle,
      questionDifficulty: result.persona.questionDifficulty,
      isDefault: false,
    });

    return {
      persona: savedPersona,
      jobAnalysis: result.jobAnalysis,
      resumeAnalysis: result.resumeAnalysis,
    };
  } catch (error) {
    console.error('Failed to generate persona:', error);
    throw error;
  }
});

// ===========================================
// IPC Handlers - Audio Services
// ===========================================

ipcMain.handle('audio:saveRecording', async (_event: IpcMainInvokeEvent, audioData: any) => {
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

ipcMain.handle('audio:deleteRecording', async (_event: IpcMainInvokeEvent, filepath: string) => {
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

// ===========================================
// IPC Handlers - Document Operations
// ===========================================

ipcMain.handle('document:upload', async (_event: IpcMainInvokeEvent, data: { type: 'resume' | 'job_post'; fileName: string; fileData: string }) => {
  try {
    const { type, fileName, fileData } = data;

    // Save file to documents directory
    const userDataPath = app.getPath('userData');
    const documentsDir = path.join(userDataPath, 'documents');
    const ext = path.extname(fileName).toLowerCase();
    const safeFileName = `${type}_${Date.now()}${ext}`;
    const filePath = path.join(documentsDir, safeFileName);

    // Decode base64 file data and save
    const buffer = Buffer.from(fileData, 'base64');
    fs.writeFileSync(filePath, buffer);
    console.log(`Document saved: ${filePath} (${buffer.length} bytes)`);

    // Extract text from the document
    let extractedText = '';
    try {
      if (ext === '.pdf') {
        // pdf-parse v2.x API: class-based with PDFParse
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        await parser.load();
        const textResult = await parser.getText();
        extractedText = textResult.pages
          .map((page: any) => page.text)
          .join('\n');
      } else if (ext === '.docx') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } else if (ext === '.doc') {
        // .doc is a legacy format — store raw text extraction attempt
        extractedText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
      } else if (ext === '.txt') {
        extractedText = buffer.toString('utf-8');
      }
    } catch (parseError) {
      console.error(`Failed to extract text from ${fileName}:`, parseError);
      extractedText = `[Could not extract text from ${ext} file]`;
    }

    console.log(`Extracted ${extractedText.length} characters from ${fileName}`);

    // Determine MIME type
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
    };

    // Store in JSON data store
    const doc = await documentRepo.create({
      type,
      fileName,
      filePath,
      mimeType: mimeTypes[ext] || 'application/octet-stream',
      fileSize: buffer.length,
      extractedText,
    });

    return doc;
  } catch (error) {
    console.error('Failed to upload document:', error);
    throw error;
  }
});

ipcMain.handle('document:getAll', async (_event: IpcMainInvokeEvent, type?: string) => {
  try {
    if (type === 'resume' || type === 'job_post') {
      return await documentRepo.findByType(type);
    }
    return await documentRepo.findAll();
  } catch (error) {
    console.error('Failed to get documents:', error);
    throw error;
  }
});

ipcMain.handle('document:get', async (_event: IpcMainInvokeEvent, id: string) => {
  try {
    return await documentRepo.findById(id);
  } catch (error) {
    console.error('Failed to get document:', error);
    throw error;
  }
});

ipcMain.handle('document:getFileData', async (_event: IpcMainInvokeEvent, id: string) => {
  try {
    const doc = await documentRepo.findById(id);
    if (!doc || !fs.existsSync(doc.filePath)) {
      return null;
    }
    const buffer = fs.readFileSync(doc.filePath);
    return {
      base64: buffer.toString('base64'),
      mimeType: doc.mimeType,
      fileName: doc.fileName,
    };
  } catch (error) {
    console.error('Failed to get document file data:', error);
    return null;
  }
});

ipcMain.handle('document:delete', async (_event: IpcMainInvokeEvent, id: string) => {
  try {
    const doc = await documentRepo.findById(id);
    if (doc && fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }
    return await documentRepo.delete(id);
  } catch (error) {
    console.error('Failed to delete document:', error);
    throw error;
  }
});

ipcMain.handle('document:extractJobDetails', async (_event: IpcMainInvokeEvent, jobPostDocId: string) => {
  try {
    const doc = await documentRepo.findById(jobPostDocId);
    if (!doc || !doc.extractedText) {
      throw new Error('Job post document not found or has no extracted text.');
    }

    const lemonadeClient = interviewService.getLemonadeClient();
    // Truncate to ~4000 chars to keep prompt compact for small-context models
    const jobText = doc.extractedText.substring(0, 4000);
    const prompt = `/no_think
Analyze the following job posting and extract the key details. Return ONLY a valid JSON object with these exact fields:
- "title": A concise interview title (e.g. "Senior Software Engineer Interview")
- "company": The company name
- "position": The job title/position
- "interviewType": One of: "general", "technical", "behavioral", "system-design", "coding", "mixed"

<JOB_POSTING>
${jobText}
</JOB_POSTING>

Respond with ONLY the JSON object. No thinking, no explanation, no markdown fences.`;

    // DeepSeek-R1 and similar reasoning models consume a large number of tokens
    // on internal chain-of-thought (reasoning_content) *before* producing visible
    // output (content).  8192 gives ample room for reasoning + a small JSON object.
    const response = await lemonadeClient.sendMessage([
      {
        id: 'extract-system',
        role: 'system',
        content: 'You are a JSON extraction assistant. You ONLY output valid JSON objects. No markdown, no code fences, no explanations. No thinking or reasoning — output ONLY JSON.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'extract-user',
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      },
    ], { maxTokens: 8192 });

    // Robust multi-layered JSON extraction (matches PersonaGeneratorService pattern)
    // Reasoning models may wrap output in thinking text or markdown fences.
    let parsed: any = null;
    const cleaned = response.trim();

    // Layer 1: Direct JSON parse
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Layer 2: Strip markdown code fences
      const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) {
        try {
          parsed = JSON.parse(fenceMatch[1]);
        } catch { /* fall through */ }
      }

      // Layer 3: Find JSON object boundaries in the text
      if (!parsed) {
        const startIdx = cleaned.indexOf('{');
        const endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx > startIdx) {
          try {
            parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
          } catch { /* fall through */ }
        }
      }
    }

    if (!parsed) {
      console.error('Could not extract JSON from LLM response. Raw (first 500 chars):', cleaned.slice(0, 500));
      throw new Error('LLM response did not contain valid JSON.');
    }

    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      company: typeof parsed.company === 'string' ? parsed.company : '',
      position: typeof parsed.position === 'string' ? parsed.position : '',
      interviewType: typeof parsed.interviewType === 'string' ? parsed.interviewType : 'general',
    };
  } catch (error) {
    console.error('Failed to extract job details:', error);
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

ipcMain.handle('mcp:updateServers', async (_event: IpcMainInvokeEvent, servers: any[]) => {
  try {
    await mcpManager?.updateServers(servers);
  } catch (error) {
    console.error('Failed to update MCP servers:', error);
    throw error;
  }
});
