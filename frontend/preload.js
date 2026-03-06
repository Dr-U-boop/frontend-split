// frontend/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loginSuccess: (token) => ipcRenderer.send('login-success', token),
  handleToken: (callback) => ipcRenderer.on('token-sent', (_event, token) => callback(token)),
  getUserToken: () => ipcRenderer.invoke('get-user-token'),
  onBackendReady: (callback) => ipcRenderer.on('backend-ready', () => callback()),
  setZoomFactor: (factor) => ipcRenderer.invoke('set-zoom-factor', factor),
  getZoomFactor: () => ipcRenderer.invoke('get-zoom-factor'),
  getApiBaseUrl: () => process.env.API_BASE_URL || 'https://glucose-sibr-tech.ru',
});
