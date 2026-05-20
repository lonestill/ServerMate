import React, { useState, useEffect, useRef } from 'react'
import {
  Play, Square, RotateCcw, Zap, Copy, Check, Users, Clock,
  Globe, AlertTriangle, RefreshCw, PackageOpen
} from '../Icons'

function fmt(bytes) {
  if (bytes > 1e9) return (bytes / 1e9).toFixed(1) + ' ГБ'
  if (bytes > 1e6) return (bytes / 1e6).toFixed(1) + ' МБ'
  return (bytes / 1e3).toFixed(0) + ' КБ'
}

export default function OverviewPanel({ server, isRunning, liveStats, onStarted, onSwitchTab }) {
  const { players = [], ramMb = null, uptime = '', serverReady = false } = liveStats ?? {}
  const [localIp, setLocalIp] = useState('')
  const [port, setPort] = useState('25565')
  const [copied, setCopied] = useState(false)
  const [ipCopied, setIpCopied] = useState(false)
  const [worlds, setWorlds] = useState([])
  const [lastBackup, setLastBackup] = useState(null)
  const [starting, setStarting] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [updateInfo, setUpdateInfo] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const restartingRef = useRef(false)

  useEffect(() => {
    window.api.getLocalIp().then(setLocalIp)
    window.api.readProps(server.name).then(p => {
      if (p?.['server-port']) setPort(p['server-port'])
    })
    window.api.listWorlds(server.name).then(setWorlds)
    window.api.listBackups(server.name).then(bs => setLastBackup(bs?.[0] ?? null))
    if (server.core === 'paper') {
      window.api.checkServerUpdate(server.name).then(info => {
        if (info.available) setUpdateInfo(info)
      })
    }
  }, [server.name])

  // Reset local start/restart state when isRunning changes
  useEffect(() => {
    if (!isRunning) {
      setStarting(false)
      if (restartingRef.current) {
        restartingRef.current = false
        setTimeout(() => handleStart(), 800)
      } else {
        setRestarting(false)
      }
    }
  }, [isRunning])

  async function handleStart() {
    setStarting(true)
    const res = await window.api.startServer({ serverName: server.name })
    setStarting(false)
    if (res.ok) onStarted()
  }

  async function handleStop() { await window.api.stopServer() }

  async function handleRestart() {
    setRestarting(true)
    restartingRef.current = true
    await window.api.stopServer()
  }

  async function handleKill() { await window.api.killServer() }

  async function handleExport() {
    setExporting(true)
    setExportDone(false)
    const res = await window.api.exportServer(server.name)
    setExporting(false)
    if (res.ok) { setExportDone(true); setTimeout(() => setExportDone(false), 3000) }
  }

  function copyIp() {
    navigator.clipboard.writeText(`${localIp}:${port}`)
    setIpCopied(true)
    setTimeout(() => setIpCopied(false), 2000)
  }

  const totalWorldSize = worlds.reduce((s, w) => s + w.size, 0)
  const statusColor = serverReady ? '#1bd96a' : isRunning ? '#f59e0b' : '#2e2e3a'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 max-w-2xl flex flex-col gap-4">

        {/* Status + Controls */}
        <div className="flex items-center gap-4 p-4 bg-[#1e1e26] border border-[#2a2a35] rounded-xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusColor, boxShadow: isRunning ? `0 0 8px ${statusColor}80` : 'none' }} />
              <span className="text-[14px] font-semibold text-[#ecedee] truncate">{server.name}</span>
              <span className="text-[11px]" style={{ color: statusColor }}>
                {serverReady ? 'готов' : isRunning ? 'запуск…' : 'остановлен'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#55556a] flex-wrap">
              {server.core && <span className="capitalize">{server.core}</span>}
              {server.mcVersion && <span>{server.mcVersion}</span>}
              {uptime && <span className="flex items-center gap-1"><Clock size={10} />{uptime}</span>}
              {ramMb !== null && (
                <span className="flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M7 7V5M12 7V5M17 7V5M7 17v2M12 17v2M17 17v2"/></svg>
                  {ramMb >= 1024 ? (ramMb/1024).toFixed(1)+'G' : ramMb+'M'}
                </span>
              )}
              {players.length > 0 && <span className="flex items-center gap-1"><Users size={10} />{players.length} онлайн</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={starting || !server.hasJar}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[12px] font-semibold rounded-lg transition-colors"
              >
                <Play size={12} strokeWidth={3} fill="currentColor" />
                {starting ? 'Запуск…' : 'Запустить'}
              </button>
            ) : (
              <>
                <button onClick={handleStop} disabled={restarting} className="flex items-center gap-1.5 px-3 py-2 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] disabled:opacity-50 text-[#ecedee] text-[12px] rounded-lg transition-colors">
                  <Square size={10} /> Стоп
                </button>
                <button onClick={handleRestart} disabled={restarting} className="flex items-center gap-1.5 px-3 py-2 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] disabled:opacity-50 text-[#8b8b9e] text-[12px] rounded-lg transition-colors">
                  <RotateCcw size={11} className={restarting ? 'animate-spin' : ''} />
                  {restarting ? '…' : 'Рестарт'}
                </button>
                <button onClick={handleKill} title="Kill" className="p-2 text-[#55556a] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Zap size={12} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Update banner */}
        {updateInfo && (
          <div className="flex items-center gap-3 p-3 bg-[#f59e0b0d] border border-[#f59e0b25] rounded-xl">
            <RefreshCw size={13} className="text-[#f59e0b] shrink-0" />
            <div className="flex-1">
              <p className="text-[12px] font-medium text-[#f59e0b]">Доступно обновление Paper</p>
              <p className="text-[11px] text-[#55556a]">Билд #{updateInfo.latest} для MC {updateInfo.mcVersion} (у вас #{updateInfo.current})</p>
            </div>
            <button
              onClick={() => onSwitchTab?.('install')}
              className="shrink-0 px-3 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-black text-[11px] font-semibold rounded-lg transition-colors"
            >
              Обновить
            </button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Address */}
          <div className="p-3 bg-[#1e1e26] border border-[#2a2a35] rounded-xl">
            <p className="text-[10px] font-semibold text-[#33334a] uppercase tracking-wider mb-2">Адрес</p>
            {localIp ? (
              <button
                onClick={copyIp}
                className={`flex items-center gap-1.5 text-[12px] font-mono transition-colors ${ipCopied ? 'text-[#1bd96a]' : 'text-[#ecedee] hover:text-[#1bd96a]'}`}
              >
                {ipCopied ? <Check size={11} strokeWidth={3} /> : <Copy size={11} />}
                {ipCopied ? 'Скопировано' : `${localIp}:${port}`}
              </button>
            ) : (
              <span className="text-[12px] text-[#33334a]">—</span>
            )}
            <p className="text-[10px] text-[#33334a] mt-1">для подключения в локальной сети</p>
          </div>

          {/* Players */}
          <div className="p-3 bg-[#1e1e26] border border-[#2a2a35] rounded-xl">
            <p className="text-[10px] font-semibold text-[#33334a] uppercase tracking-wider mb-2">Игроки онлайн</p>
            <p className="text-[22px] font-bold text-[#ecedee] leading-none">{players.length}</p>
            {players.length > 0 && (
              <p className="text-[10px] text-[#55556a] mt-1 truncate">{players.slice(0, 3).join(', ')}{players.length > 3 ? ` +${players.length-3}` : ''}</p>
            )}
            {players.length === 0 && <p className="text-[10px] text-[#33334a] mt-1">{isRunning ? 'нет игроков' : 'сервер не запущен'}</p>}
          </div>

          {/* RAM */}
          <div className="p-3 bg-[#1e1e26] border border-[#2a2a35] rounded-xl">
            <p className="text-[10px] font-semibold text-[#33334a] uppercase tracking-wider mb-2">RAM</p>
            {ramMb !== null ? (
              <p className="text-[22px] font-bold text-[#ecedee] leading-none">
                {ramMb >= 1024 ? (ramMb/1024).toFixed(1) : ramMb}
                <span className="text-[13px] font-normal text-[#55556a] ml-1">{ramMb >= 1024 ? 'ГБ' : 'МБ'}</span>
              </p>
            ) : (
              <p className="text-[22px] font-bold text-[#33334a] leading-none">—</p>
            )}
            <p className="text-[10px] text-[#33334a] mt-1">использует Java процесс</p>
          </div>
        </div>

        {/* Worlds */}
        <div className="p-4 bg-[#1e1e26] border border-[#2a2a35] rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-[#55556a] uppercase tracking-wider">Миры</p>
            <button onClick={() => onSwitchTab?.('worlds')} className="text-[10px] text-[#33334a] hover:text-[#55556a] transition-colors">Управление →</button>
          </div>
          {worlds.length === 0 ? (
            <p className="text-[12px] text-[#33334a]">Миры не найдены — запусти сервер</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {worlds.map(w => (
                <div key={w.name} className="flex items-center justify-between">
                  <span className="text-[12px] text-[#ecedee]">{w.name}</span>
                  <span className="text-[11px] text-[#33334a]">{fmt(w.size)}</span>
                </div>
              ))}
              {worlds.length > 0 && (
                <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-[#2a2a35]">
                  <span className="text-[11px] text-[#33334a]">Итого</span>
                  <span className="text-[11px] text-[#55556a]">{fmt(totalWorldSize)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Backups + Export */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-[#1e1e26] border border-[#2a2a35] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-[#55556a] uppercase tracking-wider">Последний бэкап</p>
              <button onClick={() => onSwitchTab?.('backups')} className="text-[10px] text-[#33334a] hover:text-[#55556a] transition-colors">Все →</button>
            </div>
            {lastBackup ? (
              <>
                <p className="text-[12px] text-[#ecedee] truncate">{lastBackup.filename}</p>
                <p className="text-[10px] text-[#33334a] mt-0.5">
                  {new Date(lastBackup.createdAt).toLocaleString('ru', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                  {' · '}{fmt(lastBackup.size)}
                </p>
              </>
            ) : (
              <p className="text-[12px] text-[#33334a]">Нет бэкапов</p>
            )}
          </div>

          <div className="p-4 bg-[#1e1e26] border border-[#2a2a35] rounded-xl flex flex-col">
            <p className="text-[11px] font-semibold text-[#55556a] uppercase tracking-wider mb-2">Экспорт</p>
            <p className="text-[11px] text-[#33334a] mb-3 flex-1">Сохранить всю папку сервера как .zip</p>
            <button
              onClick={handleExport}
              disabled={exporting || isRunning}
              title={isRunning ? 'Останови сервер перед экспортом' : ''}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-fit ${
                exportDone ? 'bg-[#1bd96a20] text-[#1bd96a]' : 'bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] text-[#8b8b9e]'
              }`}
            >
              {exportDone ? <><Check size={11} strokeWidth={3} /> Готово</> : exporting ? <><RotateCcw size={11} className="animate-spin" /> Архивирую…</> : <><PackageOpen size={11} /> Экспортировать</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
