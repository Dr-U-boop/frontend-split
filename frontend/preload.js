const { contextBridge, ipcRenderer } = require('electron');

// Мы создаем безопасный объект window.electronAPI в нашем окне
contextBridge.exposeInMainWorld('Electron', {
  // Функция loginSuccess будет отправлять сигнал 'login-success' главному процессу
  loginSuccess: () => ipcRenderer.send('login-success'),
});