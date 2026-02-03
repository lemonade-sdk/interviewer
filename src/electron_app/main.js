const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, closeDatabase } = require('../database/db');
const { InterviewRepository } = require('../database/repositories/InterviewRepository');
const { JobRepository } = require('../database/repositories/JobRepository');
const { SettingsRepository } = require('../database/repositories/SettingsRepository');
const { PersonaRepository } = require('../database/repositories/PersonaRepository');
const { InterviewService } = require('../services/InterviewService');
const { MCPManager } = require('../mcp/MCPManager');
const { getLemonadeServerManager } = require('../services/LemonadeServerManager');

let mainWindow;
let interviewService;
let mcpManager;
let serverManager;

// Repositories
let interviewRepo;
let jobRepo;
let settingsRepo;
let personaRepo;

// Audio recordings directory
let audioRecordingsPath;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#ffffff',
    show: false,
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeApp() {
  try {
    // Initialize database
    initializeDatabase();
    
    // Initialize repositories
    interviewRepo = new InterviewRepository();
    jobRepo = new JobRepository();
    settingsRepo = new SettingsRepository();
    personaRepo = new PersonaRepository();
    
    // Setup audio recordings directory
    audioRecordingsPath = path.join(app.getPath('userData'), 'audio_recordings');
    if (!fs.existsSync(audioRecordingsPath)) {
      fs.mkdirSync(audioRecordingsPath, { recursive: true });
    }
    
    // Initialize Lemonade Server Manager
    serverManager = getLemonadeServerManager();
    
    // Check Lemonade Server health
    const isServerRunning = await serverManager.checkHealth();
    if (isServerRunning) {
      console.log('✓ Lemonade Server is running');
      serverManager.startHealthMonitoring();
    } else {
      console.warn('⚠ Lemonade Server is not running. Please start Lemonade Server at http://localhost:8000');
    }
    
    // Initialize services
    const interviewerSettings = settingsRepo.getInterviewerSettings();
    interviewService = new InterviewService(interviewerSettings);
    
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
  if (serverManager) {
    serverManager.stopHealthMonitoring();
  }
});

// IPC Handlers - Interview Operations
ipcMain.handle('interview:start', async (event, config) => {
  try {
    const interview = interviewRepo.create(config);
    await interviewService.startInterview(interview.id, config);
    return interview;
  } catch (error) {
    console.error('Failed to start interview:', error);
    throw error;
  }
});

