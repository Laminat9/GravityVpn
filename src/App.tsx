import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Overview } from './components/Overview';
import { Profiles } from './components/Profiles';
import { Proxies } from './components/Proxies';
import { Logs } from './components/Logs';
import { Settings } from './components/Settings';
import { TabType, VpnStatus, TrafficStats, SubscriptionProfile, AppSettings, DeviceInfo } from './types';
import { vpnEngine } from './services/vpnEngine';
import { trafficService } from './services/trafficService';

const defaultStatus: VpnStatus = {
  connected: false,
  connecting: false,
  activeNode: null,
  activeProfile: null,
  mode: 'system-proxy',
  ip: '---',
  sessionStartTime: null,
  error: null,
};

const defaultTraffic: TrafficStats = {
  up: 0,
  down: 0,
  upSpeedFormatted: '0.0 Мбит/с',
  downSpeedFormatted: '0.0 Мбит/с',
  totalUpBytes: 0,
  totalDownBytes: 0,
};

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

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [status, setStatus] = useState<VpnStatus>(defaultStatus);
  const [traffic, setTraffic] = useState<TrafficStats>(defaultTraffic);
  const [profiles, setProfiles] = useState<SubscriptionProfile[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [activePing, setActivePing] = useState<number>(18);

  // Initial load
  useEffect(() => {
    // 1. Initial status
    vpnEngine.getStatus().then((st) => {
      if (st) setStatus(st);
    });

    // 2. Status change listener
    if (window.electronAPI?.onStatusChange) {
      const unsubStatus = window.electronAPI.onStatusChange((newStatus: VpnStatus) => {
        setStatus(newStatus);
      });
      // 3. Traffic WebSocket
      const unsubTraffic = trafficService.subscribe((stats) => {
        setTraffic(stats);
      });

      return () => {
        unsubStatus();
        unsubTraffic();
      };
    } else {
      const unsubTraffic = trafficService.subscribe((stats) => {
        setTraffic(stats);
      });
      return () => unsubTraffic();
    }
  }, []);

  // Load profiles, settings & device info
  const refreshProfiles = async () => {
    if (window.electronAPI?.getProfiles) {
      const profs: SubscriptionProfile[] = await window.electronAPI.getProfiles();
      setProfiles(profs || []);
      // If first run and no profiles exist, show 'profiles' tab
      if (!profs || profs.length === 0) {
        setCurrentTab('profiles');
      }
    }
  };

  const refreshSettings = async () => {
    if (window.electronAPI?.getSettings) {
      const st = await window.electronAPI.getSettings();
      if (st) {
        setSettings(st);
        trafficService.setPort(st.controllerPort);
      }
    }
  };

  const refreshDeviceInfo = async () => {
    if (window.electronAPI?.getDeviceInfo) {
      const info = await window.electronAPI.getDeviceInfo();
      if (info) setDeviceInfo(info);
    }
  };

  useEffect(() => {
    refreshProfiles();
    refreshSettings();
    refreshDeviceInfo();
  }, []);

  // Periodic active node ping check
  useEffect(() => {
    let interval: any = null;
    const checkPing = async () => {
      if (status.connected) {
        const nodeToTest = status.activeNode || 'Gravity';
        const delay = await vpnEngine.testDelay(nodeToTest);
        if (delay > 0) setActivePing(delay);
      }
    };

    checkPing();
    interval = setInterval(checkPing, 10000);
    return () => clearInterval(interval);
  }, [status.connected, status.activeNode]);

  // Connect / Disconnect
  const handleConnect = async () => {
    await vpnEngine.connect();
  };

  const handleDisconnect = async () => {
    await vpnEngine.disconnect();
  };

  // Profile management
  const handleAddProfile = async (url: string, name?: string) => {
    if (window.electronAPI?.addProfile) {
      const res = await window.electronAPI.addProfile(url, name);
      if (res.success) {
        await refreshProfiles();
      }
      return res;
    }
    return { success: false, error: 'API недоступен' };
  };

  const handleUpdateProfile = async (id: string) => {
    if (window.electronAPI?.updateProfile) {
      const res = await window.electronAPI.updateProfile(id);
      if (res.success) {
        await refreshProfiles();
      }
      return res;
    }
    return { success: false, error: 'API недоступен' };
  };

  const handleDeleteProfile = async (id: string) => {
    if (window.electronAPI?.deleteProfile) {
      await window.electronAPI.deleteProfile(id);
      await refreshProfiles();
    }
  };

  const handleSelectProfile = async (id: string) => {
    if (window.electronAPI?.selectProfile) {
      await window.electronAPI.selectProfile(id);
      await refreshProfiles();
    }
  };

  // Node selection
  const handleSelectNode = async (nodeName: string) => {
    await vpnEngine.selectProxy('Gravity', nodeName);
    setStatus(prev => ({ ...prev, activeNode: nodeName }));
    const delay = await vpnEngine.testDelay(nodeName);
    if (delay > 0) setActivePing(delay);
  };

  // Settings save
  const handleSaveSettings = async (partial: Partial<AppSettings>) => {
    if (window.electronAPI?.saveSettings) {
      const updated = await window.electronAPI.saveSettings(partial);
      setSettings(updated);
      trafficService.setPort(updated.controllerPort);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0C0D0E] text-[#EDEDED] overflow-hidden select-none font-sans">
      {/* Custom Window Title Bar */}
      <TitleBar />

      {/* Main Workspace: Sidebar + Screen Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Vertical Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          status={status}
          activePing={activePing}
        />

        {/* Main Content View */}
        <main className="flex-1 h-full bg-[#0C0D0E] overflow-hidden relative">
          {currentTab === 'overview' && (
            <Overview
              status={status}
              traffic={traffic}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              activePing={activePing}
            />
          )}

          {currentTab === 'profiles' && (
            <Profiles
              profiles={profiles}
              deviceInfo={deviceInfo}
              onAddProfile={handleAddProfile}
              onUpdateProfile={handleUpdateProfile}
              onDeleteProfile={handleDeleteProfile}
              onSelectProfile={handleSelectProfile}
            />
          )}

          {currentTab === 'proxies' && (
            <Proxies
              activeNode={status.activeNode}
              onSelectNode={handleSelectNode}
            />
          )}

          {currentTab === 'logs' && <Logs />}

          {currentTab === 'settings' && (
            <Settings
              settings={settings}
              deviceInfo={deviceInfo}
              onSaveSettings={handleSaveSettings}
            />
          )}
        </main>
      </div>
    </div>
  );
};
