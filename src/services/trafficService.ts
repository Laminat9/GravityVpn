import { TrafficStats } from '../types';

export type TrafficListener = (stats: TrafficStats) => void;

class TrafficService {
  private ws: WebSocket | null = null;
  private listeners: TrafficListener[] = [];
  private controllerPort: number = 9090;
  private reconnectTimer: any = null;
  private isDisposed: boolean = false;
  private totalUp = 0;
  private totalDown = 0;

  constructor(port = 9090) {
    this.controllerPort = port;
  }

  public setPort(port: number) {
    if (this.controllerPort !== port) {
      this.controllerPort = port;
      this.reconnect();
    }
  }

  public subscribe(listener: TrafficListener): () => void {
    this.listeners.push(listener);
    if (!this.ws) {
      this.connect();
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
      if (this.listeners.length === 0) {
        this.disconnect();
      }
    };
  }

  private connect() {
    if (this.isDisposed || this.ws) return;

    try {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.controllerPort}/traffic`);

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const up = data.up || 0;
          const down = data.down || 0;

          this.totalUp += up;
          this.totalDown += down;

          const stats: TrafficStats = {
            up,
            down,
            upSpeedFormatted: this.formatSpeed(up),
            downSpeedFormatted: this.formatSpeed(down),
            totalUpBytes: this.totalUp,
            totalDownBytes: this.totalDown,
          };

          for (const listener of this.listeners) {
            listener(stats);
          }
        } catch {}
      };

      this.ws.onerror = () => {
        this.scheduleReconnect();
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.isDisposed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.listeners.length > 0) {
        this.connect();
      }
    }, 3000);
  }

  private reconnect() {
    this.disconnect();
    this.connect();
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  public formatSpeed(bytesPerSec: number): string {
    const bits = bytesPerSec * 8;
    if (bits >= 1_000_000_000) {
      return `${(bits / 1_000_000_000).toFixed(1)} Гбит/с`;
    }
    if (bits >= 1_000_000) {
      return `${(bits / 1_000_000).toFixed(1)} Мбит/с`;
    }
    if (bits >= 1_000) {
      return `${(bits / 1_000).toFixed(0)} Кбит/с`;
    }
    return `${bytesPerSec} Б/с`;
  }

  public dispose() {
    this.isDisposed = true;
    this.disconnect();
    this.listeners = [];
  }
}

export const trafficService = new TrafficService();
