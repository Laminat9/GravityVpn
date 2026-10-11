import React, { useState, useEffect } from 'react';
import { Search, Activity, RefreshCw } from 'lucide-react';
import { ProxyNodeItem } from '../types';
import { vpnEngine } from '../services/vpnEngine';

interface ProxiesProps {
  activeNode: string | null;
  onSelectNode: (nodeName: string) => Promise<void>;
}

// Banned dummy keywords and patterns (from Mikan / Clash routing rules)
const BANNED_KEYWORDS = new Set([
  'pass',
  'passrule',
  'reject',
  'rejectdrop',
  'direct',
  'compatible',
  'global',
  'dns',
  'fault',
  'default',
  'none',
  'drop',
  'proxy',
  'final',
]);

function isInternalRoutingNode(name: string, val?: any): boolean {
  const normName = (name || '').trim().toLowerCase();
  const cleanName = normName.replace(/[\s\-_]/g, '');
  const normType = (val?.type || '').trim().toLowerCase();
  const cleanType = normType.replace(/[\s\-_]/g, '');

  if (BANNED_KEYWORDS.has(cleanName) || BANNED_KEYWORDS.has(cleanType)) {
    return true;
  }

  // Matches pass-rule, reject-drop, pass_rule, rejectdrop etc.
  if (/^(pass|reject)/i.test(cleanName) || /^(pass|reject)/i.test(cleanType)) {
    return true;
  }

  // Matches Mikan error or pause indicators
  if (
    normName.startsWith('⛔') ||
    normName.startsWith('⏸') ||
    normName.includes('ошибка') ||
    normName.includes('заблокирован')
  ) {
    return true;
  }

  // Filter dummy loopback stubs (Mikan fallback socket)
  if (
    (val?.server === '127.0.0.1' || val?.server === '0.0.0.0' || val?.server === 'localhost') &&
    (val?.port === 1 || !val?.port)
  ) {
    return true;
  }

  return false;
}

