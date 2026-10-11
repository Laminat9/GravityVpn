import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { CoreLogEntry } from './types';

export class MihomoManager {
  private childProcess: ChildProcess | null = null;
  private binaryPath: string;
  private configDir: string;
  private configPath: string;
  private controllerPort: number;
  private isIntentionallyStopped: boolean = false;
  private logListeners: ((log: CoreLogEntry) => void)[] = [];
  private logHistory: CoreLogEntry[] = [];
  private maxLogHistory: number = 500;

  constructor(userDataPath: string, controllerPort = 9090) {
    this.controllerPort = controllerPort;
    this.configDir = path.join(userDataPath, 'mihomo');
    this.configPath = path.join(this.configDir, 'config.yaml');

    // In dev: ../core/mihomo.exe or ./core/mihomo.exe
    // In pack: process.resourcesPath/core/mihomo.exe
    const devPath = path.resolve(__dirname, '..', 'core', 'mihomo.exe');
    const packPath = path.join(process.resourcesPath, 'core', 'mihomo.exe');

    if (fs.existsSync(packPath)) {
      this.binaryPath = packPath;
    } else if (fs.existsSync(devPath)) {
      this.binaryPath = devPath;
    } else {
      // Fallback search
      const rootPath = path.resolve(process.cwd(), 'core', 'mihomo.exe');
      this.binaryPath = rootPath;
    }

    console.log(`[MihomoManager] Mihomo binary resolved at: ${this.binaryPath}`);
  }

  public onLog(listener: (log: CoreLogEntry) => void) {
    this.logListeners.push(listener);
    return () => {
      this.logListeners = this.logListeners.filter(l => l !== listener);
    };
  }

  public getLogHistory(): CoreLogEntry[] {
    return [...this.logHistory];
  }

  public clearLogs() {
    this.logHistory = [];
  }

  private addLog(type: 'info' | 'warning' | 'error' | 'debug', payload: string) {
    const entry: CoreLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      payload: payload.trim(),
      time: new Date().toLocaleTimeString('ru-RU', { hour12: false })
    };

    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxLogHistory) {
      this.logHistory.shift();
    }

    for (const listener of this.logListeners) {
      try {
        listener(entry);
      } catch {}
    }
  }

  public isRunning(): boolean {
    return this.childProcess !== null && !this.childProcess.killed;
  }

  public start(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isRunning()) {
        console.log('[MihomoManager] Already running');
        return resolve(true);
      }

      if (!fs.existsSync(this.binaryPath)) {
        const err = `Бинарный файл mihomo.exe не найден по пути: ${this.binaryPath}`;
        console.error('[MihomoManager]', err);
        this.addLog('error', err);
        return resolve(false);
      }

      if (!fs.existsSync(this.configPath)) {
        const err = `Файл конфигурации не найден: ${this.configPath}`;
        console.error('[MihomoManager]', err);
        this.addLog('error', err);
        return resolve(false);
      }

      this.isIntentionallyStopped = false;
      this.addLog('info', `Запуск ядра Mihomo: ${this.binaryPath}`);

      try {
        this.childProcess = spawn(this.binaryPath, ['-d', this.configDir, '-f', this.configPath], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        this.childProcess.stdout?.on('data', (data) => {
          const lines = data.toString().split(/\r?\n/).filter(Boolean);
          for (const line of lines) {
            let type: 'info' | 'warning' | 'error' | 'debug' = 'info';
            if (/error|failed|fatal/i.test(line)) type = 'error';
            else if (/warn/i.test(line)) type = 'warning';
            else if (/debug/i.test(line)) type = 'debug';
            this.addLog(type, line);
          }
        });

        this.childProcess.stderr?.on('data', (data) => {
          const lines = data.toString().split(/\r?\n/).filter(Boolean);
          for (const line of lines) {
            this.addLog('warning', line);
          }
        });

        this.childProcess.on('exit', (code, signal) => {
          this.addLog('warning', `Ядро Mihomo завершило работу (код: ${code}, сигнал: ${signal})`);
          this.childProcess = null;

          if (!this.isIntentionallyStopped) {
            this.addLog('info', 'Попытка перезапуска ядра через 2 секунды...');
            setTimeout(() => {
              if (!this.isIntentionallyStopped) this.start();
            }, 2000);
          }
        });

        this.childProcess.on('error', (err) => {
          this.addLog('error', `Ошибка процесса Mihomo: ${err.message}`);
        });

        // Wait a brief moment to confirm it didn't immediately crash
        setTimeout(async () => {
          const alive = this.isRunning();
          if (alive) {
            this.addLog('info', 'Ядро Mihomo успешно запущено и готово к работе');
          }
          resolve(alive);
        }, 800);
      } catch (err: any) {
        this.addLog('error', `Не удалось запустить Mihomo: ${err.message}`);
        resolve(false);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.isIntentionallyStopped = true;
      if (!this.childProcess) {
        return resolve();
      }

      this.addLog('info', 'Остановка ядра Mihomo...');
      const proc = this.childProcess;
      this.childProcess = null;

      try {
        proc.kill('SIGINT');
        setTimeout(() => {
          try {
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
          } catch {}
          resolve();
        }, 500);
      } catch {
        resolve();
      }
    });
  }

  // REST API Client
  private apiRequest(endpoint: string, method = 'GET', body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: '127.0.0.1',
        port: this.controllerPort,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            if (!data) return resolve(null);
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          } else {
            reject(new Error(`API ${endpoint} HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Таймаут запроса к контроллеру Mihomo (${endpoint})`));
      });

      req.on('error', (e) => reject(e));

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  public async reloadConfig(): Promise<boolean> {
    try {
      this.addLog('info', 'Перезагрузка конфигурации ядра...');
      await this.apiRequest('/configs?force=true', 'PUT', { path: this.configPath });
      this.addLog('info', 'Конфигурация успешно обновлена');
      return true;
    } catch (e: any) {
      this.addLog('error', `Ошибка перезагрузки конфигурации: ${e.message}`);
      return false;
    }
  }

  public async getProxies(): Promise<any> {
    try {
      return await this.apiRequest('/proxies');
    } catch (e) {
      return null;
    }
  }

  public async testProxyDelay(name: string, url = 'http://www.gstatic.com/generate_204'): Promise<number> {
    try {
      const res = await this.apiRequest(`/proxies/${encodeURIComponent(name)}/delay?timeout=5000&url=${encodeURIComponent(url)}`);
      return res?.delay ?? 0;
    } catch {
      return -1; // timeout / unreachable
    }
  }

  public async selectProxy(groupName: string, proxyName: string): Promise<boolean> {
    try {
      this.addLog('info', `Выбор узла [${proxyName}] для группы [${groupName}]`);
      await this.apiRequest(`/proxies/${encodeURIComponent(groupName)}`, 'PUT', { name: proxyName });
      return true;
    } catch (e: any) {
      this.addLog('error', `Ошибка выбора узла: ${e.message}`);
      return false;
    }
  }

  public async getConfigs(): Promise<any> {
    try {
      return await this.apiRequest('/configs');
    } catch {
      return null;
    }
  }
}
