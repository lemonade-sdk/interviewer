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
import { PromptManager } from '../services/PromptManager';
import { StructuredExtractionService } from '../services/StructuredExtractionService';
import { PipelineLogger } from '../services/PipelineLogger';

// ─── File Logger ──────────────────────────────────────────────────────────────
// Intercepts all console.* calls and mirrors them to a dated log file in
// userData/logs/. This means every terminal log is also permanently saved
// inside the Electron app's data folder — no terminal required to debug.

function setupFileLogger(): string | null {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logFile = path.join(logDir, `app-${date}.log`);

    // Open a write stream (append so multiple runs accumulate in the same day file)
    const stream = fs.createWriteStream(logFile, { flags: 'a', encoding: 'utf8' });

    const fmt = (level: string, args: unknown[]): string => {
      const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
      const msg = args.map(a =>
        typeof a === 'string' ? a : JSON.stringify(a, null, 0)
      ).join(' ');
      return `[${ts}] [${level}] ${msg}\n`;
    };

    const write = (line: string) => { try { stream.write(line); } catch { /* non-fatal */ } };

    // Preserve originals for terminal output, then wrap
    const origLog   = console.log.bind(console);
    const origWarn  = console.warn.bind(console);
    const origError = console.error.bind(console);
    const origInfo  = console.info.bind(console);

    console.log   = (...a) => { origLog(...a);   write(fmt('LOG',   a)); };
    console.warn  = (...a) => { origWarn(...a);  write(fmt('WARN',  a)); };
    console.error = (...a) => { origError(...a); write(fmt('ERROR', a)); };
    console.info  = (...a) => { origInfo(...a);  write(fmt('INFO',  a)); };

    // Session separator so runs are easy to distinguish inside the file
    stream.write(`\n${'─'.repeat(80)}\n`);
    stream.write(`[APP START] ${new Date().toISOString()}  |  Electron ${process.versions.electron}  |  Node ${process.version}\n`);
    stream.write(`${'─'.repeat(80)}\n`);

    app.on('before-quit', () => { try { stream.end(); } catch { /* non-fatal */ } });

    return logFile;
  } catch (err) {
    // Never crash the app because of logging
    console.error('Failed to set up file logger:', err);
    return null;
  }
}

// Start capturing immediately — before any other code runs
const activeLogFile = setupFileLogger();
if (activeLogFile) {
  console.log(`[FileLogger] Writing all logs to: ${activeLogFile}`);
}

// ─────────────────────────────────────────────────────────────────────────────

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
let extractionService: StructuredExtractionService;

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

    // Initialize pipeline logger (writes NDJSON session logs to userData/pipeline-logs/)
    PipelineLogger.init(userDataPath);

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
    
    // Initialize extraction service for document processing
    extractionService = new StructuredExtractionService(interviewService.getLemonadeClient(), interviewerSettings.extractionModelName);
    console.log('Extraction Service initialized');
    
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

app.on('before-quit', (event) => {
  closeDatabase();
  if (mcpManager) {
    mcpManager.shutdown();
  }

  // Unload all models from Lemonade Server so VRAM is freed immediately.
  // before-quit is synchronous, so we preventDefault, do async cleanup,
  // then call app.exit(). A 3-second hard timeout prevents the app from
  // hanging if the server is unreachable.
  if (interviewService) {
    event.preventDefault();
    const timer = setTimeout(() => {
      console.warn('[App] Model unload timed out — forcing exit');
      app.exit(0);
    }, 3000);
    interviewService.getLemonadeClient().unloadModel()
      .then(() => console.log('[App] Models unloaded from Lemonade Server'))
      .catch((err) => console.error('[App] Failed to unload models on quit:', err))
      .finally(() => { clearTimeout(timer); app.exit(0); });
  }
});

