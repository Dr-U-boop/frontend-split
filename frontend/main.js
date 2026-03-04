
const { app, BrowserWindow, ipcMain, screen, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let pythonProcess = null;
let userToken = null;
const USE_EXTERNAL_API = Boolean(process.env.API_BASE_URL);
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8000';

function shouldAttachAuthHeader(url) {
    if (!(url.startsWith(API_BASE_URL) || url.includes('/api/'))) return false;
    return !url.includes('/api/auth/login');
}

function startPythonBackend() {
    const isWindows = process.platform === 'win32';
    const pythonExecutable = isWindows
        ? path.join(__dirname, '..', '..', 'backend-split', 'venv', 'Scripts', 'python.exe')
        : path.join(__dirname, '..', '..', 'backend-split', 'venv', 'bin', 'python');

    const cwd = path.join(__dirname, '..', '..', 'backend-split');

    pythonProcess = spawn(pythonExecutable, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], { cwd });
    pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log(`Python: ${output}`);

        if (output.includes('Uvicorn running on')) {
            if (mainWindow) {
                mainWindow.webContents.send('backend-ready');
            }
        }
    });
    pythonProcess.stdout.on('data', (data) => console.log(`Python: ${data}`));
    pythonProcess.stderr.on('data', (data) => console.error(`Python Error: ${data}`));
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const screenSize = primaryDisplay.bounds;
    mainWindow = new BrowserWindow({
        icon: __dirname + 'assets/mac/icons/medical_app.icns',
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

    mainWindow.loadFile(path.join(__dirname, './html/auth_page.html'));

    if (USE_EXTERNAL_API) {
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('backend-ready');
        });
    }
}

app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        if (userToken && shouldAttachAuthHeader(details.url) && !details.requestHeaders.Authorization && !details.requestHeaders.authorization) {
            details.requestHeaders.Authorization = `Bearer ${userToken}`;
        }
        callback({ requestHeaders: details.requestHeaders });
    });

    ipcMain.handle('set-zoom-factor', (event, factor) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return false;

        const parsed = Number(factor);
        const safeFactor = Number.isFinite(parsed) ? parsed : 1;
        const boundedFactor = Math.min(2, Math.max(0.5, safeFactor));
        win.webContents.setZoomFactor(boundedFactor);
        return true;
    });

    ipcMain.handle('get-zoom-factor', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return 1;
        return win.webContents.getZoomFactor();
    });

    ipcMain.handle('get-user-token', () => {
        return userToken;
    });

    ipcMain.on('login-success', (event, token) => {
        userToken = token;

        const win = BrowserWindow.fromWebContents(event.sender);
        win.webContents.once('did-finish-load', () => {
            win.webContents.send('token-sent', userToken);
        });

        win.loadFile(path.join(__dirname, './html/dashboard_page.html'));
    });

    if (!USE_EXTERNAL_API) {
        startPythonBackend();
    }
    createWindow();
});

app.on('will-quit', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
});
