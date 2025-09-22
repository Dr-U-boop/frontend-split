
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let pythonProcess = null;

function startPythonBackend() {
    // Кросс-платформенный код запуска Python, который мы уже сделали
    const isWindows = process.platform === 'win32';
    const pythonExecutable = isWindows 
        ? path.join(__dirname, '..', 'backend', 'venv', 'Scripts', 'python.exe') 
        : path.join(__dirname, '..', 'backend', 'venv', 'bin', 'python');
  
    const cwd = path.join(__dirname, '..', 'backend');

    pythonProcess = spawn(pythonExecutable, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], { cwd });

    pythonProcess.stdout.on('data', (data) => console.log(`Python: ${data}`));
    pythonProcess.stderr.on('data', (data) => console.error(`Python Error: ${data}`));
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const screenSize = primaryDisplay.bounds;
    const mainWindow = new BrowserWindow({
        width: screenSize.width,
        height: screenSize.height,
        fullscreenable: true,
        autoHideMenuBar: true,
        fullscreen: false,
        frames: true,
        titleBarStyle: 'showen',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Загружаем наш локальный HTML файл
    mainWindow.loadFile(path.join(__dirname, './html/auth_page.html'));
}

app.whenReady().then(() => {
    
    // Слушаем событие 'login-success' от окна
    ipcMain.on('login-success', (event) => {
        // Находим окно, из которого пришло событие, и загружаем в него новую страницу
        const webContents = event.sender;
        const win = BrowserWindow.fromWebContents(webContents);
        win.loadFile(path.join(__dirname, './html/dashboard_page.html'));
    });

    startPythonBackend();
    createWindow();
});

app.on('will-quit', () => {
    if (pythonProcess) {
        pythonProcess.kill(); // Убиваем процесс Python при выходе
    }
});

// ... остальной стандартный код Electron ...