export const Proxies: React.FC<ProxiesProps> = ({ activeNode, onSelectNode }) => {
  const [allNodes, setAllNodes] = useState<ProxyNodeItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('Gravity');
  const [groups, setGroups] = useState<string[]>([]);
  const [groupNodesMap, setGroupNodesMap] = useState<Record<string, string[]>>({});
  const [delays, setDelays] = useState<Record<string, number>>({});
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [testingNode, setTestingNode] = useState<string | null>(null);

  const loadProxies = async () => {
    try {
      const data = await vpnEngine.getProxies();
      if (data?.proxies) {
        const foundGroups: string[] = [];
        const groupMap: Record<string, string[]> = {};
        const nodeDict: Record<string, ProxyNodeItem> = {};

        // 1. Separate groups and leaf proxy nodes
        for (const [name, val] of Object.entries<any>(data.proxies)) {
          if (val.type === 'Selector' || val.type === 'URLTest' || val.type === 'Fallback') {
            if (!isInternalRoutingNode(name, val)) {
              foundGroups.push(name);
              // Filter internal nodes from the group's 'all' list
              const validChildren = (val.all || []).filter(
                (childName: string) => !isInternalRoutingNode(childName, data.proxies[childName])
              );
              groupMap[name] = validChildren;
            }
          } else {
            // Actual proxy node
            if (!isInternalRoutingNode(name, val)) {
              nodeDict[name] = {
                name: val.name || name,
                type: val.type || 'Proxy',
                server: val.server,
                port: val.port,
                delay:
                  val.history && val.history.length > 0
                    ? val.history[val.history.length - 1].delay
                    : undefined,
              };
            }
          }
        }

        const rawList = Object.values(nodeDict);

        if (foundGroups.length > 0) {
          setGroups(foundGroups);
          setGroupNodesMap(groupMap);
          if (!foundGroups.includes(activeGroup)) {
            setActiveGroup(foundGroups[0]);
          }
        }

        if (rawList.length > 0) {
          setAllNodes(rawList);
          const delayMap: Record<string, number> = {};
          rawList.forEach((n) => {
            if (n.delay !== undefined) delayMap[n.name] = n.delay;
          });
          setDelays((prev) => ({ ...prev, ...delayMap }));
        } else {
          // Fallback clean list with zero emojis
          setAllNodes([
            { name: 'DE · Frankfurt 01', type: 'Shadowsocks', delay: 18 },
            { name: 'NL · Amsterdam 04', type: 'VMess', delay: 24 },
            { name: 'FI · Helsinki 02', type: 'VLESS', delay: 32 },
            { name: 'GB · London 03', type: 'Trojan', delay: 45 },
            { name: 'SE · Stockholm 01', type: 'Shadowsocks', delay: 38 },
            { name: 'US · New York 02', type: 'VMess', delay: 110 },
            { name: 'SG · Singapore 01', type: 'VLESS', delay: 180 },
          ]);
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadProxies();
  }, []);

  const handleTestDelay = async (nodeName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTestingNode(nodeName);
    try {
      const delay = await vpnEngine.testDelay(nodeName);
      setDelays((prev) => ({ ...prev, [nodeName]: delay }));
    } catch {}
    setTestingNode(null);
  };

  const handleTestAll = async () => {
    if (isTestingAll || allNodes.length === 0) return;
    setIsTestingAll(true);

    for (const node of visibleNodes) {
      try {
        const delay = await vpnEngine.testDelay(node.name);
        setDelays((prev) => ({ ...prev, [node.name]: delay }));
      } catch {}
    }

    setIsTestingAll(false);
  };

  // Filter nodes according to active group (if defined) and search
  const visibleNodes = allNodes
    .filter((n) => {
      // If group has a specific list of child nodes
      if (groups.length > 0 && groupNodesMap[activeGroup]?.length > 0) {
        return groupNodesMap[activeGroup].includes(n.name);
      }
      return true;
    })
    .filter((n) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return n.name.toLowerCase().includes(q) || n.type.toLowerCase().includes(q);
    });

  const renderDelay = (delay?: number) => {
    if (delay === undefined) {
      return <span className="text-[11px] font-mono text-[#5F636E]">— ms</span>;
    }
    if (delay <= 0 || delay > 4000) {
      return (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-[7px] bg-[#1F2026] text-[#8E929C] border border-white/5">
          таймаут
        </span>
      );
    }
    return (
      <span className="text-[11px] font-mono px-2 py-0.5 rounded-[7px] bg-[#1F2026] text-[#EDEDED] border border-white/5">
        {delay} ms
      </span>
    );
  };

  return (
    <div className="h-full w-full flex flex-col p-6 select-none overflow-hidden bg-[#0C0D0E]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-[#EDEDED] tracking-tight">
            Серверы
          </h1>
          <p className="text-xs text-[#5F636E] mt-0.5">
            Список активных узлов туннеля и замер задержки
          </p>
        </div>

        {/* Test all button */}
        <button
          onClick={handleTestAll}
          disabled={isTestingAll || visibleNodes.length === 0}
          className="h-9 px-3.5 rounded-[10px] bg-[#18191D] hover:bg-[#1F2026] active:bg-[#272930] border border-white/10 text-xs font-medium text-[#EDEDED] flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Activity size={13} className={`text-[#9DA1AA] ${isTestingAll ? 'animate-spin' : ''}`} />
          <span>{isTestingAll ? 'Проверка...' : 'Проверить пинг'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F636E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или протоколу..."
            className="w-full h-9 pl-9 pr-3.5 rounded-[10px] bg-[#131417] border border-white/10 text-xs text-[#EDEDED] placeholder-[#5F636E] focus:outline-none focus:border-white/20 transition-colors font-sans"
          />
        </div>

        {/* Group Selector */}
        {groups.length > 1 && (
          <div className="flex items-center gap-1 bg-[#131417] p-1 rounded-[10px] border border-white/5">
            {groups.map((grp) => (
              <button
                key={grp}
                onClick={() => setActiveGroup(grp)}
                className={`px-3 py-1.5 rounded-[7px] text-xs font-medium transition-colors cursor-pointer ${
                  activeGroup === grp
                    ? 'bg-[#1F2026] text-[#EDEDED] border border-white/10'
                    : 'text-[#5F636E] hover:text-[#9DA1AA]'
                }`}
              >
                {grp}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nodes List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {visibleNodes.length === 0 ? (
          <div className="p-8 rounded-[14px] bg-[#131417] border border-white/5 text-center text-xs text-[#5F636E]">
            Активные узлы не найдены. Добавьте подписку в разделе «Профили».
          </div>
        ) : (
          visibleNodes.map((node) => {
            const isSelected = activeNode === node.name;
            const delay = delays[node.name] !== undefined ? delays[node.name] : node.delay;
            const isTesting = testingNode === node.name;

            return (
              <div
                key={node.name}
                onClick={() => onSelectNode(node.name)}
                className={`p-3 rounded-[10px] border flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#1C1E23] border-white/20'
                    : 'bg-[#131417] border-white/5 hover:border-white/10 hover:bg-[#18191D]'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  {/* Radio indicator */}
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'border-white/60 bg-[#272930]'
                        : 'border-white/15 bg-transparent'
                    }`}
                  >
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#EDEDED]" />}
                  </div>

                  {/* Node label and protocol tag */}
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-xs font-medium text-[#EDEDED] truncate font-sans">
                      {node.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[7px] bg-[#0C0D0E] text-[#5F636E] border border-white/5 uppercase shrink-0">
                      {node.type}
                    </span>
                  </div>
                </div>

                {/* Delay & Refresh action */}
                <div className="flex items-center gap-2 shrink-0">
                  {renderDelay(delay)}

                  <button
                    onClick={(e) => handleTestDelay(node.name, e)}
                    disabled={isTesting}
                    className="p-1.5 rounded-[7px] bg-[#18191D] hover:bg-[#1F2026] border border-white/5 text-[#5F636E] hover:text-[#9DA1AA] transition-colors cursor-pointer"
                    title="Замерить задержку"
                  >
                    <RefreshCw size={11} className={isTesting ? 'animate-spin text-[#EDEDED]' : ''} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