ipcMain.handle('interview:end', async (event, interviewId) => {
  try {
    const feedback = await interviewService.endInterview(interviewId);
    const interview = interviewRepo.findById(interviewId);
    
    if (interview) {
      const endedAt = new Date().toISOString();
      const duration = Math.floor(
        (new Date(endedAt).getTime() - new Date(interview.startedAt).getTime()) / 1000
      );
      
      return interviewRepo.update(interviewId, {
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

ipcMain.handle('interview:sendMessage', async (event, interviewId, message) => {
  try {
    const response = await interviewService.sendMessage(interviewId, message);
    
    // Update interview transcript
    const interview = interviewRepo.findById(interviewId);
    if (interview) {
      const userMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };
      
      interview.transcript.push(userMessage, assistantMessage);
      interviewRepo.update(interviewId, { transcript: interview.transcript });
      
      return assistantMessage;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
});

ipcMain.handle('interview:get', async (event, interviewId) => {
  try {
    return interviewRepo.findById(interviewId);
  } catch (error) {
    console.error('Failed to get interview:', error);
    throw error;
  }
});

ipcMain.handle('interview:getAll', async () => {
  try {
    return interviewRepo.findAll();
  } catch (error) {
    console.error('Failed to get all interviews:', error);
    throw error;
  }
});

ipcMain.handle('interview:delete', async (event, interviewId) => {
  try {
    return interviewRepo.delete(interviewId);
  } catch (error) {
    console.error('Failed to delete interview:', error);
    throw error;
  }
});

// IPC Handlers - Job Operations
ipcMain.handle('job:create', async (event, jobData) => {
  try {
    return jobRepo.create(jobData);
  } catch (error) {
    console.error('Failed to create job:', error);
    throw error;
  }
});

ipcMain.handle('job:update', async (event, jobId, updates) => {
  try {
    return jobRepo.update(jobId, updates);
  } catch (error) {
    console.error('Failed to update job:', error);
    throw error;
  }
});

ipcMain.handle('job:get', async (event, jobId) => {
  try {
    return jobRepo.findById(jobId);
  } catch (error) {
    console.error('Failed to get job:', error);
    throw error;
  }
});

ipcMain.handle('job:getAll', async () => {
  try {
    return jobRepo.findAll();
  } catch (error) {
    console.error('Failed to get all jobs:', error);
    throw error;
  }
});

ipcMain.handle('job:delete', async (event, jobId) => {
  try {
    return jobRepo.delete(jobId);
  } catch (error) {
    console.error('Failed to delete job:', error);
    throw error;
  }
});

// IPC Handlers - Settings Operations
ipcMain.handle('settings:get', async () => {
  try {
    return settingsRepo.getUserSettings();
  } catch (error) {
    console.error('Failed to get settings:', error);
    throw error;
  }
});

ipcMain.handle('settings:update', async (event, updates) => {
  try {
    return settingsRepo.updateUserSettings(updates);
  } catch (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
});

ipcMain.handle('settings:getInterviewer', async () => {
  try {
    return settingsRepo.getInterviewerSettings();
  } catch (error) {
    console.error('Failed to get interviewer settings:', error);
    throw error;
  }
});

ipcMain.handle('settings:updateInterviewer', async (event, updates) => {
  try {
    const updated = settingsRepo.updateInterviewerSettings(updates);
    // Reinitialize interview service with new settings
    interviewService = new InterviewService(updated);
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

ipcMain.handle('model:testConnection', async (event, modelId) => {
  try {
    return await interviewService.testModelConnection(modelId);
  } catch (error) {
    console.error('Failed to test model connection:', error);
    return false;
  }
});

ipcMain.handle('model:load', async (event, modelId) => {
  try {
    return await interviewService.loadModel(modelId);
  } catch (error) {
    console.error('Failed to load model:', error);
    return false;
  }
});

ipcMain.handle('model:unload', async (event, modelId) => {
  try {
    return await interviewService.unloadModel(modelId);
  } catch (error) {
    console.error('Failed to unload model:', error);
    return false;
  }
});

ipcMain.handle('model:pull', async (event, modelId) => {
  try {
    return await interviewService.pullModel(modelId);
  } catch (error) {
    console.error('Failed to pull model:', error);
    return false;
  }
});

ipcMain.handle('model:delete', async (event, modelId) => {
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
    return await serverManager.checkHealth();
  } catch (error) {
    console.error('Failed to check server health:', error);
    return false;
  }
});

ipcMain.handle('server:getStatus', async () => {
  try {
    return {
      isRunning: serverManager.getStatus(),
      url: serverManager.getBaseURL(),
    };
  } catch (error) {
    console.error('Failed to get server status:', error);
    return { isRunning: false, url: 'http://localhost:8000' };
  }
});

// ===========================================
// IPC Handlers - Agent Personas
// ===========================================

ipcMain.handle('persona:create', async (event, personaData) => {
  try {
    return personaRepo.create(personaData);
  } catch (error) {
    console.error('Failed to create persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:getAll', async () => {
  try {
    return personaRepo.findAll();
  } catch (error) {
    console.error('Failed to get all personas:', error);
    throw error;
  }
});

ipcMain.handle('persona:getById', async (event, personaId) => {
  try {
    return personaRepo.findById(personaId);
  } catch (error) {
    console.error('Failed to get persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:update', async (event, personaId, updates) => {
  try {
    return personaRepo.update(personaId, updates);
  } catch (error) {
    console.error('Failed to update persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:delete', async (event, personaId) => {
  try {
    return personaRepo.delete(personaId);
  } catch (error) {
    console.error('Failed to delete persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:setDefault', async (event, personaId) => {
  try {
    return personaRepo.setDefault(personaId);
  } catch (error) {
    console.error('Failed to set default persona:', error);
    throw error;
  }
});

ipcMain.handle('persona:getDefault', async () => {
  try {
    return personaRepo.findDefault();
  } catch (error) {
    console.error('Failed to get default persona:', error);
    return null;
  }
});

// ===========================================
// IPC Handlers - Audio Services
// ===========================================

ipcMain.handle('audio:saveRecording', async (event, audioData) => {
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

ipcMain.handle('audio:deleteRecording', async (event, filepath) => {
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
    return mcpManager.getServers();
  } catch (error) {
    console.error('Failed to get MCP servers:', error);
    throw error;
  }
});

ipcMain.handle('mcp:updateServers', async (event, servers) => {
  try {
    await mcpManager.updateServers(servers);
  } catch (error) {
    console.error('Failed to update MCP servers:', error);
    throw error;
  }
});
