
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let pythonProcess = null;

function startPythonBackend() {
    // Кросс-платформенный код запуска Python, который мы уже сделали
    const isWindows = process.platform === 'win32';
    const pythonExecutable = isWindows 
        ? path.join(__dirname, '..', 'backend', 'venv', 'Scripts', 'python.exe') 
        : path.join(__dirname, '..', 'backend', 'venv', 'bin', 'python');
  
    const cwd = path.join(__dirname, '..', 'backend');

    pythonProcess = spawn(pythonExecutable, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], { cwd });
    pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log(`Python: ${output}`);
        
        // Ищем в выводе uvicorn строку, подтверждающую запуск
        if (output.includes("Uvicorn running on")) {
            console.log("Бэкенд готов! Отправляем сигнал фронтенду.");
            // Отправляем сигнал в окно, только если оно уже создано
            if (mainWindow) {
                mainWindow.webContents.send('backend-ready');
            }
        }

        else
            console.log("Что-то пошло не так")
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

    // Загружаем наш локальный HTML файл
    mainWindow.loadFile(path.join(__dirname, './html/auth_page.html'));
}

app.whenReady().then(() => {
    
    /// Слушаем событие 'login-success' и принимаем токен
    ipcMain.on('login-success', (event, token) => {
        console.log("Токен получен в главном процессе!");
        userToken = token; // Сохраняем токен

        const win = BrowserWindow.fromWebContents(event.sender);
        
        // Как только панель управления будет готова...
        win.webContents.once('did-finish-load', () => {
            // ...отправляем ей сохраненный токен
            console.log("Отправляем токен на страницу панели управления.");
            win.webContents.send('token-sent', userToken);
        });

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