import React, { useState, useEffect, useRef } from 'react'
import {
  Play, Square, Copy, Check, RotateCcw, Zap, Trash2, Users, Clock, Wifi,
  ChevronUp, AlertTriangle, Download, X, Archive, Search,
  Power, Timer, Star, Pencil
} from '../Icons'

function classVerToJava(v) {
  const map = { 45:1,46:2,47:3,48:4,49:5,50:6,51:7,52:8,53:9,54:10,55:11,56:12,57:13,58:14,59:15,60:16,61:17,62:18,63:19,64:20,65:21,66:22,67:23,68:24 }
  return map[v] ?? (v - 44)
}

export default function Console({ server, isRunning, onStarted, onStopped, onSwitchTab, onStats }) {
  const [logs, setLogs] = useState([])
  const [cmd, setCmd] = useState('')
  const [starting, setStarting] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [players, setPlayers] = useState([])
  const [serverReady, setServerReady] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [uptime, setUptime] = useState('')
  const [localIp, setLocalIp] = useState('')
  const [port, setPort] = useState('25565')
  const [cmdHistory, setCmdHistory] = useState([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [autoScroll, setAutoScroll] = useState(true)
  const [ipCopied, setIpCopied] = useState(false)
  const [filter, setFilter] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [backing, setBacking] = useState(false)
  const [backupDone, setBackupDone] = useState(null)
  const [autostart, setAutostart] = useState(server.autostart ?? false)
  const [crashCode, setCrashCode] = useState(null)
  const [ramMb, setRamMb] = useState(null)
  // Java mismatch
  const [javaAlert, setJavaAlert] = useState(null)
  const [javaFixing, setJavaFixing] = useState(false)
  const [javaFixPct, setJavaFixPct] = useState(0)
  const [javaFixDone, setJavaFixDone] = useState(false)

  // Scheduled restart
  const [schedEnabled, setSchedEnabled] = useState(false)
  const [schedHours, setSchedHours] = useState(6)
  const [schedCountdown, setSchedCountdown] = useState('')
  const [showSchedMenu, setShowSchedMenu] = useState(false)
  const schedTimerRef = useRef(null)
  const schedStartRef = useRef(null)

  // Quick commands
  const [quickCmds, setQuickCmds] = useState([])
  const [showQuickEdit, setShowQuickEdit] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const logRef = useRef(null)
  const restartingRef = useRef(false)
  const autoScrollRef = useRef(true)
  const logBufRef = useRef('') // rolling buffer for multi-line error detection

  useEffect(() => { autoScrollRef.current = autoScroll }, [autoScroll])

  useEffect(() => {
    window.api.getLocalIp().then(setLocalIp)
    window.api.readProps(server.name).then(p => {
      if (p?.['server-port']) setPort(p['server-port'])
    })
    setAutostart(server.autostart ?? false)
    // Load scheduled restart and quick commands from meta
    const meta = server
    setSchedEnabled(meta.scheduledRestart?.enabled ?? false)
    setSchedHours(meta.scheduledRestart?.intervalHours ?? 6)
    setQuickCmds(meta.quickCommands ?? ['say Привет!', 'weather clear', 'time set day'])
  }, [server.name])

  // RAM polling
  useEffect(() => {
    if (!isRunning) { setRamMb(null); return }
    const poll = async () => {
      const stats = await window.api.getServerStats()
      if (stats?.ramBytes) setRamMb(Math.round(stats.ramBytes / 1024 / 1024))
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [isRunning])

  // Tray sync
  useEffect(() => {
    window.api.setRunningServer(isRunning ? server.name : null)
  }, [isRunning])

  // Lift live stats to parent (for OverviewPanel)
  useEffect(() => {
    onStats?.({ players, ramMb, uptime, serverReady })
  }, [players, ramMb, uptime, serverReady])

  // Scheduled restart
  useEffect(() => {
    if (!isRunning || !schedEnabled) {
      clearInterval(schedTimerRef.current)
      schedStartRef.current = null
      setSchedCountdown('')
      return
    }
    schedStartRef.current = Date.now()
    const intervalMs = schedHours * 3600 * 1000
    schedTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - schedStartRef.current
      const remaining = intervalMs - elapsed
      if (remaining <= 0) {
        clearInterval(schedTimerRef.current)
        setSchedCountdown('')
        handleRestart()
        return
      }
      const h = Math.floor(remaining / 3600000)
      const m = Math.floor((remaining % 3600000) / 60000)
      const s = Math.floor((remaining % 60000) / 1000)
      setSchedCountdown(h > 0 ? `${h}ч ${m}м` : m > 0 ? `${m}м ${s}с` : `${s}с`)
    }, 1000)
    return () => clearInterval(schedTimerRef.current)
  }, [isRunning, schedEnabled, schedHours])

  async function saveSchedConfig(enabled, hours) {
    setSchedEnabled(enabled)
    setSchedHours(hours)
    await window.api.saveMeta(server.name, {
      scheduledRestart: { enabled, intervalHours: hours }
    })
  }

  async function saveQuickCmds(cmds) {
    setQuickCmds(cmds)
    await window.api.saveMeta(server.name, { quickCommands: cmds })
  }

  function parseLine(text) {
    // accumulate rolling buffer for multi-line detection
    logBufRef.current = (logBufRef.current + text).slice(-2000)
    const buf = logBufRef.current

    if (/Done \([\d.]+s\)!/.test(text)) {
      setServerReady(true)
      setStartedAt(new Date())
      window.api.notify('ServerMate', `Сервер ${server.name} готов к игре!`)
    }
    const joinMatch = text.match(/: (\w{2,16}) joined the game/)
    if (joinMatch) setPlayers(p => [...new Set([...p, joinMatch[1]])])
    const leaveMatch = text.match(/: (\w{2,16}) (?:left the game|lost connection)/)
    if (leaveMatch) setPlayers(p => p.filter(x => x !== leaveMatch[1]))

    // Detect Java version mismatch (may span multiple chunks — check buffer)
    const classVerMatch = buf.match(/class file version (\d+)\.0/)
    if (classVerMatch && /UnsupportedClassVersionError/.test(buf)) {
      const required = classVerToJava(parseInt(classVerMatch[1]))
      const currentMatch = buf.match(/versions up to (\d+)\.0/)
      const current = currentMatch ? classVerToJava(parseInt(currentMatch[1])) : null
      setJavaAlert(prev => prev ? prev : { required, current })
      logBufRef.current = '' // reset buffer after match
    }
  }

  useEffect(() => {
    const unsubLog = window.api.onLog((data) => {
      setLogs(prev => [...prev.slice(-4000), data])
      parseLine(data.text)
    })
    const unsubStop = window.api.onStopped((data) => {
      const code = data?.code
      setLogs(prev => [...prev, { type: 'sys', text: `\n[процесс завершён${code != null ? `, код ${code}` : ''}]\n` }])
      setPlayers([])
      setServerReady(false)
      setStartedAt(null)
      onStopped()
      // Crash detection: non-zero and non-null exit code, not a manual restart
      if (code !== 0 && code != null && !restartingRef.current) {
        setCrashCode(code)
        window.api.notify('ServerMate — Краш', `Сервер ${server.name} упал (код ${code})`)
      }
      if (restartingRef.current) {
        restartingRef.current = false
        setTimeout(() => handleStart(), 800)
      } else {
        setRestarting(false)
      }
    })
    return () => { unsubLog(); unsubStop() }
  }, [])

  useEffect(() => {
    if (autoScrollRef.current) bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [logs])

  useEffect(() => {
    if (!startedAt) { setUptime(''); return }
    const tick = () => {
      const s = Math.floor((Date.now() - startedAt.getTime()) / 1000)
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
      setUptime(h > 0 ? `${h}ч ${m}м` : m > 0 ? `${m}м ${sec}с` : `${sec}с`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  useEffect(() => {
    if (!javaFixing) return
    const unsub = window.api.onJavaInstallProgress((data) => {
      setJavaFixPct(data.pct ?? 0)
      if (data.phase === 'done') { setJavaFixing(false); setJavaFixDone(true) }
    })
    return unsub
  }, [javaFixing])

  function handleScroll() {
    const el = logRef.current
    if (!el) return
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40)
  }

  async function handleStart() {
    setStarting(true)
    setLogs([])
    setPlayers([])
    setServerReady(false)
    setStartedAt(null)
    setJavaAlert(null)
    setJavaFixDone(false)
    setCrashCode(null)
    logBufRef.current = ''
    const res = await window.api.startServer({ serverName: server.name })
    setStarting(false)
    if (res.ok) {
      onStarted()
    } else {
      setLogs([{ type: 'err', text: res.error + '\n' }])
      setRestarting(false)
      restartingRef.current = false
    }
  }

  async function handleStop() { await window.api.stopServer() }

  async function handleRestart() {
    setRestarting(true)
    restartingRef.current = true
    await window.api.stopServer()
  }

  async function handleKill() { await window.api.killServer() }

  async function handleCommand(e) {
    e.preventDefault()
    const c = cmd.trim()
    if (!c) return
    await window.api.sendCommand(c)
    setLogs(prev => [...prev, { type: 'cmd', text: '> ' + c + '\n' }])
    setCmdHistory(h => [c, ...h.filter(x => x !== c)].slice(0, 50))
    setCmd('')
    setHistoryIdx(-1)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(historyIdx + 1, cmdHistory.length - 1)
      setHistoryIdx(next); setCmd(cmdHistory[next] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = historyIdx - 1
      if (next < 0) { setHistoryIdx(-1); setCmd(''); return }
      setHistoryIdx(next); setCmd(cmdHistory[next] ?? '')
    }
  }

  async function handleFixJava() {
    if (!javaAlert) return
    setJavaFixing(true)
    setJavaFixPct(0)
    const versions = await window.api.getInstallableJavaVersions()
    const compatible = versions.filter(v => v.major >= javaAlert.required)
    if (!compatible.length) { setJavaFixing(false); onSwitchTab?.('java'); return }
    const ver = compatible.reduce((a, b) => a.major <= b.major ? a : b)
    const res = await window.api.installJava({ major: ver.major, downloadUrl: ver.downloadUrl, name: ver.name, installDir: ver.installDir })
    if (!res.ok) {
      setJavaFixing(false)
      setLogs(prev => [...prev, { type: 'err', text: `[ServerMate] Ошибка установки Java: ${res.error}\n` }])
    }
  }

  async function handleBackup() {
    setBacking(true)
    setBackupDone(null)
    const res = await window.api.backupWorld(server.name)
    setBacking(false)
    if (res.ok) {
      setBackupDone(res.filename)
      setTimeout(() => setBackupDone(null), 4000)
    } else {
      setLogs(prev => [...prev, { type: 'err', text: `[ServerMate] Бэкап не удался: ${res.error}\n` }])
    }
  }

  async function toggleAutostart() {
    const next = !autostart
    setAutostart(next)
    await window.api.saveMeta(server.name, { autostart: next })
  }

  function copyLogs() {
    navigator.clipboard.writeText(logs.map(l => l.text).join(''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyIp() {
    navigator.clipboard.writeText(`${localIp}:${port}`)
    setIpCopied(true)
    setTimeout(() => setIpCopied(false), 2000)
  }

  const filteredLogs = filter.trim()
    ? logs.filter(l => l.text.toLowerCase().includes(filter.toLowerCase()))
    : logs

  const statusColor = serverReady ? '#1bd96a' : isRunning ? '#f59e0b' : '#2e2e3a'
  const statusLabel = serverReady ? 'готов' : isRunning ? 'запуск…' : restarting ? 'перезапуск…' : ''

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a35] bg-[#111116] flex-wrap shrink-0 min-h-[44px]">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={starting || restarting || !server.hasJar}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-30 disabled:cursor-not-allowed text-black text-[12px] font-semibold rounded-lg transition-colors"
          >
            <Play size={11} strokeWidth={3} fill="currentColor" />
            {starting || restarting ? 'Запуск…' : 'Запустить'}
          </button>
        ) : (
          <>
            <button onClick={handleStop} disabled={restarting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] disabled:opacity-50 text-[#ecedee] text-[12px] font-medium rounded-lg transition-colors">
              <Square size={10} strokeWidth={2.5} /> Стоп
            </button>
            <button onClick={handleRestart} disabled={restarting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] disabled:opacity-50 text-[#8b8b9e] text-[12px] rounded-lg transition-colors">
              <RotateCcw size={12} className={restarting ? 'animate-spin' : ''} />
              {restarting ? 'Перезапуск…' : 'Рестарт'}
            </button>
            <button onClick={handleKill} title="Принудительно завершить"
              className="flex items-center gap-1 px-2 py-1.5 text-[#55556a] hover:text-red-400 hover:bg-red-500/10 text-[11px] rounded-lg transition-colors">
              <Zap size={11} /> Kill
            </button>
          </>
        )}

        {!server.hasJar && <span className="text-[11px] text-[#55556a]">Сначала установи сервер → «Установка»</span>}

        {isRunning && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
            <span className="text-[11px]" style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        )}
        {uptime && <div className="flex items-center gap-1 text-[11px] text-[#55556a]"><Clock size={11} />{uptime}</div>}
        {ramMb !== null && (
          <div className="flex items-center gap-1 text-[11px] text-[#55556a]" title="RAM процесса Java">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M7 7V5M12 7V5M17 7V5M7 17v2M12 17v2M17 17v2"/></svg>
            {ramMb >= 1024 ? (ramMb / 1024).toFixed(1) + 'G' : ramMb + 'M'}
          </div>
        )}
        {players.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-[#55556a]" title={players.join(', ')}>
            <Users size={11} />
            <span>{players.length}</span>
            <span className="text-[#33334a] max-w-[120px] truncate hidden sm:block">{players.join(', ')}</span>
          </div>
        )}
        {localIp && isRunning && serverReady && (
          <button onClick={copyIp} title="Скопировать адрес для друзей"
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-all ${ipCopied ? 'bg-[#1bd96a20] text-[#1bd96a]' : 'bg-[#1e1e26] text-[#55556a] hover:text-[#8b8b9e] hover:bg-[#26262f]'}`}>
            <Wifi size={11} />
            {ipCopied ? 'Скопировано!' : `${localIp}:${port}`}
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* Autostart toggle */}
          <button
            onClick={toggleAutostart}
            title={autostart ? 'Автозапуск включён' : 'Автозапуск выключен'}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] transition-all ${autostart ? 'text-[#1bd96a] bg-[#1bd96a15]' : 'text-[#33334a] hover:text-[#55556a] hover:bg-[#1e1e26]'}`}
          >
            <Power size={11} />
            <span className="hidden sm:block">Автозапуск</span>
          </button>

          {/* Backup */}
          <button
            onClick={handleBackup}
            disabled={backing || isRunning}
            title={isRunning ? 'Останови сервер перед бэкапом' : 'Создать бэкап мира'}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              backupDone ? 'text-[#1bd96a] bg-[#1bd96a15]' : 'text-[#55556a] hover:text-[#8b8b9e] hover:bg-[#1e1e26]'
            }`}
          >
            {backing ? <RotateCcw size={11} className="animate-spin" /> : backupDone ? <Check size={11} /> : <Archive size={11} />}
            <span className="hidden sm:block">{backing ? 'Бэкап…' : backupDone ? 'Готово' : 'Бэкап'}</span>
          </button>

          {/* Scheduled restart */}
          <div className="relative">
            <button
              onClick={() => setShowSchedMenu(v => !v)}
              title="Расписание перезапуска"
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] transition-all ${schedEnabled ? 'text-[#f59e0b] bg-[#f59e0b15]' : 'text-[#33334a] hover:text-[#55556a] hover:bg-[#1e1e26]'}`}
            >
              <Timer size={11} />
              {schedEnabled && schedCountdown && <span className="hidden sm:block">{schedCountdown}</span>}
            </button>
            {showSchedMenu && (
              <SchedMenu
                enabled={schedEnabled}
                hours={schedHours}
                onSave={saveSchedConfig}
                onClose={() => setShowSchedMenu(false)}
              />
            )}
          </div>

          {/* Quick commands edit */}
          <button
            onClick={() => setShowQuickEdit(v => !v)}
            title="Быстрые команды"
            className={`p-1.5 rounded-lg transition-colors ${showQuickEdit ? 'text-[#1bd96a] bg-[#1bd96a15]' : 'text-[#33334a] hover:text-[#55556a] hover:bg-[#1e1e26]'}`}
          >
            <Star size={11} />
          </button>

          {/* Filter toggle */}
          <button
            onClick={() => { setShowFilter(v => !v); if (showFilter) setFilter('') }}
            className={`p-1.5 rounded-lg transition-colors ${showFilter ? 'text-[#1bd96a] bg-[#1bd96a15]' : 'text-[#55556a] hover:text-[#8b8b9e] hover:bg-[#1e1e26]'}`}
            title="Фильтр логов"
          >
            <Search size={11} />
          </button>

          {!autoScroll && (
            <button onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#f59e0b] bg-[#f59e0b15] rounded-lg hover:bg-[#f59e0b25] transition-colors">
              <ChevronUp size={11} className="rotate-180" /> Вниз
            </button>
          )}
          <button onClick={() => setLogs([])} disabled={logs.length === 0}
            className="p-1.5 text-[#55556a] hover:text-[#8b8b9e] disabled:opacity-30 rounded-lg hover:bg-[#1e1e26] transition-colors">
            <Trash2 size={11} />
          </button>
          <button onClick={copyLogs} disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-[#55556a] hover:text-[#8b8b9e] disabled:opacity-30 rounded-lg hover:bg-[#1e1e26] transition-colors">
            {copied ? <Check size={11} /> : <Copy size={11} />}
            <span className="hidden sm:block">{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>
        </div>
      </div>

      {/* Quick commands bar */}
      {showQuickEdit && (
        <QuickCommandsBar
          cmds={quickCmds}
          isRunning={isRunning}
          onSend={c => window.api.sendCommand(c)}
          onSave={saveQuickCmds}
          onClose={() => setShowQuickEdit(false)}
        />
      )}

      {/* Filter bar */}
      {showFilter && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111116] border-b border-[#2a2a35] shrink-0">
          <Search size={11} className="text-[#55556a] shrink-0" />
          <input
            autoFocus
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Фильтр логов…"
            className="flex-1 bg-transparent text-[12px] text-[#ecedee] placeholder-[#33334a] outline-none console-text"
            style={{ userSelect: 'text' }}
          />
          {filter && (
            <span className="text-[10px] text-[#55556a]">{filteredLogs.length} / {logs.length}</span>
          )}
          {filter && (
            <button onClick={() => setFilter('')} className="text-[#33334a] hover:text-[#55556a]"><X size={11} /></button>
          )}
        </div>
      )}

      {/* Java mismatch banner */}
      {javaAlert && (
        <JavaFixBanner
          alert={javaAlert}
          fixing={javaFixing}
          fixPct={javaFixPct}
          done={javaFixDone}
          onFix={handleFixJava}
          onOpenJavaTab={() => onSwitchTab?.('java')}
          onDismiss={() => setJavaAlert(null)}
          onRestartAfterFix={() => { setJavaAlert(null); setJavaFixDone(false); handleStart() }}
        />
      )}

      {/* Crash banner */}
      {crashCode !== null && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-red-500/5 border-b border-red-500/20">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <p className="flex-1 text-[12px] text-red-300">Сервер упал с кодом {crashCode} — проверь логи выше</p>
          <button
            onClick={() => { setCrashCode(null); handleStart() }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#26262f] hover:bg-[#2e2e3a] text-[11px] text-[#ecedee] rounded-lg transition-colors"
          >
            <RotateCcw size={11} /> Перезапустить
          </button>
          <button onClick={() => setCrashCode(null)} className="text-[#33334a] hover:text-[#55556a]"><X size={13} /></button>
        </div>
      )}

      {/* Log area */}
      <div
        ref={logRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 console-text bg-[#0d0d11]"
        onClick={() => isRunning && inputRef.current?.focus()}
      >
        {logs.length === 0
          ? <span className="text-[#2a2a35]">Логи появятся после запуска…</span>
          : filteredLogs.map((l, i) => <LogLine key={i} log={l} filter={filter} />)
        }
        {filter && filteredLogs.length === 0 && (
          <span className="text-[#33334a]">Ничего не найдено по «{filter}»</span>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command input */}
      <form onSubmit={handleCommand} className="flex items-center border-t border-[#2a2a35] bg-[#111116]">
        <span className="pl-4 pr-2 text-[#33334a] select-none text-[16px] console-text">›</span>
        <input
          ref={inputRef}
          type="text"
          value={cmd}
          onChange={(e) => { setCmd(e.target.value); setHistoryIdx(-1) }}
          onKeyDown={handleKeyDown}
          disabled={!isRunning}
          placeholder={isRunning ? 'Команда… (↑↓ история)' : 'Сервер не запущен'}
          className="flex-1 bg-transparent py-2.5 text-[12px] text-[#ecedee] placeholder-[#2a2a35] outline-none disabled:opacity-40 console-text"
          style={{ userSelect: 'text' }}
        />
        {cmd && <button type="submit" className="px-3 py-2 text-[11px] text-[#1bd96a] hover:text-[#17c05d] transition-colors">↵</button>}
      </form>
    </div>
  )
}

function JavaFixBanner({ alert, fixing, fixPct, done, onFix, onOpenJavaTab, onDismiss, onRestartAfterFix }) {
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-[#f59e0b0d] border-b border-[#f59e0b25]">
      <AlertTriangle size={14} className="text-[#f59e0b] shrink-0" />
      <div className="flex-1 min-w-0">
        {done ? (
          <p className="text-[12px] text-[#1bd96a]">Java {alert.required} установлена — можно запустить сервер</p>
        ) : (
          <p className="text-[12px] text-[#f59e0b]">
            Требуется Java {alert.required}+{alert.current ? `, установлена Java ${alert.current}` : ''}
          </p>
        )}
        {fixing && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 max-w-[200px] h-1 bg-[#26262f] rounded-full overflow-hidden">
              <div className="h-full bg-[#f59e0b] rounded-full transition-all duration-300" style={{ width: `${fixPct}%` }} />
            </div>
            <span className="text-[10px] text-[#55556a]">{fixPct < 100 ? `Скачивание Java ${alert.required}… ${fixPct}%` : 'Распаковка…'}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {done ? (
          <button onClick={onRestartAfterFix}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[11px] font-semibold rounded-lg transition-colors">
            <Play size={10} strokeWidth={3} fill="currentColor" /> Запустить снова
          </button>
        ) : !fixing ? (
          <>
            <button onClick={onFix}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-black text-[11px] font-semibold rounded-lg transition-colors">
              <Download size={11} /> Установить Java {alert.required}
            </button>
            <button onClick={onOpenJavaTab} className="px-2.5 py-1.5 text-[11px] text-[#55556a] hover:text-[#8b8b9e] transition-colors">
              Настройки Java
            </button>
          </>
        ) : null}
        {!done && <button onClick={onDismiss} className="text-[#33334a] hover:text-[#55556a] ml-1"><X size={13} /></button>}
      </div>
    </div>
  )
}

function SchedMenu({ enabled, hours, onSave, onClose }) {
  const [en, setEn] = useState(enabled)
  const [h, setH] = useState(hours)
  const OPTIONS = [1, 2, 3, 4, 6, 8, 12, 24]

  useEffect(() => {
    const handle = (e) => {
      if (!e.target.closest('[data-sched-menu]')) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div data-sched-menu className="absolute right-0 top-8 z-50 w-52 bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl p-3">
      <p className="text-[11px] font-semibold text-[#ecedee] mb-2">Автоперезапуск</p>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setEn(v => !v)}
          className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${en ? 'bg-[#1bd96a]' : 'bg-[#2a2a35]'}`}
        >
          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${en ? 'left-4' : 'left-0.5'}`} />
        </button>
        <span className="text-[11px] text-[#8b8b9e]">{en ? 'Включён' : 'Выключен'}</span>
      </div>
      <p className="text-[10px] text-[#33334a] mb-1.5">Интервал (часов)</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {OPTIONS.map(o => (
          <button key={o} onClick={() => setH(o)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${h === o ? 'bg-[#1bd96a20] text-[#1bd96a] border border-[#1bd96a40]' : 'bg-[#26262f] text-[#55556a] hover:text-[#8b8b9e]'}`}
          >{o}ч</button>
        ))}
      </div>
      <button
        onClick={() => { onSave(en, h); onClose() }}
        className="w-full py-1.5 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[11px] font-semibold rounded-lg transition-colors"
      >
        Сохранить
      </button>
    </div>
  )
}

function QuickCommandsBar({ cmds, isRunning, onSend, onSave, onClose }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cmds.join('\n'))
  const [newCmd, setNewCmd] = useState('')

  function sendAndClose(c) {
    if (isRunning) onSend(c)
  }

  function saveDraft() {
    const next = draft.split('\n').map(s => s.trim()).filter(Boolean)
    onSave(next)
    setEditing(false)
  }

  return (
    <div className="shrink-0 border-b border-[#2a2a35] bg-[#111116] px-3 py-2">
      {!editing ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-[#33334a] mr-1">Быстрые:</span>
          {cmds.map((c, i) => (
            <button
              key={i}
              onClick={() => sendAndClose(c)}
              disabled={!isRunning}
              className="px-2 py-0.5 bg-[#1e1e26] hover:bg-[#26262f] border border-[#2a2a35] text-[10px] text-[#8b8b9e] hover:text-[#ecedee] rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed font-mono"
            >
              {c}
            </button>
          ))}
          <button onClick={() => setEditing(true)} className="p-1 text-[#33334a] hover:text-[#55556a] transition-colors">
            <Pencil size={10} />
          </button>
          <button onClick={onClose} className="p-1 text-[#33334a] hover:text-[#55556a] transition-colors ml-auto">
            <X size={10} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] text-[#55556a]">По одной команде на строку</p>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full bg-[#1e1e26] border border-[#2a2a35] focus:border-[#1bd96a] rounded-lg px-2 py-1.5 text-[11px] text-[#ecedee] font-mono outline-none resize-none leading-relaxed"
            style={{ userSelect: 'text', minHeight: 64 }}
            rows={3}
          />
          <div className="flex gap-2">
            <button onClick={saveDraft} className="px-3 py-1 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[11px] font-semibold rounded-lg transition-colors">Сохранить</button>
            <button onClick={() => setEditing(false)} className="px-3 py-1 text-[11px] text-[#55556a] hover:text-[#8b8b9e] transition-colors">Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}

function highlight(text, filter) {
  if (!filter) return text
  const idx = text.toLowerCase().indexOf(filter.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#f59e0b40] text-[#f59e0b] rounded-sm">{text.slice(idx, idx + filter.length)}</mark>
      {text.slice(idx + filter.length)}
    </>
  )
}

function LogLine({ log, filter }) {
  const text = log.text
  if (log.type === 'sys') return <span className="block text-[#55556a] whitespace-pre-wrap">{text}</span>
  if (log.type === 'cmd') return <span className="block text-[#1bd96a80] whitespace-pre-wrap">{text}</span>
  let cls = 'log-out'
  if (log.type === 'err' || /\[ERROR\]|\[FATAL\]|Exception|Error:/i.test(text)) cls = 'log-err'
  else if (/\[WARN\]/i.test(text)) cls = 'log-warn'
  else if (/Done \([\d.]+s\)!/.test(text)) cls = 'log-done'
  return (
    <span className={`block whitespace-pre-wrap break-all ${cls}`}>
      {filter ? highlight(text, filter) : text}
    </span>
  )
}
