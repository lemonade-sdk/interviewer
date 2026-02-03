const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Interview operations
  startInterview: (config) => ipcRenderer.invoke('interview:start', config),
  endInterview: (interviewId) => ipcRenderer.invoke('interview:end', interviewId),
  sendMessage: (interviewId, message) => ipcRenderer.invoke('interview:sendMessage', interviewId, message),
  getInterview: (interviewId) => ipcRenderer.invoke('interview:get', interviewId),
  getAllInterviews: () => ipcRenderer.invoke('interview:getAll'),
  deleteInterview: (interviewId) => ipcRenderer.invoke('interview:delete', interviewId),
  
  // Job operations
  createJob: (jobData) => ipcRenderer.invoke('job:create', jobData),
  updateJob: (jobId, updates) => ipcRenderer.invoke('job:update', jobId, updates),
  getJob: (jobId) => ipcRenderer.invoke('job:get', jobId),
  getAllJobs: () => ipcRenderer.invoke('job:getAll'),
  deleteJob: (jobId) => ipcRenderer.invoke('job:delete', jobId),
  
  // Settings operations
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (updates) => ipcRenderer.invoke('settings:update', updates),
  getInterviewerSettings: () => ipcRenderer.invoke('settings:getInterviewer'),
  updateInterviewerSettings: (updates) => ipcRenderer.invoke('settings:updateInterviewer', updates),
  
  // Model operations
  getAvailableModels: () => ipcRenderer.invoke('model:getAvailable'),
  testModelConnection: (modelId) => ipcRenderer.invoke('model:testConnection', modelId),
  loadModel: (modelId) => ipcRenderer.invoke('model:load', modelId),
  unloadModel: (modelId) => ipcRenderer.invoke('model:unload', modelId),
  pullModel: (modelId) => ipcRenderer.invoke('model:pull', modelId),
  deleteModel: (modelId) => ipcRenderer.invoke('model:delete', modelId),
  refreshModels: () => ipcRenderer.invoke('model:refresh'),
  
  // Server operations
  checkServerHealth: () => ipcRenderer.invoke('server:checkHealth'),
  getServerStatus: () => ipcRenderer.invoke('server:getStatus'),
  
  // MCP operations
  getMCPServers: () => ipcRenderer.invoke('mcp:getServers'),
  updateMCPServers: (servers) => ipcRenderer.invoke('mcp:updateServers', servers),
  
  // Persona operations
  createPersona: (personaData) => ipcRenderer.invoke('persona:create', personaData),
  getAllPersonas: () => ipcRenderer.invoke('persona:getAll'),
  getPersonaById: (personaId) => ipcRenderer.invoke('persona:getById', personaId),
  updatePersona: (personaId, updates) => ipcRenderer.invoke('persona:update', personaId, updates),
  deletePersona: (personaId) => ipcRenderer.invoke('persona:delete', personaId),
  setDefaultPersona: (personaId) => ipcRenderer.invoke('persona:setDefault', personaId),
  getDefaultPersona: () => ipcRenderer.invoke('persona:getDefault'),
  
  // Audio operations
  saveAudioRecording: (audioData) => ipcRenderer.invoke('audio:saveRecording', audioData),
  getAudioRecordingsPath: () => ipcRenderer.invoke('audio:getRecordingsPath'),
  deleteAudioRecording: (filepath) => ipcRenderer.invoke('audio:deleteRecording', filepath),
});
