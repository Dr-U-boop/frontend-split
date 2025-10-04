// frontend/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loginSuccess: (token) => ipcRenderer.send('login-success', token),
  handleToken: (callback) => ipcRenderer.on('token-sent', (_event, token) => callback(token)),
  
  // --- НОВАЯ ФУНКЦИЯ ---
  onBackendReady: (callback) => ipcRenderer.on('backend-ready', () => callback()),
});