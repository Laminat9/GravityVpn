import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import https from 'https';
import { MihomoManager } from './mihomoManager';
import { WindowsProxyManager } from './proxyManager';
import { SubscriptionManager } from './subscriptionManager';
import { SettingsManager } from './settingsManager';
import { VpnStatusPayload } from './types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Managers
let mihomoManager: MihomoManager;
let proxyManager: WindowsProxyManager;
let subscriptionManager: SubscriptionManager;
let settingsManager: SettingsManager;

// State
let vpnStatus: VpnStatusPayload = {
  connected: false,
  connecting: false,
  activeNode: null,
  activeProfile: null,
  mode: 'system-proxy',
  ip: '---',
  sessionStartTime: null,
  error: null,
};

const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function broadcastStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('vpn:statusChange', vpnStatus);
  }
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const statusText = vpnStatus.connected ? 'Защищено' : 'Не подключено';
  const toggleText = vpnStatus.connected ? 'Отключиться' : 'Подключиться';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Gravity · ${statusText}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Показать Gravity',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: toggleText,
      click: async () => {
        if (vpnStatus.connected) {
          await handleDisconnect();
        } else {
          await handleConnect();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`Gravity VPN — ${statusText}`);
}

async function handleConnect(): Promise<{ success: boolean; error?: string }> {
  try {
    vpnStatus.connecting = true;
    vpnStatus.error = null;
    broadcastStatus();

    const settings = settingsManager.getSettings();

    // Ensure mihomo is running
    if (!mihomoManager.isRunning()) {
      const started = await mihomoManager.start();
      if (!started) {
        vpnStatus.connecting = false;
        vpnStatus.error = 'Не удалось запустить ядро прокси mihomo';
        broadcastStatus();
        return { success: false, error: vpnStatus.error };
      }
    }

    // Enable system proxy if in system-proxy mode
    if (settings.networkMode === 'system-proxy') {
      const proxyOk = await proxyManager.enableSystemProxy(settings.mixedPort);
      if (!proxyOk) {
        vpnStatus.connecting = false;
        vpnStatus.error = 'Ошибка установки системного прокси в Windows реестре';
        broadcastStatus();
        return { success: false, error: vpnStatus.error };
      }
    }

    // Query active node from mihomo
    try {
      const proxiesData = await mihomoManager.getProxies();
      if (proxiesData?.proxies?.Gravity) {
        vpnStatus.activeNode = proxiesData.proxies.Gravity.now || null;
      }
    } catch {}

    const activeProf = subscriptionManager.getActiveProfile();
    vpnStatus.activeProfile = activeProf ? activeProf.name : null;
    vpnStatus.connected = true;
    vpnStatus.connecting = false;
    vpnStatus.sessionStartTime = Date.now();
    vpnStatus.mode = settings.networkMode;

    broadcastStatus();
    return { success: true };
  } catch (err: any) {
    vpnStatus.connected = false;
    vpnStatus.connecting = false;
    vpnStatus.error = err.message || 'Ошибка подключения';
    broadcastStatus();
    return { success: false, error: vpnStatus.error };
  }
}

async function handleDisconnect(): Promise<{ success: boolean }> {
  try {
    vpnStatus.connecting = false;
    vpnStatus.connected = false;
    vpnStatus.sessionStartTime = null;

    // Disable Windows system proxy
    await proxyManager.disableSystemProxy();

    broadcastStatus();
    return { success: true };
  } catch (err) {
    console.error('Error disconnecting:', err);
    return { success: false };
  }
}

function createWindow() {
  const iconPath = path.resolve(__dirname, '..', 'assets', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 980,
    height: 660,
    minWidth: 880,
    minHeight: 580,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#16171A',
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Minimize/close behavior
  mainWindow.on('close', (event) => {
    const settings = settingsManager.getSettings();
    if (!isQuitting && settings.closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function createTray() {
  const trayIconPath = path.resolve(__dirname, '..', 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(icon);

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });

  updateTrayMenu();
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  console.log(`[Main] UserData path: ${userDataPath}`);

  // Initialize managers
  settingsManager = new SettingsManager(userDataPath);
  proxyManager = new WindowsProxyManager(settingsManager.getSettings().mixedPort);
  subscriptionManager = new SubscriptionManager(userDataPath);
  mihomoManager = new MihomoManager(userDataPath, settingsManager.getSettings().controllerPort);

  // Forward subscription progress and sanitized logs to UI
  subscriptionManager.setLogCallback((type, msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('logs:newEntry', {
        id: Math.random().toString(36).substring(2, 9),
        type,
        payload: msg,
        time: new Date().toLocaleTimeString('ru-RU', { hour12: false }),
      });
    }
  });

  subscriptionManager.setProgressCallback((progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('subscription:progress', progress);
    }
  });

  // Ensure config exists
  const settings = settingsManager.getSettings();
  subscriptionManager.ensureMasterConfigExists(settings.mixedPort, settings.controllerPort);

  // Setup log listener to forward to renderer
  mihomoManager.onLog((log) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('logs:newEntry', log);
    }
  });

  // Check if system proxy was left on previously and sync
  const currentProxy = await proxyManager.checkSystemProxy();
  if (currentProxy.enabled) {
    vpnStatus.connected = true;
    vpnStatus.sessionStartTime = Date.now();
  }

  // Auto-start mihomo core
  await mihomoManager.start();

  createWindow();
  createTray();

  // Setup IPC Handlers
  setupIpcHandlers();
});

