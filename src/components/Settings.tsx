import React, { useState } from 'react';
import { Sliders, Shield, Network, HardDrive, Cpu, Check, Smartphone, Copy, Globe } from 'lucide-react';
import { AppSettings, DeviceInfo } from '../types';

interface SettingsProps {
  settings: AppSettings;
  deviceInfo?: DeviceInfo | null;
  onSaveSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({ settings, deviceInfo, onSaveSettings }) => {
  const [mixedPort, setMixedPort] = useState(settings.mixedPort.toString());
  const [controllerPort, setControllerPort] = useState(settings.controllerPort.toString());
  const [networkMode, setNetworkMode] = useState(settings.networkMode);
  const [autoStart, setAutoStart] = useState(settings.autoStart);
  const [minimizeToTray, setMinimizeToTray] = useState(settings.minimizeToTray);
  const [closeToTray, setCloseToTray] = useState(settings.closeToTray);
  const [autoConnectNearest, setAutoConnectNearest] = useState(settings.autoConnectNearest);
  const [customUserAgent, setCustomUserAgent] = useState(settings.customUserAgent || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleSave = async () => {
    await onSaveSettings({
      mixedPort: parseInt(mixedPort, 10) || 7890,
      controllerPort: parseInt(controllerPort, 10) || 9090,
      networkMode,
      autoStart,
      minimizeToTray,
      closeToTray,
      autoConnectNearest,
      customUserAgent: customUserAgent.trim(),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleCopyId = () => {
    if (deviceInfo?.deviceId) {
      navigator.clipboard.writeText(deviceInfo.deviceId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleToggle = (setter: React.Dispatch<React.SetStateAction<boolean>>, current: boolean) => {
    setter(!current);
  };

  const defaultUaPreview = deviceInfo?.deviceId
    ? `Gravity/1.0 (Windows NT 10.0; Win64; x64; DeviceID: ${deviceInfo.deviceId})`
    : 'Gravity/1.0 (Windows NT 10.0; Win64; x64; DeviceID: <uuid>)';

  return (
    <div className="h-full w-full flex flex-col p-6 select-none overflow-y-auto bg-[#0C0D0E]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-[#EDEDED] tracking-tight">
            Настройки
          </h1>
          <p className="text-xs text-[#5F636E] mt-0.5">
            Параметры сетевого туннеля, идентификатора устройства и интеграции с Windows
          </p>
        </div>

        <button
          onClick={handleSave}
          className="h-9 px-4 rounded-[10px] bg-[#EDEDED] hover:bg-[#FFFFFF] active:bg-[#D4D7DE] text-[#0C0D0E] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
        >
          {savedSuccess ? <Check size={13} strokeWidth={2} /> : <Sliders size={13} strokeWidth={2} />}
          <span>{savedSuccess ? 'Сохранено' : 'Сохранить настройки'}</span>
        </button>
      </div>

      <div className="space-y-3.5">
        {/* Device ID Card */}
        <div className="p-4 rounded-[14px] bg-[#131417] border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Smartphone size={15} strokeWidth={1.8} className="text-[#9DA1AA]" />
              <h2 className="text-xs font-semibold text-[#EDEDED] uppercase tracking-wider">
                Идентификатор устройства (Device ID)
              </h2>
            </div>
            {deviceInfo && (
              <span className="text-[11px] font-mono text-[#9DA1AA] bg-[#18191D] border border-white/5 px-2 py-0.5 rounded-[7px]">
                Хост: {deviceInfo.deviceName}
              </span>
            )}
          </div>

          <p className="text-xs text-[#5F636E] leading-relaxed mb-3">
            Стабильный уникальный UUID v4. Передаётся в заголовках <span className="font-mono text-[#EDEDED]">User-Agent</span> и <span className="font-mono text-[#EDEDED]">X-Hwid</span> при запросе подписок, благодаря чему сервер принимает Gravity как доверенный клиент.
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-9 px-3 rounded-[10px] bg-[#18191D] border border-white/10 text-xs font-mono text-[#EDEDED] flex items-center select-text">
              {deviceInfo?.deviceId || 'Загрузка...'}
            </div>
            <button
              onClick={handleCopyId}
              className="h-9 px-3.5 rounded-[10px] bg-[#18191D] hover:bg-[#1F2026] border border-white/10 text-xs font-medium text-[#EDEDED] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Скопировать Device ID"
            >
              {copiedId ? <Check size={12} strokeWidth={2} className="text-[#EDEDED]" /> : <Copy size={12} />}
              <span>{copiedId ? 'Скопировано' : 'Копировать'}</span>
            </button>
          </div>
        </div>

        {/* User-Agent Configuration Card */}
        <div className="p-4 rounded-[14px] bg-[#131417] border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={15} strokeWidth={1.8} className="text-[#9DA1AA]" />
            <h2 className="text-xs font-semibold text-[#EDEDED] uppercase tracking-wider">
              User-Agent для запроса подписок
            </h2>
          </div>

          <p className="text-xs text-[#5F636E] leading-relaxed mb-3">
            Если сервер подписки требует эмуляции конкретного клиента, переопределите заголовок ниже. По умолчанию используется нативный формат с вашим Device ID:
          </p>

          <div className="space-y-2">
            <input
              type="text"
              value={customUserAgent}
              onChange={(e) => setCustomUserAgent(e.target.value)}
              placeholder={defaultUaPreview}
              className="w-full h-9 px-3.5 rounded-[10px] bg-[#18191D] border border-white/10 text-xs font-mono text-[#EDEDED] placeholder-[#5F636E] focus:outline-none focus:border-white/25 transition-colors font-sans"
            />

            {/* Presets */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[10px] text-[#5F636E] uppercase font-mono mr-1">
                Пресеты:
              </span>
              <button
                type="button"
                onClick={() => setCustomUserAgent('')}
                className="text-[11px] px-2.5 py-1 rounded-[7px] bg-[#18191D] hover:bg-[#1F2026] border border-white/5 text-[#EDEDED] font-medium transition-colors cursor-pointer"
              >
                По умолчанию (Gravity)
              </button>
              <button
                type="button"
                onClick={() => setCustomUserAgent('Happ/2.5.0 (Windows NT 10.0; Win64; x64)')}
                className="text-[11px] px-2.5 py-1 rounded-[7px] bg-[#18191D] hover:bg-[#1F2026] border border-white/5 text-[#9DA1AA] hover:text-[#EDEDED] font-medium transition-colors cursor-pointer"
              >
                Happ Client
              </button>
              <button
                type="button"
                onClick={() => setCustomUserAgent('ClashMeta/v1.19.32')}
                className="text-[11px] px-2.5 py-1 rounded-[7px] bg-[#18191D] hover:bg-[#1F2026] border border-white/5 text-[#9DA1AA] hover:text-[#EDEDED] font-medium transition-colors cursor-pointer"
              >
                Clash.Meta
              </button>
              <button
                type="button"
                onClick={() => setCustomUserAgent('v2rayNG/1.8.19')}
                className="text-[11px] px-2.5 py-1 rounded-[7px] bg-[#18191D] hover:bg-[#1F2026] border border-white/5 text-[#9DA1AA] hover:text-[#EDEDED] font-medium transition-colors cursor-pointer"
              >
                v2rayNG
              </button>
            </div>
          </div>
        </div>

        {/* Network Mode Card */}
        <div className="p-4 rounded-[14px] bg-[#131417] border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Network size={15} strokeWidth={1.8} className="text-[#9DA1AA]" />
            <h2 className="text-xs font-semibold text-[#EDEDED] uppercase tracking-wider">
              Режим работы сети
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* System Proxy */}
            <div
              onClick={() => setNetworkMode('system-proxy')}
              className={`p-3.5 rounded-[10px] border cursor-pointer transition-colors ${
                networkMode === 'system-proxy'
                  ? 'bg-[#1C1E23] border-white/20'
                  : 'bg-[#18191D] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[#EDEDED]">
                  Системный прокси (Рекомендуется)
                </span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    networkMode === 'system-proxy'
                      ? 'border-white/60 bg-[#272930]'
                      : 'border-white/15 bg-transparent'
                  }`}
                >
                  {networkMode === 'system-proxy' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EDEDED]" />
                  )}
                </div>
              </div>
              <p className="text-xs text-[#5F636E] leading-relaxed">
                Настраивает системный шлюз Windows. Не требует прав администратора, надёжно работает в браузерах и программах.
              </p>
            </div>

            {/* TUN Mode */}
            <div
              onClick={() => setNetworkMode('tun')}
              className={`p-3.5 rounded-[10px] border cursor-pointer transition-colors ${
                networkMode === 'tun'
                  ? 'bg-[#1C1E23] border-white/20'
                  : 'bg-[#18191D] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[#EDEDED]">
                  TUN-режим (Прямой адаптер)
                </span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    networkMode === 'tun'
                      ? 'border-white/60 bg-[#272930]'
                      : 'border-white/15 bg-transparent'
                  }`}
                >
                  {networkMode === 'tun' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EDEDED]" />
                  )}
                </div>
              </div>
              <p className="text-xs text-[#5F636E] leading-relaxed">
                Перехватывает сетевые пакеты всей системы на уровне виртуального сетевого адаптера Wintun.
              </p>
            </div>
          </div>
        </div>

        {/* Ports Configuration */}
        <div className="p-4 rounded-[14px] bg-[#131417] border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={15} strokeWidth={1.8} className="text-[#9DA1AA]" />
            <h2 className="text-xs font-semibold text-[#EDEDED] uppercase tracking-wider">
              Сетевые порты ядра
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#5F636E] block mb-1">
                Mixed Port (HTTP / SOCKS5):
              </label>
              <input
                type="number"
                value={mixedPort}
                onChange={(e) => setMixedPort(e.target.value)}
                className="w-full h-9 px-3 rounded-[10px] bg-[#18191D] border border-white/10 text-xs font-mono text-[#EDEDED] focus:outline-none focus:border-white/25 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-[#5F636E] block mb-1">
                External Controller (REST API):
              </label>
              <input
                type="number"
                value={controllerPort}
                onChange={(e) => setControllerPort(e.target.value)}
                className="w-full h-9 px-3 rounded-[10px] bg-[#18191D] border border-white/10 text-xs font-mono text-[#EDEDED] focus:outline-none focus:border-white/25 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* System Behavior Toggles */}
        <div className="p-4 rounded-[14px] bg-[#131417] border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={15} strokeWidth={1.8} className="text-[#9DA1AA]" />
            <h2 className="text-xs font-semibold text-[#EDEDED] uppercase tracking-wider">
              Система и интерфейс
            </h2>
          </div>

          <div className="space-y-3">
            {/* Auto Start */}
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-xs font-medium text-[#EDEDED]">
                  Автозапуск при старте Windows
                </div>
                <div className="text-xs text-[#5F636E]">
                  Запускать Gravity в фоновом режиме при старте операционной системы
                </div>
              </div>
              <button
                onClick={() => handleToggle(setAutoStart, autoStart)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  autoStart ? 'bg-[#EDEDED]' : 'bg-[#1F2026] border border-white/10'
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-transform ${
                    autoStart ? 'right-[3px] bg-[#0C0D0E]' : 'left-[3px] bg-[#5F636E]'
                  }`}
                />
              </button>
            </div>

            {/* Minimize to tray */}
            <div className="flex items-center justify-between py-1 border-t border-white/5">
              <div>
                <div className="text-xs font-medium text-[#EDEDED]">
                  Сворачивать в системный трей
                </div>
                <div className="text-xs text-[#5F636E]">
                  Оставлять иконку в области уведомлений Windows рядом с часами
                </div>
              </div>
              <button
                onClick={() => handleToggle(setMinimizeToTray, minimizeToTray)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  minimizeToTray ? 'bg-[#EDEDED]' : 'bg-[#1F2026] border border-white/10'
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-transform ${
                    minimizeToTray ? 'right-[3px] bg-[#0C0D0E]' : 'left-[3px] bg-[#5F636E]'
                  }`}
                />
              </button>
            </div>

            {/* Close to tray */}
            <div className="flex items-center justify-between py-1 border-t border-white/5">
              <div>
                <div className="text-xs font-medium text-[#EDEDED]">
                  Не выгружать ядро при закрытии окна
                </div>
                <div className="text-xs text-[#5F636E]">
                  Клик по крестику скрывает окно, соединение остаётся активным в фоне
                </div>
              </div>
              <button
                onClick={() => handleToggle(setCloseToTray, closeToTray)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  closeToTray ? 'bg-[#EDEDED]' : 'bg-[#1F2026] border border-white/10'
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-transform ${
                    closeToTray ? 'right-[3px] bg-[#0C0D0E]' : 'left-[3px] bg-[#5F636E]'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* About App Info */}
        <div className="p-3.5 rounded-[10px] bg-[#131417] border border-white/5 text-xs text-[#5F636E] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[7px] bg-[#18191D] border border-white/5 flex items-center justify-center text-[#9DA1AA]">
              <Shield size={15} strokeWidth={1.8} />
            </div>
            <div>
              <div className="font-medium text-[#EDEDED]">Gravity VPN Client</div>
              <div className="text-[11px] font-mono text-[#5F636E]">
                Версия 1.0.0 · Ядро Mihomo Meta v1.19.32
              </div>
            </div>
          </div>
          <div className="text-[11px] font-mono text-[#EDEDED] bg-[#18191D] border border-white/10 px-2.5 py-1 rounded-[7px]">
            Ready
          </div>
        </div>
      </div>
    </div>
  );
};
