import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class WindowsProxyManager {
  private isEnabled: boolean = false;
  private currentPort: number = 7890;

  constructor(defaultPort = 7890) {
    this.currentPort = defaultPort;
  }

  public setPort(port: number) {
    this.currentPort = port;
  }

  public async enableSystemProxy(port = this.currentPort): Promise<boolean> {
    try {
      this.currentPort = port;
      const proxyServer = `127.0.0.1:${port}`;
      
      // Update Registry
      await execAsync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`);
      await execAsync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "${proxyServer}" /f`);
      
      // Notify Windows subsystems immediately via wininet.dll
      await this.notifySettingsChanged();
      
      this.isEnabled = true;
      console.log(`[WindowsProxyManager] System proxy enabled at ${proxyServer}`);
      return true;
    } catch (error) {
      console.error('[WindowsProxyManager] Failed to enable system proxy:', error);
      return false;
    }
  }

  public async disableSystemProxy(): Promise<boolean> {
    try {
      await execAsync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`);
      await this.notifySettingsChanged();
      this.isEnabled = false;
      console.log('[WindowsProxyManager] System proxy disabled');
      return true;
    } catch (error) {
      console.error('[WindowsProxyManager] Failed to disable system proxy:', error);
      return false;
    }
  }

  public async checkSystemProxy(): Promise<{ enabled: boolean; server?: string }> {
    try {
      const { stdout } = await execAsync(`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable`);
      const enabled = /0x1\s*$/m.test(stdout.trim());
      
      let server = undefined;
      if (enabled) {
        try {
          const serverQuery = await execAsync(`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer`);
          const match = serverQuery.stdout.match(/ProxyServer\s+REG_SZ\s+(.+)/);
          if (match) server = match[1].trim();
        } catch {
          // ignore
        }
      }
      this.isEnabled = enabled;
      return { enabled, server };
    } catch {
      return { enabled: false };
    }
  }

  private async notifySettingsChanged(): Promise<void> {
    try {
      const psCommand = `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinINet { [DllImport(\\\"wininet.dll\\\")] public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength); }'; [WinINet]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0); [WinINet]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0);"`;
      await execAsync(psCommand);
    } catch (e) {
      // Non-fatal, registry keys were still written
      console.warn('[WindowsProxyManager] wininet notification warning:', e);
    }
  }
}
