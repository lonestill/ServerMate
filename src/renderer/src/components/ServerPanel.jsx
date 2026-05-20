import React, { useState } from 'react'
import Console from './Console'
import PropertiesEditor from './PropertiesEditor'
import DownloadPanel from './DownloadPanel'
import JavaSettings from './JavaSettings'
import PlayersPanel from './PlayersPanel'
import ModsPanel from './ModsPanel'
import PluginBrowser from './PluginBrowser'
import BackupsPanel from './BackupsPanel'
import OverviewPanel from './OverviewPanel'
import WorldsPanel from './WorldsPanel'
import CrashReportsPanel from './CrashReportsPanel'
import { FolderOpen } from '../Icons'

const TABS = [
  { id: 'overview',  label: 'Обзор' },
  { id: 'console',   label: 'Консоль' },
  { id: 'settings',  label: 'Настройки' },
  { id: 'players',   label: 'Игроки' },
  { id: 'mods',      label: 'Плагины' },
  { id: 'market',    label: 'Маркет' },
  { id: 'worlds',    label: 'Миры' },
  { id: 'backups',   label: 'Бэкапы' },
  { id: 'crashes',   label: 'Краши' },
  { id: 'install',   label: 'Установка' },
  { id: 'java',      label: 'Java' },
]

export default function ServerPanel({ server, runningServer, onStarted, onStopped, onRefresh }) {
  const [tab, setTab] = useState('console')
  const [liveStats, setLiveStats] = useState({ players: [], ramMb: null, uptime: '', serverReady: false })
  const isRunning = runningServer === server.name

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="h-12 flex items-center px-4 gap-3 border-b border-[#2a2a35] bg-[#111116] shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <div className={`w-2 h-2 rounded-full shrink-0 transition-all ${isRunning ? 'bg-[#1bd96a] shadow-[0_0_6px_#1bd96a80]' : 'bg-[#2e2e3a]'}`} />
          <span className="text-[13px] font-semibold text-[#ecedee] truncate max-w-[140px]">{server.name}</span>
          <span className="text-[10px] text-[#33334a] shrink-0">{isRunning ? 'запущен' : 'остановлен'}</span>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0.5 mx-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'bg-[#1bd96a18] text-[#1bd96a]'
                  : 'text-[#55556a] hover:text-[#8b8b9e] hover:bg-[#1e1e26]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => window.api.openServerFolder(server.name)}
          title="Открыть папку сервера"
          className="ml-auto shrink-0 flex items-center gap-1 px-2 py-1.5 text-[11px] text-[#33334a] hover:text-[#55556a] hover:bg-[#1e1e26] rounded-lg transition-all"
        >
          <FolderOpen size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden bg-[#17171c] relative">
        {/* Overview always needs fresh data */}
        {tab === 'overview' && (
          <OverviewPanel
            server={server}
            isRunning={isRunning}
            liveStats={liveStats}
            onStarted={() => onStarted(server.name)}
            onSwitchTab={setTab}
          />
        )}

        {/* Console stays mounted to preserve logs */}
        <div className={tab === 'console' ? 'h-full' : 'hidden'}>
          <Console
            server={server}
            isRunning={isRunning}
            onStarted={() => onStarted(server.name)}
            onStopped={onStopped}
            onSwitchTab={setTab}
            onStats={setLiveStats}
          />
        </div>

        {tab === 'settings' && <PropertiesEditor server={server} isRunning={isRunning} />}
        {tab === 'players'  && <PlayersPanel server={server} isRunning={isRunning} onlinePlayers={liveStats.players} />}
        {tab === 'mods'     && <ModsPanel server={server} />}
        {tab === 'market'   && <PluginBrowser server={server} />}
        {tab === 'worlds'   && <WorldsPanel server={server} isRunning={isRunning} />}
        {tab === 'backups'  && <BackupsPanel server={server} isRunning={isRunning} />}
        {tab === 'crashes'  && <CrashReportsPanel server={server} />}
        {tab === 'install'  && <DownloadPanel server={server} onDone={onRefresh} />}
        {tab === 'java'     && <JavaSettings server={server} />}
      </div>
    </div>
  )
}
