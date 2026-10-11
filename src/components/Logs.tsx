import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Copy, Check, Search } from 'lucide-react';
import { CoreLogEntry } from '../types';

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<CoreLogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load initial logs
    if (window.electronAPI?.getLogHistory) {
      window.electronAPI.getLogHistory().then((history: CoreLogEntry[]) => {
        if (history) setLogs(history);
      });
    }

    // Subscribe to new incoming logs
    if (window.electronAPI?.onLog) {
      const unsubscribe = window.electronAPI.onLog((entry: CoreLogEntry) => {
        setLogs((prev) => [...prev.slice(-400), entry]);
      });
      return () => unsubscribe();
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClear = async () => {
    if (window.electronAPI?.clearLogs) {
      await window.electronAPI.clearLogs();
    }
    setLogs([]);
  };

  const handleCopy = () => {
    const text = filteredLogs
      .map((l) => `[${l.time}] [${l.type.toUpperCase()}] ${l.payload}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = filterLevel === 'all' || log.type === filterLevel;
    const matchesSearch =
      !searchTerm || log.payload.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const getBadgeClass = (type: CoreLogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'bg-[#241A1A] text-[#E09090] border-[#B85858]/30';
      case 'warning':
        return 'bg-[#24221D] text-[#CFCAC0] border-white/10';
      case 'debug':
        return 'bg-[#18191D] text-[#9DA1AA] border-white/5';
      default:
        return 'bg-[#1F2026] text-[#EDEDED] border-white/10';
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-6 select-none overflow-hidden bg-[#0C0D0E] font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-[#EDEDED] tracking-tight">
            Логи ядра
          </h1>
          <p className="text-xs text-[#5F636E] mt-0.5">
            Прямой поток сообщений процесса Mihomo и системного прокси
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="h-8 px-3 rounded-[10px] bg-[#18191D] hover:bg-[#1F2026] border border-white/10 text-xs text-[#EDEDED] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Копировать в буфер"
          >
            {copied ? <Check size={12} className="text-[#EDEDED]" /> : <Copy size={12} />}
            <span>{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>

          <button
            onClick={handleClear}
            className="h-8 px-3 rounded-[10px] bg-[#18191D] hover:bg-[#1F2026] border border-white/10 text-xs text-[#5F636E] hover:text-[#EDEDED] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Очистить лог"
          >
            <Trash2 size={12} />
            <span>Очистить</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div className="flex items-center gap-1 bg-[#131417] p-1 rounded-[10px] border border-white/5">
          {['all', 'info', 'warning', 'error'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-3 py-1 rounded-[7px] text-xs font-medium uppercase transition-colors cursor-pointer ${
                filterLevel === lvl
                  ? 'bg-[#1F2026] text-[#EDEDED] border border-white/10'
                  : 'text-[#5F636E] hover:text-[#9DA1AA]'
              }`}
            >
              {lvl === 'all' ? 'Все' : lvl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F636E]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по строке лога..."
              className="h-8 pl-8 pr-3 w-56 rounded-[10px] bg-[#131417] border border-white/10 text-xs text-[#EDEDED] placeholder-[#5F636E] focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#5F636E] hover:text-[#9DA1AA] cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-[#18191D] border-white/20 accent-[#EDEDED] cursor-pointer"
            />
            <span>Автопрокрутка</span>
          </label>
        </div>
      </div>

      {/* Terminal View */}
      <div
        ref={logContainerRef}
        className="flex-1 bg-[#0F1012] rounded-[14px] border border-white/5 p-3.5 overflow-y-auto space-y-1 select-text font-mono text-xs leading-relaxed"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-[#5F636E] text-center py-12 font-sans">
            Журнал пуст
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5 hover:bg-white/[0.02] px-1 py-0.5 rounded-[4px]">
              <span className="text-[#5F636E] shrink-0 text-[11px]">
                {log.time}
              </span>
              <span
                className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded-[4px] border shrink-0 ${getBadgeClass(
                  log.type
                )}`}
              >
                {log.type}
              </span>
              <span className="text-[#D4D7DE] break-all font-mono">
                {log.payload}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
