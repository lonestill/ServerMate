import React, { useState, useEffect, useRef } from 'react'
import { RefreshCw, Check, AlertTriangle, Download, ChevronDown, ChevronUp } from '../Icons'

export default function JavaSettings({ server }) {
  const [javas, setJavas] = useState([])
  const [scanning, setScanning] = useState(false)
  const [args, setArgs] = useState('-Xmx2G -Xms512M')
  const [savedArgs, setSavedArgs] = useState(false)
  const [requiredJava, setRequiredJava] = useState(null)
  const [showInstaller, setShowInstaller] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => { loadAll() }, [server.name])

  async function loadAll() {
    const [list, currentArgs] = await Promise.all([
      window.api.getJavaInstallations(),
      window.api.getJavaArgs(server.name),
    ])
    setJavas(list)
    setArgs(currentArgs)

    if (server.hasJar && server.jarName) {
      const dir = await window.api.getServerDir(server.name)
      const req = await window.api.detectRequiredJava(dir + '\\' + server.jarName)
      setRequiredJava(req)
      if (req && !list.some(j => j.major >= req)) setShowInstaller(true)
    }
  }

  async function scan() {
    setScanning(true)
    const list = await window.api.getJavaInstallations()
    setJavas(list)
    setScanning(false)
  }

  function handleArgsChange(value) {
    setArgs(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      await window.api.setJavaArgs(server.name, value)
      setSavedArgs(true)
      setTimeout(() => setSavedArgs(false), 1500)
    }, 700)
  }

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const bestJava = requiredJava
    ? javas.find(j => j.major >= requiredJava) ?? javas[0]
    : javas[0]
  const hasCompatible = requiredJava ? javas.some(j => j.major >= requiredJava) : javas.length > 0

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 max-w-lg flex flex-col gap-5">

        {/* Java status */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-[#ecedee]">Java</h2>
            <button
              onClick={scan}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] text-[11px] text-[#8b8b9e] rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} />
              {scanning ? 'Сканирую…' : 'Найти Java'}
            </button>
          </div>

          {javas.length === 0 ? (
            /* No Java at all */
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 mb-3">
              <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[12px] font-medium text-red-300">Java не найдена — сервер не запустится</p>
                <p className="text-[11px] text-[#55556a] mt-0.5">Установи Java чтобы продолжить</p>
              </div>
              <button
                onClick={() => setShowInstaller(v => !v)}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[11px] font-semibold rounded-lg transition-colors"
              >
                <Download size={12} strokeWidth={2.5} />
                Установить
              </button>
            </div>
          ) : !hasCompatible && requiredJava ? (
            /* Java exists but wrong version */
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 mb-3">
              <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[12px] font-medium text-red-300">Java {requiredJava}+ не найдена — сервер не запустится</p>
                <p className="text-[11px] text-[#55556a] mt-0.5">Установлена Java {javas[0]?.major}, нужна {requiredJava}+</p>
              </div>
              <button
                onClick={() => setShowInstaller(v => !v)}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[11px] font-semibold rounded-lg transition-colors"
              >
                <Download size={12} strokeWidth={2.5} />
                Установить
              </button>
            </div>
          ) : (
            /* All good */
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1bd96a10] border border-[#1bd96a25] mb-3">
              <Check size={14} className="text-[#1bd96a] shrink-0" strokeWidth={3} />
              <div className="flex-1">
                <p className="text-[12px] font-medium text-[#1bd96a]">
                  Java {bestJava?.major} выбрана автоматически
                </p>
                {requiredJava && (
                  <p className="text-[11px] text-[#55556a] mt-0.5">Для этого сервера нужна Java {requiredJava}+</p>
                )}
              </div>
              <button
                onClick={() => setShowInstaller(v => !v)}
                className="shrink-0 flex items-center gap-1 text-[11px] text-[#55556a] hover:text-[#8b8b9e] transition-colors"
              >
                {showInstaller ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showInstaller ? 'Скрыть' : 'Ещё версии'}
              </button>
            </div>
          )}
        </div>

        {showInstaller && (
          <JavaInstaller
            onInstalled={async () => { await scan(); await loadAll(); setShowInstaller(false) }}
            requiredMajor={requiredJava}
          />
        )}

        {/* RAM quick picker */}
        <div>
          <label className="block text-[11px] font-medium text-[#8b8b9e] mb-2">Максимум RAM</label>
          <div className="flex gap-1.5 flex-wrap">
            {['512M', '1G', '2G', '4G', '6G', '8G', '12G', '16G'].map(val => {
              const current = args.match(/-Xmx(\S+)/i)?.[1] ?? ''
              const active = current.toUpperCase() === val.toUpperCase()
              return (
                <button
                  key={val}
                  onClick={() => {
                    const ms = val.endsWith('G') ? Math.max(1, Math.floor(parseInt(val) / 2)) + 'G' : '256M'
                    const base = args.replace(/-Xmx\S+/gi, '').replace(/-Xms\S+/gi, '').trim()
                    handleArgsChange(`${base} -Xmx${val} -Xms${ms}`.trim())
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    active
                      ? 'bg-[#1bd96a20] text-[#1bd96a] border border-[#1bd96a40]'
                      : 'bg-[#17171c] text-[#55556a] border border-[#2a2a35] hover:border-[#33333f] hover:text-[#8b8b9e]'
                  }`}
                >
                  {val}
                </button>
              )
            })}
          </div>
        </div>

        {/* JVM args — auto-save */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-medium text-[#8b8b9e]">JVM аргументы</label>
            {savedArgs && (
              <span className="flex items-center gap-1 text-[10px] text-[#1bd96a]">
                <Check size={9} strokeWidth={3} /> сохранено
              </span>
            )}
          </div>
          <input
            type="text"
            value={args}
            onChange={e => handleArgsChange(e.target.value)}
            className="w-full bg-[#1e1e26] border border-[#2a2a35] focus:border-[#1bd96a] rounded-lg px-3 py-2 text-[12px] text-[#ecedee] outline-none transition-colors font-mono"
            style={{ userSelect: 'text' }}
          />
          <p className="text-[11px] text-[#33334a] mt-1">Сохраняется автоматически</p>
        </div>

      </div>
    </div>
  )
}

function JavaInstaller({ onInstalled, requiredMajor }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(null)
  const [phase, setPhase] = useState(null)
  const [pct, setPct] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.getInstallableJavaVersions().then(v => { setVersions(v); setLoading(false) })
    const unsub = window.api.onJavaInstallProgress(data => { setPhase(data.phase); setPct(data.pct) })
    return unsub
  }, [])

  async function install(ver) {
    setInstalling(ver.major)
    setError('')
    setPhase('download')
    setPct(0)
    const res = await window.api.installJava({ major: ver.major, downloadUrl: ver.downloadUrl, name: ver.name, installDir: ver.installDir })
    if (res.ok) {
      setPhase('done')
      setTimeout(() => { setInstalling(null); setPhase(null); onInstalled() }, 1200)
    } else {
      setError(res.error)
      setInstalling(null)
      setPhase(null)
    }
  }

  const MC_NEEDS = { 21: 'MC 1.21+', 17: 'MC 1.18–1.20', 11: 'MC 1.17', 8: 'MC ≤1.16' }

  return (
    <div className="p-4 bg-[#1e1e26] border border-[#2a2a35] rounded-xl">
      <p className="text-[12px] font-semibold text-[#ecedee] mb-1">Установить Java (Adoptium JDK)</p>
      <p className="text-[11px] text-[#55556a] mb-3">Права администратора не нужны</p>

      {loading && <p className="text-[11px] text-[#55556a]">Загрузка…</p>}
      {!loading && versions.length === 0 && <p className="text-[11px] text-red-400">Не удалось загрузить — проверь интернет</p>}

      <div className="flex flex-col gap-2">
        {versions.map(ver => {
          const isInstalling = installing === ver.major
          const isDone = isInstalling && phase === 'done'
          const isRecommended = requiredMajor && ver.major === Math.min(...versions.filter(v => v.major >= requiredMajor).map(v => v.major))
          return (
            <div key={ver.major} className={`flex items-center gap-3 p-3 rounded-lg border ${isRecommended ? 'bg-[#1bd96a08] border-[#1bd96a30]' : 'bg-[#17171c] border-[#2a2a35]'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[12px] font-medium text-[#ecedee]">Java {ver.major}</p>
                  <span className="text-[10px] text-[#55556a] bg-[#26262f] px-1.5 py-0.5 rounded">{MC_NEEDS[ver.major] ?? ''}</span>
                  {isRecommended && <span className="text-[10px] text-[#1bd96a] bg-[#1bd96a15] px-1.5 py-0.5 rounded font-medium">рекомендуется</span>}
                </div>
                {isInstalling && phase !== 'done' && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-[#55556a] mb-1">
                      <span>{phase === 'download' ? 'Скачивание…' : 'Установка…'}</span>
                      <span>{phase === 'download' ? pct + '%' : ''}</span>
                    </div>
                    <div className="h-1 bg-[#26262f] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${phase === 'install' ? 'bg-yellow-400 animate-pulse w-full' : 'bg-[#1bd96a]'}`}
                        style={{ width: phase === 'download' ? `${pct}%` : '100%' }} />
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => install(ver)}
                disabled={!!installing}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDone ? 'bg-[#1bd96a20] text-[#1bd96a]' : 'bg-[#1bd96a] hover:bg-[#17c05d] text-black'
                }`}
              >
                {isDone ? <><Check size={11} strokeWidth={3} /> Готово</> : <><Download size={11} strokeWidth={2.5} /> Установить</>}
              </button>
            </div>
          )
        })}
      </div>
      {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
    </div>
  )
}
