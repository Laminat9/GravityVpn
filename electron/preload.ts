import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings, CoreLogEntry, DeviceInfo, SubscriptionProfile, SubscriptionProgress, VpnStatusPayload } from './types';

export interface ElectronAPI {
  // Window
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;

  // VPN
  connect: () => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<{ success: boolean }>;
  getStatus: () => Promise<VpnStatusPayload>;
  onStatusChange: (callback: (status: VpnStatusPayload) => void) => () => void;
  getPublicIp: () => Promise<{ ip: string; country?: string; city?: string }>;

  // Proxies
  getProxies: () => Promise<any>;
  selectProxy: (group: string, name: string) => Promise<boolean>;
  testDelay: (name: string) => Promise<number>;

  // Device Info
  getDeviceInfo: () => Promise<DeviceInfo>;

  // Profiles
  getProfiles: () => Promise<SubscriptionProfile[]>;
  addProfile: (url: string, name?: string) => Promise<{ success: boolean; profile?: SubscriptionProfile; error?: string }>;
  updateProfile: (id: string) => Promise<{ success: boolean; profile?: SubscriptionProfile; error?: string }>;
  deleteProfile: (id: string) => Promise<boolean>;
  selectProfile: (id: string) => Promise<boolean>;
  onSubscriptionProgress: (callback: (progress: SubscriptionProgress) => void) => () => void;

  // Logs
  getLogHistory: () => Promise<CoreLogEntry[]>;
  onLog: (callback: (log: CoreLogEntry) => void) => () => void;
  clearLogs: () => Promise<void>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
}

const electronAPI: ElectronAPI = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  connect: () => ipcRenderer.invoke('vpn:connect'),
  disconnect: () => ipcRenderer.invoke('vpn:disconnect'),
  getStatus: () => ipcRenderer.invoke('vpn:getStatus'),
  onStatusChange: (callback) => {
    const subscription = (_event: any, status: VpnStatusPayload) => callback(status);
    ipcRenderer.on('vpn:statusChange', subscription);
    return () => ipcRenderer.removeListener('vpn:statusChange', subscription);
  },
  getPublicIp: () => ipcRenderer.invoke('vpn:getPublicIp'),

  getProxies: () => ipcRenderer.invoke('vpn:getProxies'),
  selectProxy: (group, name) => ipcRenderer.invoke('vpn:selectProxy', group, name),
  testDelay: (name) => ipcRenderer.invoke('vpn:testDelay', name),

  getDeviceInfo: () => ipcRenderer.invoke('device:getInfo'),

  getProfiles: () => ipcRenderer.invoke('profiles:getAll'),
  addProfile: (url, name) => ipcRenderer.invoke('profiles:add', url, name),
  updateProfile: (id) => ipcRenderer.invoke('profiles:update', id),
  deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', id),
  selectProfile: (id) => ipcRenderer.invoke('profiles:select', id),
  onSubscriptionProgress: (callback) => {
    const subscription = (_event: any, progress: SubscriptionProgress) => callback(progress);
    ipcRenderer.on('subscription:progress', subscription);
    return () => ipcRenderer.removeListener('subscription:progress', subscription);
  },

  getLogHistory: () => ipcRenderer.invoke('logs:getHistory'),
  onLog: (callback) => {
    const subscription = (_event: any, log: CoreLogEntry) => callback(log);
    ipcRenderer.on('logs:newEntry', subscription);
    return () => ipcRenderer.removeListener('logs:newEntry', subscription);
  },
  clearLogs: () => ipcRenderer.invoke('logs:clear'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
