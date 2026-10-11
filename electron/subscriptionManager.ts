import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { DeviceInfo, SubscriptionProfile, SubscriptionProgress } from './types';
import {
  getOrCreateDeviceInfo,
  fetchSubscriptionWithRetry,
  parseSubscriptionNodes,
} from '../src/core/subscription';

export class SubscriptionManager {
  private userDataPath: string;
  private profilesPath: string;
  private configDir: string;
  private masterConfigPath: string;
  private profiles: SubscriptionProfile[] = [];
  private logCallback?: (type: 'info' | 'warning' | 'error', message: string) => void;
  private progressCallback?: (progress: SubscriptionProgress) => void;

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath;
    this.configDir = path.join(userDataPath, 'mihomo');
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    this.profilesPath = path.join(userDataPath, 'profiles.json');
    this.masterConfigPath = path.join(this.configDir, 'config.yaml');
    this.loadProfiles();
  }

  public setLogCallback(callback: (type: 'info' | 'warning' | 'error', message: string) => void) {
    this.logCallback = callback;
  }

  public setProgressCallback(callback: (progress: SubscriptionProgress) => void) {
    this.progressCallback = callback;
  }

  public getDeviceInfo(): DeviceInfo {
    return getOrCreateDeviceInfo(this.userDataPath);
  }

  public getMasterConfigPath(): string {
    return this.masterConfigPath;
  }

  public getConfigDir(): string {
    return this.configDir;
  }

  private loadProfiles() {
    try {
      if (fs.existsSync(this.profilesPath)) {
        const raw = fs.readFileSync(this.profilesPath, 'utf8');
        this.profiles = JSON.parse(raw);
      } else {
        this.profiles = [];
      }
    } catch (e) {
      console.error('[SubscriptionManager] Error loading profiles:', e);
      this.profiles = [];
    }
  }

  private saveProfiles() {
    try {
      fs.writeFileSync(this.profilesPath, JSON.stringify(this.profiles, null, 2), 'utf8');
    } catch (e) {
      console.error('[SubscriptionManager] Error saving profiles:', e);
    }
  }

  public getProfiles(): SubscriptionProfile[] {
    return [...this.profiles];
  }

  public getActiveProfile(): SubscriptionProfile | undefined {
    return this.profiles.find((p) => p.active) || this.profiles[0];
  }

  public async addSubscription(
    url: string,
    name?: string,
    customUserAgent?: string
  ): Promise<SubscriptionProfile> {
    const rawContent = await fetchSubscriptionWithRetry(url, {
      userDataPath: this.userDataPath,
      customUserAgent,
      onProgress: (p) => {
        if (this.progressCallback) this.progressCallback(p);
      },
      onLog: (type, msg) => {
        if (this.logCallback) this.logCallback(type, msg);
      },
    });

    const nodes = parseSubscriptionNodes(rawContent);

    if (nodes.length === 0) {
      throw new Error('Подписка не содержит активных узлов прокси.');
    }

    const profileId = 'prof_' + Date.now().toString(36);
    const profileName = name || `Подписка #${this.profiles.length + 1}`;

    // Save profile raw nodes file
    const profileFile = path.join(this.configDir, `${profileId}.json`);
    fs.writeFileSync(profileFile, JSON.stringify(nodes, null, 2), 'utf8');

    // Make all others inactive if this is first or activated
    this.profiles.forEach((p) => (p.active = false));

    const profile: SubscriptionProfile = {
      id: profileId,
      name: profileName,
      url,
      nodeCount: nodes.length,
      updatedAt: Date.now(),
      autoUpdateIntervalHours: 24,
      active: true,
    };

    this.profiles.unshift(profile);
    this.saveProfiles();

    // Rebuild master config.yaml
    this.generateMasterConfig(nodes);

    if (this.progressCallback) {
      this.progressCallback({ phase: 'success', message: 'Готово' });
    }

    return profile;
  }

  public async updateSubscription(id: string, customUserAgent?: string): Promise<SubscriptionProfile> {
    const prof = this.profiles.find((p) => p.id === id);
    if (!prof) {
      throw new Error(`Профиль с ID ${id} не найден`);
    }

    const rawContent = await fetchSubscriptionWithRetry(prof.url, {
      userDataPath: this.userDataPath,
      customUserAgent,
      onProgress: (p) => {
        if (this.progressCallback) this.progressCallback(p);
      },
      onLog: (type, msg) => {
        if (this.logCallback) this.logCallback(type, msg);
      },
    });

    const nodes = parseSubscriptionNodes(rawContent);

    const profileFile = path.join(this.configDir, `${prof.id}.json`);
    fs.writeFileSync(profileFile, JSON.stringify(nodes, null, 2), 'utf8');

    prof.nodeCount = nodes.length;
    prof.updatedAt = Date.now();
    this.saveProfiles();

    if (prof.active) {
      this.generateMasterConfig(nodes);
    }

    if (this.progressCallback) {
      this.progressCallback({ phase: 'success', message: 'Готово' });
    }

    return prof;
  }

  public deleteSubscription(id: string): boolean {
    const idx = this.profiles.findIndex((p) => p.id === id);
    if (idx === -1) return false;

    const wasActive = this.profiles[idx].active;
    const profileFile = path.join(this.configDir, `${id}.json`);
    if (fs.existsSync(profileFile)) {
      try {
        fs.unlinkSync(profileFile);
      } catch {}
    }

    this.profiles.splice(idx, 1);

    if (wasActive && this.profiles.length > 0) {
      this.profiles[0].active = true;
      this.selectProfile(this.profiles[0].id);
    } else if (this.profiles.length === 0) {
      this.generateEmptyMasterConfig();
    }

    this.saveProfiles();
    return true;
  }

  public selectProfile(id: string): boolean {
    const target = this.profiles.find((p) => p.id === id);
    if (!target) return false;

    this.profiles.forEach((p) => (p.active = p.id === id));
    this.saveProfiles();

    const profileFile = path.join(this.configDir, `${id}.json`);
    if (fs.existsSync(profileFile)) {
      try {
        const raw = fs.readFileSync(profileFile, 'utf8');
        const nodes = JSON.parse(raw);
        this.generateMasterConfig(nodes);
        return true;
      } catch (e) {
        console.error('[SubscriptionManager] Failed to load profile nodes:', e);
      }
    }
    return false;
  }

  public generateMasterConfig(
    nodes: any[],
    options?: { mixedPort?: number; controllerPort?: number; dns?: string[]; tun?: boolean }
  ) {
    const mixedPort = options?.mixedPort || 7890;
    const controllerPort = options?.controllerPort || 9090;
    const dns = options?.dns || ['1.1.1.1', '8.8.8.8'];
    const tunEnabled = options?.tun || false;

    // Sanitize proxy names to be unique
    const seenNames = new Set<string>();
    const sanitizedNodes: any[] = [];
    const nodeNames: string[] = [];

    for (const node of nodes) {
      let name = (node.name || 'Server').trim();
      let uniqueName = name;
      let counter = 2;
      while (seenNames.has(uniqueName)) {
        uniqueName = `${name} (${counter++})`;
      }
      seenNames.add(uniqueName);
      node.name = uniqueName;
      sanitizedNodes.push(node);
      nodeNames.push(uniqueName);
    }

    const config: any = {
      'mixed-port': mixedPort,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'info',
      'external-controller': `127.0.0.1:${controllerPort}`,
      dns: {
        enable: true,
        nameserver: dns,
      },
      proxies: sanitizedNodes,
      'proxy-groups': [
        {
          name: 'Gravity',
          type: 'select',
          proxies: nodeNames.length > 0 ? ['Авто-выбор', ...nodeNames] : ['DIRECT'],
        },
        {
          name: 'Авто-выбор',
          type: 'url-test',
          proxies: nodeNames.length > 0 ? [...nodeNames] : ['DIRECT'],
          url: 'http://www.gstatic.com/generate_204',
          interval: 300,
        },
      ],
      rules: ['MATCH,Gravity'],
    };

    if (tunEnabled) {
      config.tun = {
        enable: true,
        stack: 'system',
        'auto-route': true,
        'auto-detect-interface': true,
        'dns-hijack': ['any:53'],
      };
    }

    const yamlStr = yaml.dump(config, { indent: 2, noArrayIndent: true });
    fs.writeFileSync(this.masterConfigPath, yamlStr, 'utf8');
    console.log(
      `[SubscriptionManager] Master config written with ${sanitizedNodes.length} nodes to ${this.masterConfigPath}`
    );
  }

  public generateEmptyMasterConfig(mixedPort = 7890, controllerPort = 9090) {
    const config: any = {
      'mixed-port': mixedPort,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'info',
      'external-controller': `127.0.0.1:${controllerPort}`,
      dns: {
        enable: true,
        nameserver: ['1.1.1.1', '8.8.8.8'],
      },
      proxies: [],
      'proxy-groups': [
        {
          name: 'Gravity',
          type: 'select',
          proxies: ['DIRECT'],
        },
      ],
      rules: ['MATCH,DIRECT'],
    };

    const yamlStr = yaml.dump(config, { indent: 2 });
    fs.writeFileSync(this.masterConfigPath, yamlStr, 'utf8');
    console.log(`[SubscriptionManager] Initialized starter config at ${this.masterConfigPath}`);
  }

  public ensureMasterConfigExists(mixedPort = 7890, controllerPort = 9090) {
    if (!fs.existsSync(this.masterConfigPath)) {
      const active = this.getActiveProfile();
      if (active) {
        const profileFile = path.join(this.configDir, `${active.id}.json`);
        if (fs.existsSync(profileFile)) {
          try {
            const raw = fs.readFileSync(profileFile, 'utf8');
            const nodes = JSON.parse(raw);
            this.generateMasterConfig(nodes, { mixedPort, controllerPort });
            return;
          } catch {}
        }
      }
      this.generateEmptyMasterConfig(mixedPort, controllerPort);
    }
  }
}
