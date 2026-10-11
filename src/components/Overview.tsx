import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ArrowDown, ArrowUp, Activity, Globe2, Wifi, Zap, RefreshCw } from 'lucide-react';
import { VpnStatus, TrafficStats } from '../types';
import { vpnEngine } from '../services/vpnEngine';

interface OverviewProps {
  status: VpnStatus;
  traffic: TrafficStats;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  activePing: number;
}

export const Overview: React.FC<OverviewProps> = ({
  status,
  traffic,
  onConnect,
  onDisconnect,
  activePing,
}) => {
  const [sessionTime, setSessionTime] = useState('00:00:00');
  const [publicIp, setPublicIp] = useState(status.ip || '---');
  const [loadingIp, setLoadingIp] = useState(false);

  // Session duration timer
  useEffect(() => {
    let interval: any = null;
    if (status.connected && status.sessionStartTime) {
      const updateTimer = () => {
        const diff = Math.floor((Date.now() - status.sessionStartTime!) / 1000);
        const hrs = Math.floor(diff / 3600).toString().padStart(2, '0');
        const mins = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const secs = (diff % 60).toString().padStart(2, '0');
        setSessionTime(`${hrs}:${mins}:${secs}`);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setSessionTime('00:00:00');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status.connected, status.sessionStartTime]);

  const refreshIp = async () => {
    setLoadingIp(true);
    try {
      const res = await vpnEngine.getPublicIp();
      if (res?.ip) setPublicIp(res.ip);
    } catch {}
    setLoadingIp(false);
  };

  useEffect(() => {
    refreshIp();
  }, [status.connected]);

  const handleToggle = async () => {
    if (status.connecting) return;
    if (status.connected) {
      await onDisconnect();
    } else {
      await onConnect();
    }
  };

  return (
    <div className="h-full w-full flex flex-col justify-between p-6 select-none overflow-y-auto bg-[#0C0D0E]">
      {/* Top Header & Status Pill */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#EDEDED] tracking-tight">
            Обзор
          </h1>
          <p className="text-xs text-[#5F636E] mt-0.5">
            {status.connected
              ? 'Трафик направляется через защищённый туннель Mihomo'
              : 'Соединение отключено. Прямой доступ к сети.'}
          </p>
        </div>

        {/* Status Pill */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
            status.connected
              ? 'bg-[#18191D] border-white/20 text-[#EDEDED]'
              : status.connecting
              ? 'bg-[#18191D] border-white/10 text-[#9DA1AA]'
              : 'bg-[#131417] border-white/5 text-[#5F636E]'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status.connected
                ? 'bg-[#EDEDED] animate-subtle-pulse'
                : status.connecting
                ? 'bg-[#9DA1AA] animate-pulse'
                : 'bg-[#43464F]'
            }`}
          />
          <span className="text-xs font-medium">
            {status.connected
              ? 'Защищено'
              : status.connecting
              ? 'Подключение...'
              : 'Не подключено'}
          </span>
        </div>
      </div>

      {/* Center Connect Button */}
      <div className="my-auto flex flex-col items-center justify-center py-6">
        <button
          onClick={handleToggle}
          disabled={status.connecting}
          className={`group relative w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 border ${
            status.connected
              ? 'bg-[#1C1E24] border-white/25 hover:border-white/40'
              : status.connecting
              ? 'bg-[#18191D] border-white/15'
              : 'bg-[#131417] border-white/10 hover:border-white/25 hover:bg-[#18191D]'
          }`}
        >
          {/* Center Icon */}
          <div className="text-[#EDEDED] transition-transform group-hover:scale-105">
            {status.connected ? (
              <ShieldCheck size={42} strokeWidth={1.8} />
            ) : status.connecting ? (
              <Zap size={38} strokeWidth={1.8} className="animate-pulse" />
            ) : (
              <Shield size={40} strokeWidth={1.8} className="text-[#9DA1AA] group-hover:text-[#EDEDED]" />
            )}
          </div>

          {/* Sub-label */}
          <span className="text-[11px] font-medium tracking-wider uppercase mt-2 text-[#EDEDED]">
            {status.connected
              ? 'Отключить'
              : status.connecting
              ? 'Ожидание...'
              : 'Подключить'}
          </span>
        </button>

        {/* Timer under button */}
        <div className="mt-5 flex flex-col items-center">
          <span className="text-[10px] uppercase font-medium tracking-wider text-[#5F636E]">
            Время сессии
          </span>
          <span className="text-base font-mono font-medium text-[#EDEDED] mt-0.5 tracking-wider">
            {sessionTime}
          </span>
        </div>

        {status.error && (
          <div className="mt-3 text-xs text-[#9DA1AA] bg-[#18191D] border border-white/10 px-3 py-1.5 rounded-[10px]">
            {status.error}
          </div>
        )}
      </div>

      {/* Speed Metrics Block */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Download Card */}
        <div className="p-3.5 rounded-[10px] bg-[#131417] border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[7px] bg-[#18191D] border border-white/5 flex items-center justify-center text-[#9DA1AA]">
              <ArrowDown size={15} strokeWidth={2} />
            </div>
            <div>
              <span className="text-[10px] font-medium tracking-wider uppercase text-[#5F636E] block">
                Скачать
              </span>
              <div className="text-sm font-mono text-[#EDEDED] tracking-tight">
                {status.connected ? traffic.downSpeedFormatted : '0.0 Мбит/с'}
              </div>
            </div>
          </div>
        </div>

        {/* Upload Card */}
        <div className="p-3.5 rounded-[10px] bg-[#131417] border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[7px] bg-[#18191D] border border-white/5 flex items-center justify-center text-[#9DA1AA]">
              <ArrowUp size={15} strokeWidth={2} />
            </div>
            <div>
              <span className="text-[10px] font-medium tracking-wider uppercase text-[#5F636E] block">
                Отдача
              </span>
              <div className="text-sm font-mono text-[#EDEDED] tracking-tight">
                {status.connected ? traffic.upSpeedFormatted : '0.0 Мбит/с'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network Info Strip */}
      <div className="p-3 rounded-[10px] bg-[#131417] border border-white/5 grid grid-cols-3 gap-2 text-xs">
        {/* IP Address */}
        <div className="flex items-center gap-2.5 px-2">
          <Globe2 size={14} className="text-[#5F636E] shrink-0" />
          <div className="truncate">
            <div className="text-[10px] text-[#5F636E] uppercase font-medium">IP-адрес</div>
            <div className="font-mono text-[#EDEDED] font-medium flex items-center gap-1.5">
              <span>{publicIp}</span>
              <button
                onClick={refreshIp}
                className="text-[#5F636E] hover:text-[#EDEDED] p-0.5 rounded transition-colors cursor-pointer"
                title="Обновить IP"
              >
                <RefreshCw size={10} className={loadingIp ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Location / Node */}
        <div className="flex items-center gap-2.5 px-2 border-l border-white/5">
          <Wifi size={14} className="text-[#5F636E] shrink-0" />
          <div className="truncate">
            <div className="text-[10px] text-[#5F636E] uppercase font-medium">Активный узел</div>
            <div className="font-medium text-[#EDEDED] truncate font-sans text-xs">
              {status.activeNode || (status.connected ? 'Авто-выбор' : 'Не выбран')}
            </div>
          </div>
        </div>

        {/* Latency */}
        <div className="flex items-center gap-2.5 px-2 border-l border-white/5">
          <Activity size={14} className="text-[#5F636E] shrink-0" />
          <div>
            <div className="text-[10px] text-[#5F636E] uppercase font-medium">Задержка (Ping)</div>
            <div className="font-mono text-[#EDEDED]">
              {status.connected ? `${activePing} ms` : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