// IPC Handlers - Interview Operations
ipcMain.handle('interview:start', async (_event: IpcMainInvokeEvent, config: any, personaId?: string, jobPostDocId?: string, resumeDocId?: string) => {
  try {
    const interview = await interviewRepo.create(config);

    // If a persona ID is provided, look it up and pass it to the interview service
    let persona = null;
    if (personaId) {
      persona = await personaRepo.findById(personaId);
    }

    // Read user-configured interview duration so the LLM prompt reflects the actual session length.
    // Guard: old settings stored seconds (e.g. 3600) instead of minutes. Values above 300 (5 hours)
    // are almost certainly seconds — convert by dividing by 60, capped to a reasonable 120 min.
    const userSettings = await settingsRepo.getUserSettings();
    const rawDuration = userSettings.defaultInterviewDuration ?? 30;
    const totalInterviewMinutes = rawDuration > 300 ? Math.min(Math.round(rawDuration / 60), 120) : rawDuration;
    if (rawDuration > 300) {
      console.warn(`[InterviewStart] defaultInterviewDuration=${rawDuration} looks like seconds — treating as ${totalInterviewMinutes} minutes`);
    }
    const timerConfig = { totalInterviewMinutes, wrapUpThresholdMinutes: 5 };

    // Fetch document text so the interview system prompt has real JD + resume content
    let jobDescription = '';
    let resume = '';
    if (jobPostDocId) {
      const jobDoc = await documentRepo.findById(jobPostDocId);
      jobDescription = jobDoc?.extractedText ?? '';
      console.log(`[InterviewStart] Job description loaded: ${jobDescription.length} chars from doc ${jobPostDocId}`);
    }
    if (resumeDocId) {
      const resumeDoc = await documentRepo.findById(resumeDocId);
      resume = resumeDoc?.extractedText ?? '';
      console.log(`[InterviewStart] Resume loaded: ${resume.length} chars from doc ${resumeDocId}`);
    }

    const greeting = await interviewService.startInterview(interview.id, config, persona, timerConfig, { jobDescription, resume });
    // Return interview record enriched with the greeting so the UI can display+speak it directly
    return { ...interview, _greeting: greeting };
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

    const existingFeedback = (interview as any).feedback;

    // Return cached result if feedback was already generated — avoid burning LLM
    // tokens on every page visit. The user can force regeneration if needed.
    if (existingFeedback?.questionFeedbacks?.length > 0) {
      console.log(`[feedback:generate] Cache hit — returning stored feedback (${existingFeedback.questionFeedbacks.length} questions). Skipping regeneration.`);
      return existingFeedback;
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
    // Reinitialize extraction service with updated client
    extractionService = new StructuredExtractionService(interviewService.getLemonadeClient(), updated.extractionModelName);
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

    // Persist the generated persona (including structured arc fields)
    const savedPersona = await personaRepo.create({
      name: result.persona.name,
      description: result.persona.description,
      systemPrompt: result.persona.systemPrompt,
      interviewStyle: result.persona.interviewStyle,
      questionDifficulty: result.persona.questionDifficulty,
      isDefault: false,
      personaRole: result.persona.personaRole,
      q1Topic: result.persona.q1Topic,
      q2Topic: result.persona.q2Topic,
      q3Topic: result.persona.q3Topic,
      q4Topic: result.persona.q4Topic,
      q5Topic: result.persona.q5Topic,
      primaryProbeArea: result.persona.primaryProbeArea,
      mustCoverTopic1: result.persona.mustCoverTopic1,
      mustCoverTopic2: result.persona.mustCoverTopic2,
      mustCoverTopic3: result.persona.mustCoverTopic3,
      validateClaim1: result.persona.validateClaim1,
      validateClaim2: result.persona.validateClaim2,
      watchSignal1: result.persona.watchSignal1,
      watchSignal2: result.persona.watchSignal2,
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
    // Use up to 8000 chars — model is loaded with 16K context so this is safe
    const jobText = doc.extractedText.substring(0, 8000);
    const systemPromptContent = PromptManager.getInstance().getDocumentExtractionSystemPrompt();
    const userPromptContent = PromptManager.getInstance().getDocumentExtractionUserPrompt({ jobText });

    console.log(`[JobExtract] ── Stage 1 ──────────────────────────────────────`);
    console.log(`[JobExtract] Full doc text: ${doc.extractedText.length} chars, using first ${jobText.length} chars`);
    console.log(`[JobExtract] System prompt: ${systemPromptContent.length} chars`);
    console.log(`[JobExtract] User prompt:   ${userPromptContent.length} chars (includes job text)`);
    console.log(`[JobExtract] Total chars sent to LLM: ~${systemPromptContent.length + userPromptContent.length}`);
    console.log(`[JobExtract] Job text preview (first 200 chars):\n${jobText.substring(0, 200)}...`);

    // Stage 1: Generate natural language analysis of the job posting
    const stage1Start = Date.now();
    const analysisText = await lemonadeClient.sendMessage([
      {
        id: 'extract-system',
        role: 'system',
        content: systemPromptContent,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'extract-user',
        role: 'user',
        content: userPromptContent,
        timestamp: new Date().toISOString(),
      },
    ], { maxTokens: 1024 });

    console.log(`[JobExtract] Stage 1 full result (${analysisText.length} chars):\n${analysisText}`);

    const stage1DurationMs = Date.now() - stage1Start;
    try {
      PipelineLogger.getInstance().log(jobPostDocId, {
        stage: 'job-extraction-stage1',
        model: (await settingsRepo.getInterviewerSettings()).modelName,
        inputChars: systemPromptContent.length + userPromptContent.length,
        inputTokensEst: Math.round((systemPromptContent.length + userPromptContent.length) / 4),
        maxOutputTokens: 1024,
        messageCount: 2,
        systemChars: systemPromptContent.length,
        userChars: userPromptContent.length,
        finishReason: 'stop',
        outputChars: analysisText.length,
        outputPreview: analysisText.substring(0, 600),
        meta: { jobPostDocId, docTextLength: doc.extractedText.length, usedChars: jobText.length },
        durationMs: stage1DurationMs,
        timestamp: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    // Stage 2: Extract structured fields from the analysis
    console.log(`[JobExtract] ── Stage 2 (structured extraction) ──────────────`);
    const stage2Start = Date.now();
    const extracted = await extractionService.extractJobDetails(jobText, analysisText);

    if (!extracted) {
      console.error('[JobExtract] Stage 2 failed — could not parse structured data from Stage 1 output.');
      throw new Error('Failed to extract structured job details from the analysis.');
    }

    console.log(`[JobExtract] Stage 2 result:`, extracted);
    try {
      PipelineLogger.getInstance().log(jobPostDocId, {
        stage: 'job-extraction-stage2',
        model: (await settingsRepo.getInterviewerSettings()).modelName,
        inputChars: analysisText.length,
        inputTokensEst: Math.round(analysisText.length / 4),
        maxOutputTokens: 512,
        messageCount: 2,
        finishReason: 'stop',
        outputChars: JSON.stringify(extracted).length,
        outputPreview: JSON.stringify(extracted),
        extracted: { title: extracted.title, company: extracted.company, position: extracted.position, interviewType: extracted.interviewType },
        meta: { jobPostDocId },
        durationMs: Date.now() - stage2Start,
        timestamp: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    return {
      title: extracted.title,
      company: extracted.company,
      position: extracted.position,
      interviewType: extracted.interviewType,
    };
  } catch (error) {
    console.error('Failed to extract job details:', error);
    throw error;
  }
});

// Returns paths to log files so the UI can surface them to the user
ipcMain.handle('app:getLogPaths', () => ({
  appLog: activeLogFile,
  pipelineLogDir: path.join(app.getPath('userData'), 'pipeline-logs'),
  userData: app.getPath('userData'),
}));

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
