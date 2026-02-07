import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Interview operations
  startInterview: (config: any) => ipcRenderer.invoke('interview:start', config),
  endInterview: (interviewId: string) => ipcRenderer.invoke('interview:end', interviewId),
  sendMessage: (interviewId: string, message: string) => ipcRenderer.invoke('interview:sendMessage', interviewId, message),
  getInterview: (interviewId: string) => ipcRenderer.invoke('interview:get', interviewId),
  getAllInterviews: () => ipcRenderer.invoke('interview:getAll'),
  deleteInterview: (interviewId: string) => ipcRenderer.invoke('interview:delete', interviewId),
  updateInterviewTranscript: (interviewId: string, transcript: any[]) => ipcRenderer.invoke('interview:updateTranscript', interviewId, transcript),
  
  // Job operations
  createJob: (jobData: any) => ipcRenderer.invoke('job:create', jobData),
  updateJob: (jobId: string, updates: any) => ipcRenderer.invoke('job:update', jobId, updates),
  getJob: (jobId: string) => ipcRenderer.invoke('job:get', jobId),
  getAllJobs: () => ipcRenderer.invoke('job:getAll'),
  deleteJob: (jobId: string) => ipcRenderer.invoke('job:delete', jobId),
  
  // Settings operations
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (updates: any) => ipcRenderer.invoke('settings:update', updates),
  getInterviewerSettings: () => ipcRenderer.invoke('settings:getInterviewer'),
  updateInterviewerSettings: (updates: any) => ipcRenderer.invoke('settings:updateInterviewer', updates),
  
  // Model operations
  getAvailableModels: () => ipcRenderer.invoke('model:getAvailable'),
  testModelConnection: (modelId: string) => ipcRenderer.invoke('model:testConnection', modelId),
  loadModel: (modelId: string) => ipcRenderer.invoke('model:load', modelId),
  unloadModel: (modelId: string) => ipcRenderer.invoke('model:unload', modelId),
  pullModel: (modelId: string) => ipcRenderer.invoke('model:pull', modelId),
  deleteModel: (modelId: string) => ipcRenderer.invoke('model:delete', modelId),
  refreshModels: () => ipcRenderer.invoke('model:refresh'),
  
  // Server operations
  checkServerHealth: () => ipcRenderer.invoke('server:checkHealth'),
  getServerStatus: () => ipcRenderer.invoke('server:getStatus'),
  getSystemInfo: () => ipcRenderer.invoke('server:getSystemInfo'),
  getServerHealth: () => ipcRenderer.invoke('server:getHealth'),
  checkLemonadeInstallation: () => ipcRenderer.invoke('server:checkInstallation'),
  
  // MCP operations
  getMCPServers: () => ipcRenderer.invoke('mcp:getServers'),
  updateMCPServers: (servers: any[]) => ipcRenderer.invoke('mcp:updateServers', servers),
  
  // Persona operations
  createPersona: (personaData: any) => ipcRenderer.invoke('persona:create', personaData),
  getAllPersonas: () => ipcRenderer.invoke('persona:getAll'),
  getPersonaById: (personaId: string) => ipcRenderer.invoke('persona:getById', personaId),
  updatePersona: (personaId: string, updates: any) => ipcRenderer.invoke('persona:update', personaId, updates),
  deletePersona: (personaId: string) => ipcRenderer.invoke('persona:delete', personaId),
  setDefaultPersona: (personaId: string) => ipcRenderer.invoke('persona:setDefault', personaId),
  getDefaultPersona: () => ipcRenderer.invoke('persona:getDefault'),
  
  // Audio operations
  saveAudioRecording: (audioData: any) => ipcRenderer.invoke('audio:saveRecording', audioData),
  getAudioRecordingsPath: () => ipcRenderer.invoke('audio:getRecordingsPath'),
  deleteAudioRecording: (filepath: string) => ipcRenderer.invoke('audio:deleteRecording', filepath),
});
