import fs from 'fs';
import path from 'path';
import { AppSettings } from './types';

const defaultSettings: AppSettings = {
  mixedPort: 7890,
  controllerPort: 9090,
  networkMode: 'system-proxy',
  autoStart: false,
  minimizeToTray: true,
  closeToTray: true,
  dnsServers: ['1.1.1.1', '8.8.8.8'],
  theme: 'dark',
  autoConnectNearest: false,
  customUserAgent: '',
};

export class SettingsManager {
  private filePath: string;
  private settings: AppSettings;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'settings.json');
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return { ...defaultSettings, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('[SettingsManager] Failed to load settings:', e);
    }
    return { ...defaultSettings };
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public saveSettings(newSettings: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...newSettings };
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (e) {
      console.error('[SettingsManager] Failed to save settings:', e);
    }
    return { ...this.settings };
  }
}
