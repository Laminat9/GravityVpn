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
        <div className="w-4 h-4 flex items-center justify-center">
          <svg viewBox="0 0 256 256" className="w-4 h-4" fill="none">
            <path
              d="M 128 38 C 168 54, 196 60, 204 74 C 206 132, 178 184, 128 218 C 78 184, 50 132, 52 74 C 60 60, 88 54, 128 38 Z"
              fill="#18191D"
              stroke="#D4D7DE"
              strokeWidth="16"
            />
            <path
              d="M 96 118 C 112 102, 128 102, 144 118 C 160 134, 176 134, 192 118"
              stroke="#EDEDED"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M 80 148 C 100 128, 120 128, 140 148 C 160 168, 180 168, 200 148"
              stroke="#9DA1AA"
              strokeWidth="14"
              strokeLinecap="round"
            />
          </svg>
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
