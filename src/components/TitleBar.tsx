import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const [isMax, setIsMax] = useState(false);

  useEffect(() => {
    const checkMax = async () => {
      if (window.electronAPI?.isMaximized) {
        const max = await window.electronAPI.isMaximized();
        setIsMax(max);
      }
    };
    checkMax();
    const interval = setInterval(checkMax, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximize();
    setIsMax(!isMax);
  };

  const handleClose = () => {
    window.electronAPI?.close();
  };

  return (
    <header className="h-9 w-full bg-[#0C0D0E] border-b border-white/5 flex items-center justify-between px-3 select-none app-drag-region z-50">
      {/* Brand logo & title */}
      <div className="flex items-center gap-2 app-no-drag">
        <div className="w-4 h-4 rounded-[4px] overflow-hidden flex items-center justify-center shrink-0">
          <img src="./assets/icon-256.png" className="w-full h-full object-contain" alt="Gravity" />
        </div>
        <span className="text-xs font-semibold text-[#EDEDED] tracking-tight">
          Gravity
        </span>
      </div>

      {/* Middle subtle hint */}
      <div className="text-[10px] text-[#43464F] font-mono tracking-widest uppercase">
        Windows Client
      </div>

      {/* Window Controls */}
      <div className="flex items-center app-no-drag">
        <button
          onClick={handleMinimize}
          className="h-9 w-10 flex items-center justify-center text-[#5F636E] hover:text-[#EDEDED] hover:bg-[#18191D] transition-colors cursor-pointer"
          title="Свернуть"
        >
          <Minus size={13} strokeWidth={1.8} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-9 w-10 flex items-center justify-center text-[#5F636E] hover:text-[#EDEDED] hover:bg-[#18191D] transition-colors cursor-pointer"
          title={isMax ? "Восстановить" : "Развернуть"}
        >
          {isMax ? <Copy size={11} strokeWidth={1.8} /> : <Square size={11} strokeWidth={1.8} />}
        </button>
        <button
          onClick={handleClose}
          className="h-9 w-10 flex items-center justify-center text-[#5F636E] hover:text-[#EDEDED] hover:bg-[#2A1D1D] transition-colors cursor-pointer"
          title="Закрыть"
        >
          <X size={13} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
};
