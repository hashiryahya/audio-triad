const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 850,
        minWidth: 900,
        minHeight: 650,
        title: 'AudioTriad — Multi-Device Audio Splitter & Movie Sync',
        backgroundColor: '#0a0d14',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Start background media & routing server
    serverProcess = fork(path.join(__dirname, 'server.js'), ['--no-browser']);

    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 800);

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (serverProcess) serverProcess.kill();
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (serverProcess) serverProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});
