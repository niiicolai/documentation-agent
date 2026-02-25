const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  checkOllama: () => ipcRenderer.invoke('check-ollama'),
  getModels: () => ipcRenderer.invoke('get-models'),
  getModel: () => ipcRenderer.invoke('get-model'),
  setModel: (model) => ipcRenderer.invoke('set-model', model),
  setMarkdownPreview: (markdown) => ipcRenderer.invoke('set-markdown-preview', markdown),
  sendMessage: (message, files, mode) => ipcRenderer.invoke('send-message', message, files, mode),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  saveProject: (content) => ipcRenderer.invoke('save-project', content),
  loadProject: () => ipcRenderer.invoke('load-project'),
  onMarkdownPreview: (callback) => {
    ipcRenderer.on('markdown-preview', (event, markdown) => callback(markdown));
  },
  onAgentEvent: (callback) => {
    ipcRenderer.on('agent-event', (event, data) => callback(data));
  }
});
