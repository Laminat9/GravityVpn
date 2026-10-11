import React from 'react';
import { Shield, FolderGit2, Globe, Terminal, Sliders } from 'lucide-react';
import { TabType, VpnStatus } from '../types';

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  status: VpnStatus;
  activePing?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  status,
  activePing = 18,
}) => {
  const tabs = [
    { id: 'overview' as TabType, label: 'Обзор', icon: Shield },
    { id: 'profiles' as TabType, label: 'Профили', icon: FolderGit2 },
    { id: 'proxies' as TabType, label: 'Серверы', icon: Globe },
    { id: 'logs' as TabType, label: 'Логи', icon: Terminal },
    { id: 'settings' as TabType, label: 'Настройки', icon: Sliders },
  ];

  const displayNodeName = status.activeNode
    ? status.activeNode.length > 15
      ? status.activeNode.substring(0, 14) + '…'
      : status.activeNode
    : 'AMS-04';

  return (
    <aside className="w-[210px] h-full bg-[#131417] border-r border-white/5 flex flex-col justify-between select-none shrink-0 z-20">
      {/* Top Header Logo */}
      <div>
        <div className="p-4 pb-4 flex items-center gap-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-[10px] bg-[#18191D] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            <img src="./assets/icon-256.png" className="w-full h-full object-contain" alt="Gravity" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-[#EDEDED]">
                Gravity
              </span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-[4px] bg-[#1F2026] text-[#9DA1AA] border border-white/5">
                v1.0
              </span>
            </div>
            <p className="text-[10px] text-[#5F636E] tracking-wide mt-0.5">
              Proxy Client
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="p-2 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#1C1E23] text-[#EDEDED] border border-white/10'
                    : 'text-[#5F636E] hover:text-[#9DA1AA] hover:bg-[#18191D]'
                }`}
              >
                <div className={isActive ? 'text-[#EDEDED]' : 'text-[#5F636E]'}>
                  <Icon size={15} strokeWidth={isActive ? 2 : 1.7} />
                </div>
                <span>{tab.label}</span>
                {isActive && (
                  <span className="ml-auto w-1 h-1 rounded-full bg-[#EDEDED]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Current Server Indicator */}
      <div className="p-3 border-t border-white/5 bg-[#0F1012]">
        <div className="p-2.5 rounded-[10px] bg-[#18191D] border border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-medium tracking-wider text-[#5F636E]">
              Текущий узел
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status.connected
                    ? 'bg-[#EDEDED] animate-subtle-pulse'
                    : 'bg-[#43464F]'
                }`}
              />
              <span className="text-[10px] font-mono text-[#5F636E]">
                {status.connected ? 'LIVE' : 'IDLE'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span
              className="text-[#EDEDED] truncate mr-1 font-sans text-xs"
              title={status.activeNode || 'AMS-04'}
            >
              {displayNodeName}
            </span>
            <span className="text-[11px] text-[#5F636E] shrink-0 font-medium font-mono">
              {status.connected ? `${activePing} ms` : '—'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
