import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Trash2, Smartphone, Copy, Check, Link2, AlertCircle } from 'lucide-react';
import { SubscriptionProfile, SubscriptionProgress, DeviceInfo } from '../types';

interface ProfilesProps {
  profiles: SubscriptionProfile[];
  deviceInfo?: DeviceInfo | null;
  onAddProfile: (url: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateProfile: (id: string) => Promise<{ success: boolean; error?: string }>;
  onDeleteProfile: (id: string) => Promise<void>;
  onSelectProfile: (id: string) => Promise<void>;
}

export const Profiles: React.FC<ProfilesProps> = ({
  profiles,
  deviceInfo,
  onAddProfile,
  onUpdateProfile,
  onDeleteProfile,
  onSelectProfile,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<SubscriptionProgress | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.onSubscriptionProgress) {
      const unsub = window.electronAPI.onSubscriptionProgress((p: SubscriptionProgress) => {
        setProgress(p);
      });
      return () => unsub();
    }
  }, []);

  const handleCopyDeviceId = () => {
    if (deviceInfo?.deviceId) {
      navigator.clipboard.writeText(deviceInfo.deviceId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) {
      setErrorMessage('Пожалуйста, укажите URL ссылки на подписку');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProgress({ phase: 'requesting', message: 'Загрузка подписки…' });

    const res = await onAddProfile(urlInput.trim(), nameInput.trim() || undefined);
    setIsLoading(false);

    if (res.success) {
      setUrlInput('');
      setNameInput('');
      setSuccessMessage('Подписка успешно загружена и активирована');
      setProgress(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setErrorMessage(res.error || 'Не удалось загрузить подписку. Проверьте ссылку.');
      setProgress(null);
    }
  };

  const handleUpdate = async (id: string) => {
    setUpdatingId(id);
    setErrorMessage(null);
    setProgress({ phase: 'requesting', message: 'Обновление подписки…' });

    const res = await onUpdateProfile(id);
    setUpdatingId(null);
    setProgress(null);

    if (!res.success) {
      setErrorMessage(res.error || 'Ошибка при обновлении профиля');
    }
  };

  const handleAddDemo = () => {
    setUrlInput('https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/test-sub.yaml');
    setNameInput('Gravity Демо-подписка');
  };

  return (
    <div className="h-full w-full flex flex-col p-6 select-none overflow-y-auto bg-[#0C0D0E]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-[#EDEDED] tracking-tight">
            Профили и подписки
          </h1>
          <p className="text-xs text-[#5F636E] mt-0.5">
            Импорт подписок с доверенным Device ID (Clash, Shadowsocks, VMess, VLESS, Trojan)
          </p>
        </div>

        {/* Device ID capsule */}
        {deviceInfo && (
          <div
            onClick={handleCopyDeviceId}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-[10px] bg-[#131417] hover:bg-[#18191D] border border-white/5 cursor-pointer transition-colors"
            title="Кликните, чтобы скопировать Device ID"
          >
            <Smartphone size={13} strokeWidth={1.8} className="text-[#9DA1AA]" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-mono text-[#5F636E] leading-none">
                Device ID
              </span>
              <span className="text-[11px] font-mono text-[#EDEDED] leading-tight mt-0.5">
                {deviceInfo.deviceId.substring(0, 8)}…{deviceInfo.deviceId.substring(deviceInfo.deviceId.length - 4)}
              </span>
            </div>
            {copiedId ? (
              <Check size={12} strokeWidth={2} className="text-[#EDEDED]" />
            ) : (
              <Copy size={12} strokeWidth={1.8} className="text-[#5F636E]" />
            )}
          </div>
        )}
      </div>

      {/* Input Form Card */}
      <div className="p-4 rounded-[14px] bg-[#131417] border border-white/5 mb-4 shrink-0">
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Link2 size={14} strokeWidth={1.8} className="text-[#9DA1AA]" />
              <span className="text-xs font-semibold text-[#EDEDED] uppercase tracking-wider">
                Добавить новую подписку
              </span>
            </div>

            {/* Live Progress indicator */}
            {progress && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-[7px] bg-[#18191D] border border-white/10 text-xs">
                <RefreshCw size={11} className="animate-spin text-[#EDEDED]" />
                <span className="font-medium text-[#EDEDED]">
                  {progress.message}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="md:col-span-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Вставьте ссылку на подписку (https://...)"
                className="w-full h-9 px-3.5 rounded-[10px] bg-[#18191D] border border-white/10 text-[#EDEDED] text-xs placeholder-[#5F636E] focus:outline-none focus:border-white/25 transition-colors font-sans"
                disabled={isLoading}
              />
            </div>
            <div>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Название (необязательно)"
                className="w-full h-9 px-3.5 rounded-[10px] bg-[#18191D] border border-white/10 text-[#EDEDED] text-xs placeholder-[#5F636E] focus:outline-none focus:border-white/25 transition-colors font-sans"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleAddDemo}
              className="text-xs text-[#5F636E] hover:text-[#EDEDED] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Вставить тестовую ссылку</span>
            </button>

            <button
              type="submit"
              disabled={isLoading || !urlInput.trim()}
              className="h-9 px-4 rounded-[10px] bg-[#EDEDED] hover:bg-[#FFFFFF] active:bg-[#D4D7DE] disabled:opacity-40 disabled:hover:bg-[#EDEDED] text-[#0C0D0E] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>{progress?.message || 'Загрузка...'}</span>
                </>
              ) : (
                <>
                  <Download size={13} strokeWidth={2} />
                  <span>Загрузить подписку</span>
                </>
              )}
            </button>
          </div>
        </form>

        {errorMessage && (
          <div className="mt-3 text-xs text-[#EDEDED] bg-[#1A1414] border border-[#B85858]/30 p-3 rounded-[10px] flex items-start gap-2.5">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-[#B85858]" />
            <div className="flex-1">
              <div className="font-medium text-[#EDEDED]">{errorMessage}</div>
              {errorMessage.includes('не распознал устройство') && (
                <div className="text-[11px] text-[#9DA1AA] mt-1 leading-relaxed">
                  Сервер подписки требует авторизации устройства. Device ID передан в заголовках. При необходимости переопределите User-Agent в разделе «Настройки».
                </div>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 text-xs text-[#EDEDED] bg-[#161816] border border-white/15 p-2.5 rounded-[10px] flex items-center gap-2">
            <Check size={13} strokeWidth={2} className="shrink-0 text-[#EDEDED]" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}
      </div>

      {/* Profiles List */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[#5F636E] mb-2">
          <span>Сохранённые профили</span>
          <span className="font-mono text-[#9DA1AA] lowercase">
            {profiles.length} шт.
          </span>
        </div>

        {profiles.length === 0 ? (
          <div className="p-8 rounded-[14px] bg-[#131417] border border-white/5 flex flex-col items-center justify-center text-center">
            <h3 className="text-xs font-semibold text-[#EDEDED] mb-1">
              Нет добавленных подписок
            </h3>
            <p className="text-xs text-[#5F636E] max-w-sm mb-3">
              Вставьте ссылку на подписку провайдера в поле выше для автоматической загрузки узлов.
            </p>
            <button
              onClick={handleAddDemo}
              className="text-xs text-[#9DA1AA] hover:text-[#EDEDED] underline cursor-pointer transition-colors"
            >
              Заполнить примером ссылки
            </button>
          </div>
        ) : (
          profiles.map((prof) => {
            const isUpdating = updatingId === prof.id;
            const updatedDate = new Date(prof.updatedAt).toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={prof.id}
                className={`p-3 rounded-[10px] transition-colors border ${
                  prof.active
                    ? 'bg-[#1C1E23] border-white/20'
                    : 'bg-[#131417] border-white/5 hover:border-white/10 hover:bg-[#18191D]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 truncate">
                    {/* Radio Button */}
                    <button
                      onClick={() => onSelectProfile(prof.id)}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        prof.active
                          ? 'border-white/60 bg-[#272930]'
                          : 'border-white/15 bg-transparent hover:border-white/30'
                      }`}
                      title={prof.active ? 'Активный профиль' : 'Сделать активным'}
                    >
                      {prof.active && <span className="w-1.5 h-1.5 rounded-full bg-[#EDEDED]" />}
                    </button>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#EDEDED] truncate font-sans">
                          {prof.name}
                        </span>
                        {prof.active && (
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-[7px] bg-[#272930] text-[#EDEDED] border border-white/10">
                            АКТИВЕН
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[7px] bg-[#0C0D0E] text-[#5F636E] border border-white/5">
                          {prof.nodeCount} узлов
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5F636E] font-mono truncate max-w-md mt-0.5">
                        {prof.url}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-[#5F636E] mr-1">
                      {updatedDate}
                    </span>

                    <button
                      onClick={() => handleUpdate(prof.id)}
                      disabled={isUpdating}
                      className="h-7 w-7 rounded-[7px] bg-[#18191D] hover:bg-[#1F2026] border border-white/5 text-[#5F636E] hover:text-[#EDEDED] flex items-center justify-center transition-colors cursor-pointer"
                      title="Обновить подписку"
                    >
                      <RefreshCw size={12} className={isUpdating ? 'animate-spin text-[#EDEDED]' : ''} />
                    </button>

                    <button
                      onClick={() => onDeleteProfile(prof.id)}
                      className="h-7 w-7 rounded-[7px] bg-[#18191D] hover:bg-[#1F2026] border border-white/5 text-[#5F636E] hover:text-[#EDEDED] flex items-center justify-center transition-colors cursor-pointer"
                      title="Удалить профиль"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
