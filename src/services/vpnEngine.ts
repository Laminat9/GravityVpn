import { VpnStatus, ProxyNodeItem } from '../types';

export interface VpnEngine {
  connect(): Promise<{ success: boolean; error?: string }>;
  disconnect(): Promise<{ success: boolean }>;
  getStatus(): Promise<VpnStatus>;
  getProxies(): Promise<any>;
  selectProxy(group: string, name: string): Promise<boolean>;
  testDelay(name: string): Promise<number>;
  getPublicIp(): Promise<{ ip: string }>;
}

declare global {
  interface Window {
    electronAPI?: any;
  }
}

class MihomoVpnEngine implements VpnEngine {
  public async connect(): Promise<{ success: boolean; error?: string }> {
    if (window.electronAPI?.connect) {
      return await window.electronAPI.connect();
    }
    return { success: true };
  }

  public async disconnect(): Promise<{ success: boolean }> {
    if (window.electronAPI?.disconnect) {
      return await window.electronAPI.disconnect();
    }
    return { success: true };
  }

  public async getStatus(): Promise<VpnStatus> {
    if (window.electronAPI?.getStatus) {
      return await window.electronAPI.getStatus();
    }
    return {
      connected: false,
      connecting: false,
      activeNode: null,
      activeProfile: null,
      mode: 'system-proxy',
      ip: '---',
      sessionStartTime: null,
    };
  }

  public async getProxies(): Promise<any> {
    if (window.electronAPI?.getProxies) {
      return await window.electronAPI.getProxies();
    }
    return null;
  }

  public async selectProxy(group: string, name: string): Promise<boolean> {
    if (window.electronAPI?.selectProxy) {
      return await window.electronAPI.selectProxy(group, name);
    }
    return true;
  }

  public async testDelay(name: string): Promise<number> {
    if (window.electronAPI?.testDelay) {
      return await window.electronAPI.testDelay(name);
    }
    return Math.floor(Math.random() * 40 + 15);
  }

  public async getPublicIp(): Promise<{ ip: string }> {
    if (window.electronAPI?.getPublicIp) {
      return await window.electronAPI.getPublicIp();
    }
    return { ip: '185.220.101.5' };
  }
}

export const vpnEngine: VpnEngine = new MihomoVpnEngine();
