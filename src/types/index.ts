export type TabType = 'overview' | 'profiles' | 'proxies' | 'logs' | 'settings';

export interface VpnStatus {
  connected: boolean;
  connecting: boolean;
  activeNode: string | null;
  activeProfile: string | null;
  mode: 'system-proxy' | 'tun';
  ip: string;
  sessionStartTime: number | null;
  error?: string | null;
}

export interface SubscriptionProfile {
  id: string;
  name: string;
  url: string;
  nodeCount: number;
  updatedAt: number;
  autoUpdateIntervalHours: number;
  active: boolean;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  createdAt: number;
}

export interface SubscriptionProgress {
  phase: 'requesting' | 'retrying' | 'parsing' | 'success' | 'error';
  message: string;
}

export interface ProxyNodeItem {
  name: string;
  type: string;
  server?: string;
  port?: number;
  delay?: number;
  history?: Array<{ time: string; delay: number }>;
}

export interface AppSettings {
  mixedPort: number;
  controllerPort: number;
  networkMode: 'system-proxy' | 'tun';
  autoStart: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  dnsServers: string[];
  theme: 'dark' | 'light';
  autoConnectNearest: boolean;
  customUserAgent?: string;
}

export interface CoreLogEntry {
  id: string;
  type: 'info' | 'warning' | 'error' | 'debug';
  payload: string;
  time: string;
}

export interface TrafficStats {
  up: number; // bytes per sec
  down: number; // bytes per sec
  upSpeedFormatted: string;
  downSpeedFormatted: string;
  totalUpBytes: number;
  totalDownBytes: number;
}
