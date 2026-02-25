import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { AgentService } from '../agent/agent-service.js';
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log');

log.info('Application starting...');

let mainWindow;
let agentService;

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  dialog.showErrorBox('Error', `An unexpected error occurred: ${error.message}`);
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});

function createWindow() {
  log.info('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log.info('Main window displayed');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  log.info('App ready, initializing...');
  
  try {
    const onMarkdownPreview = (markdown) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('markdown-preview', markdown);
      }
    };
    const onEvent = (event) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent-event', event);
      }
    };
    agentService = new AgentService(onMarkdownPreview, onEvent);
    await agentService.initialize();
    log.info('Agent service initialized');
  } catch (err) {
    log.error('Failed to initialize agent service:', err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] }
    ]
  });
  
  if (!result.canceled) {
    const files = result.filePaths.map(filePath => {
      const stats = fs.statSync(filePath);
      return {
        name: path.basename(filePath),
        path: filePath,
        size: stats.size,
        type: path.extname(filePath).slice(1)
      };
    });
    log.info(`Selected ${files.length} files`);
    return files;
  }
  return [];
});

ipcMain.handle('check-ollama', async () => {
  if (agentService) {
    return await agentService.checkConnection();
  }
  return { connected: false, error: 'Agent service not initialized' };
});

ipcMain.handle('get-models', async () => {
  if (agentService) {
    return await agentService.getModels();
  }
  return [];
});

ipcMain.handle('get-model', async () => {
  if (agentService) {
    return agentService.getModel();
  }
  return null;
});

ipcMain.handle('set-model', async (event, model) => {
  if (agentService) {
    try {
      return await agentService.setModel(model);
    } catch (err) {
      log.error('Set model error:', err);
      return { error: err.message };
    }
  }
  return { error: 'Agent service not initialized' };
});

ipcMain.handle('set-markdown-preview', async (event, markdown) => {
  if (agentService) {
    agentService.setCurrentMarkdownPreview(markdown);
    return { success: true };
  }
  return { error: 'Agent service not initialized' };
});

ipcMain.handle('send-message', async (event, message, files, mode) => {
  if (agentService) {
    try {
      return await agentService.chat(message, files, mode);
    } catch (err) {
      log.error('Chat error:', err);
      return { error: err.message };
    }
  }
  return { error: 'Agent service not initialized' };
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('is-maximized', () => {
  if (mainWindow) {
    return mainWindow.isMaximized();
  }
  return false;
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('save-project', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project',
    defaultPath: 'project.docagent',
    filters: [
      { name: 'DocAgent Project', extensions: ['docagent'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, JSON.stringify({ content }), 'utf-8');
      log.info('Project saved to:', result.filePath);
      return { success: true, path: result.filePath };
    } catch (err) {
      log.error('Save project error:', err);
      return { error: err.message };
    }
  }
  return { error: 'Save cancelled' };
});

ipcMain.handle('load-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Load Project',
    filters: [
      { name: 'DocAgent Project', extensions: ['docagent'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const filePath = result.filePaths[0];
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      log.info('Project loaded from:', filePath);
      return { success: true, content: parsed.content, path: filePath };
    } catch (err) {
      log.error('Load project error:', err);
      return { error: err.message };
    }
  }
  return { error: 'Load cancelled' };
});
