const { contextBridge, ipcRenderer } = require('electron');

// Мы создаем безопасный объект window.electronAPI в нашем окне
contextBridge.exposeInMainWorld('electronAPI', {
  // 1. Изменяем функцию, чтобы она принимала токен в качестве аргумента
  loginSuccess: (token) => ipcRenderer.send('login-success', token),
  
  // 2. Добавляем новую функцию для "прослушивания" событий от главного процесса
  handleToken: (callback) => ipcRenderer.on('token-sent', (_event, token) => callback(token)),
});