function setupIpcHandlers() {
  // Window controls
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window:close', () => {
    const settings = settingsManager.getSettings();
    if (settings.closeToTray) {
      mainWindow?.hide();
    } else {
      isQuitting = true;
      mainWindow?.close();
    }
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // VPN controls
  ipcMain.handle('vpn:connect', async () => {
    return await handleConnect();
  });

  ipcMain.handle('vpn:disconnect', async () => {
    return await handleDisconnect();
  });

  ipcMain.handle('vpn:getStatus', () => {
    return vpnStatus;
  });

  ipcMain.handle('vpn:getPublicIp', () => {
    return new Promise((resolve) => {
      https.get('https://api.ipify.org?format=json', { timeout: 4000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            vpnStatus.ip = parsed.ip;
            resolve({ ip: parsed.ip });
          } catch {
            resolve({ ip: 'Не определен' });
          }
        });
      }).on('error', () => resolve({ ip: 'Не определен' }));
    });
  });

  // Core Proxies
  ipcMain.handle('vpn:getProxies', async () => {
    return await mihomoManager.getProxies();
  });

  ipcMain.handle('vpn:selectProxy', async (_e, group: string, name: string) => {
    const ok = await mihomoManager.selectProxy(group, name);
    if (ok) {
      vpnStatus.activeNode = name;
      broadcastStatus();
    }
    return ok;
  });

  ipcMain.handle('vpn:testDelay', async (_e, name: string) => {
    return await mihomoManager.testProxyDelay(name);
  });

  // Device ID Info
  ipcMain.handle('device:getInfo', () => {
    return subscriptionManager.getDeviceInfo();
  });

  // Profiles
  ipcMain.handle('profiles:getAll', () => {
    return subscriptionManager.getProfiles();
  });

  ipcMain.handle('profiles:add', async (_e, url: string, name?: string) => {
    try {
      const settings = settingsManager.getSettings();
      const profile = await subscriptionManager.addSubscription(url, name, settings.customUserAgent);
      // Reload core config
      await mihomoManager.reloadConfig();
      vpnStatus.activeProfile = profile.name;
      broadcastStatus();
      return { success: true, profile };
    } catch (err: any) {
      return { success: false, error: err.message || 'Ошибка импорта подписки' };
    }
  });

  ipcMain.handle('profiles:update', async (_e, id: string) => {
    try {
      const settings = settingsManager.getSettings();
      const profile = await subscriptionManager.updateSubscription(id, settings.customUserAgent);
      await mihomoManager.reloadConfig();
      broadcastStatus();
      return { success: true, profile };
    } catch (err: any) {
      return { success: false, error: err.message || 'Ошибка обновления подписки' };
    }
  });

  ipcMain.handle('profiles:delete', (_e, id: string) => {
    const ok = subscriptionManager.deleteSubscription(id);
    if (ok) {
      mihomoManager.reloadConfig();
      broadcastStatus();
    }
    return ok;
  });

  ipcMain.handle('profiles:select', (_e, id: string) => {
    const ok = subscriptionManager.selectProfile(id);
    if (ok) {
      mihomoManager.reloadConfig();
      const active = subscriptionManager.getActiveProfile();
      vpnStatus.activeProfile = active ? active.name : null;
      broadcastStatus();
    }
    return ok;
  });

  // Logs
  ipcMain.handle('logs:getHistory', () => {
    return mihomoManager.getLogHistory();
  });

  ipcMain.handle('logs:clear', () => {
    mihomoManager.clearLogs();
  });

  // Settings
  ipcMain.handle('settings:get', () => {
    return settingsManager.getSettings();
  });

  ipcMain.handle('settings:save', async (_e, partial: any) => {
    const updated = settingsManager.saveSettings(partial);
    proxyManager.setPort(updated.mixedPort);

    // Apply autostart if changed
    if (partial.autoStart !== undefined) {
      app.setLoginItemSettings({
        openAtLogin: partial.autoStart,
        openAsHidden: true,
      });
    }

    return updated;
  });
}

// Clean up on exit
app.on('before-quit', async () => {
  isQuitting = true;
  console.log('[Main] App quitting, resetting Windows proxy and terminating Mihomo...');
  try {
    await proxyManager.disableSystemProxy();
  } catch {}
  try {
    await mihomoManager.stop();
  } catch {}
});

app.on('window-all-closed', () => {
  const settings = settingsManager?.getSettings();
  if (!settings?.closeToTray) {
    app.quit();
  }
});
