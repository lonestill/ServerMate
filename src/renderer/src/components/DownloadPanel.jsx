import React, { useState, useEffect } from 'react'
import { Download, Check, AlertTriangle, X, RefreshCw } from '../Icons'
import VersionPicker from './VersionPicker'

const TYPES = {
  paper: 'Paper — быстрый, поддерживает плагины Bukkit/Spigot',
  vanilla: 'Vanilla — официальный сервер Mojang',
  fabric: 'Fabric — для модов',
}

// Warnings shown depending on what's being overwritten
function getWarnings(type, previousType) {
  const warnings = []

  if (previousType && previousType !== type) {
    warnings.push({
      level: 'error',
      text: `Ты меняешь ядро с ${previousType} на ${type}. Плагины/моды от ${previousType} не будут работать с ${type} — их нужно удалить вручную.`,
    })
  }

  if (type === 'fabric' || previousType === 'fabric') {
    warnings.push({
      level: 'warn',
      text: 'Fabric моды несовместимы с Paper/Vanilla плагинами и наоборот.',
    })
  }

  if (type === 'vanilla' && previousType === 'paper') {
    warnings.push({
      level: 'warn',
      text: 'Vanilla не поддерживает плагины. Все плагины в папке plugins перестанут загружаться.',
    })
  }

  warnings.push({
    level: 'warn',
    text: 'Смена версии Minecraft (например 1.20 → 1.21) может повредить мир или вызвать баги на границах чанков.',
  })

  warnings.push({
    level: 'info',
    text: 'Сделай бэкап папки сервера перед переустановкой.',
  })

  return warnings
}

function detectCoreType(hasJar) {
  // We can't know previous type without storing it, so return null
  return null
}

function ReinstallWarningModal({ type, previousType, onConfirm, onCancel }) {
  const warnings = getWarnings(type, previousType)
  const hasError = warnings.some((w) => w.level === 'error')

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl p-5 w-[420px] shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#ecedee]">Сервер уже установлен</p>
            <p className="text-[11px] text-[#55556a] mt-0.5">Ознакомься с возможными последствиями перед заменой</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-[#55556a] hover:text-[#8b8b9e] transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-5">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg text-[12px] ${
                w.level === 'error'
                  ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                  : w.level === 'warn'
                  ? 'bg-yellow-500/10 border border-yellow-500/15 text-yellow-200/80'
                  : 'bg-[#26262f] border border-[#2a2a35] text-[#8b8b9e]'
              }`}
            >
              <AlertTriangle
                size={12}
                className={`mt-0.5 shrink-0 ${
                  w.level === 'error' ? 'text-red-400' : w.level === 'warn' ? 'text-yellow-400' : 'text-[#55556a]'
                }`}
              />
              {w.text}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-[12px] text-[#55556a] hover:text-[#8b8b9e] transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
              hasError
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-yellow-500 hover:bg-yellow-400 text-black'
            }`}
          >
            {hasError ? 'Всё равно установить' : 'Понятно, установить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DownloadPanel({ server, onDone }) {
  const [type, setType] = useState('paper')
  const [versions, setVersions] = useState([])
  const [selectedVersion, setSelectedVersion] = useState('')
  const [fabricLoaders, setFabricLoaders] = useState([])
  const [selectedLoader, setSelectedLoader] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [showWarning, setShowWarning] = useState(false)

  const alreadyInstalled = server.hasJar
  const [updateInfo, setUpdateInfo] = useState(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  async function checkUpdate() {
    setCheckingUpdate(true)
    const info = await window.api.checkServerUpdate(server.name)
    setUpdateInfo(info)
    setCheckingUpdate(false)
    if (info.available) {
      // auto-select the right MC version
      setType('paper')
    }
  }

  useEffect(() => {
    const unsub = window.api.onDownloadProgress((pct) => setProgress(pct))
    return unsub
  }, [])

  useEffect(() => {
    setVersions([])
    setSelectedVersion('')
    setError('')
    setProgress(null)
    fetchVersions()
  }, [type])

  async function fetchVersions() {
    setLoading(true)
    try {
      if (type === 'vanilla') {
        const v = await window.api.getVanillaVersions()
        setVersions(v)
        setSelectedVersion(v[0]?.id ?? '')
      } else if (type === 'paper') {
        const v = await window.api.getPaperVersions()
        setVersions(v.map((id) => ({ id })))
        setSelectedVersion(v[0] ?? '')
      } else {
        const [mc, loaders] = await Promise.all([window.api.getVanillaVersions(), window.api.getFabricVersions()])
        setVersions(mc)
        setSelectedVersion(mc[0]?.id ?? '')
        setFabricLoaders(loaders)
        setSelectedLoader(loaders[0] ?? '')
      }
    } catch (e) {
      setError('Не удалось загрузить версии: ' + e.message)
    }
    setLoading(false)
  }

  function handleDownloadClick() {
    if (alreadyInstalled) {
      setShowWarning(true)
    } else {
      runDownload()
    }
  }

  async function runDownload() {
    setShowWarning(false)
    setProgress(0)
    setError('')
    try {
      let res
      if (type === 'vanilla') {
        const v = versions.find((v) => v.id === selectedVersion)
        res = await window.api.downloadVanilla({ serverName: server.name, version: selectedVersion, versionUrl: v.url })
      } else if (type === 'paper') {
        res = await window.api.downloadPaper({ serverName: server.name, version: selectedVersion })
      } else {
        res = await window.api.downloadFabric({ serverName: server.name, mcVersion: selectedVersion, loaderVersion: selectedLoader })
      }
      if (res.ok) {
        setProgress(100)
        // Update server metadata so LeftPanel shows correct core badge
        await window.api.saveMeta(server.name, {
          core: type,
          mcVersion: selectedVersion,
          loaderVersion: selectedLoader || undefined,
        })
        onDone()
      } else setError(res.error)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <div className="p-6 max-w-sm">
        <div className="mb-5">
          <h2 className="text-[14px] font-semibold text-[#ecedee]">
            {alreadyInstalled ? 'Переустановить сервер' : 'Установить сервер'}
          </h2>
          <p className="text-[11px] text-[#55556a] mt-0.5">
            {alreadyInstalled
              ? 'Заменит существующий server.jar'
              : 'Скачает server.jar и примет EULA автоматически'}
          </p>
        </div>

        {/* Already installed notice */}
        {alreadyInstalled && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#26262f] border border-[#2a2a35] mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1bd96a] shrink-0" />
            <p className="text-[11px] text-[#8b8b9e] flex-1">Сервер уже установлен — выбери новую версию для замены</p>
            {server.core === 'paper' && (
              <button
                onClick={checkUpdate}
                disabled={checkingUpdate}
                className="flex items-center gap-1 text-[10px] text-[#55556a] hover:text-[#8b8b9e] transition-colors shrink-0"
              >
                <RefreshCw size={10} className={checkingUpdate ? 'animate-spin' : ''} />
                {checkingUpdate ? 'Проверка…' : 'Проверить'}
              </button>
            )}
          </div>
        )}

        {/* Update available banner */}
        {updateInfo?.available && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[#f59e0b0d] border border-[#f59e0b25] mb-4">
            <RefreshCw size={12} className="text-[#f59e0b] mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-[#f59e0b]">Доступно обновление Paper</p>
              <p className="text-[11px] text-[#55556a]">Билд #{updateInfo.latest} для MC {updateInfo.mcVersion} (у вас #{updateInfo.current})</p>
            </div>
          </div>
        )}
        {updateInfo && !updateInfo.available && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#1bd96a08] border border-[#1bd96a25] mb-4">
            <Check size={11} className="text-[#1bd96a]" strokeWidth={3} />
            <p className="text-[11px] text-[#1bd96a]">Установлен актуальный билд #{updateInfo.latest}</p>
          </div>
        )}

        {/* Type selector */}
        <div className="flex gap-1.5 mb-1.5">
          {Object.keys(TYPES).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-all ${
                type === t
                  ? 'bg-[#1bd96a18] text-[#1bd96a] border border-[#1bd96a33]'
                  : 'text-[#55556a] hover:text-[#8b8b9e] bg-[#1e1e26] border border-transparent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#33334a] mb-5">{TYPES[type]}</p>

        {loading ? (
          <p className="text-[12px] text-[#55556a]">Загрузка списка версий…</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#8b8b9e]">Версия Minecraft</label>
              <VersionPicker versions={versions} value={selectedVersion} onChange={setSelectedVersion} />
            </div>

            {type === 'fabric' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#8b8b9e]">Fabric Loader</label>
                <VersionPicker versions={fabricLoaders.map(v => ({ id: v }))} value={selectedLoader} onChange={setSelectedLoader} />
              </div>
            )}

            {error && <p className="text-[11px] text-red-400">{error}</p>}

            {progress !== null && progress < 100 && (
              <div>
                <div className="flex justify-between text-[10px] text-[#55556a] mb-1">
                  <span>Скачивание…</span><span>{progress}%</span>
                </div>
                <div className="h-1 bg-[#26262f] rounded-full overflow-hidden">
                  <div className="h-full bg-[#1bd96a] transition-all duration-200 rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            {progress === 100 && (
              <div className="flex items-center gap-1.5 text-[12px] text-[#1bd96a]">
                <Check size={13} strokeWidth={3} /> Установлено
              </div>
            )}

            <button
              onClick={handleDownloadClick}
              disabled={!selectedVersion || (progress !== null && progress < 100)}
              className={`flex items-center gap-2 px-4 py-2 disabled:opacity-30 disabled:cursor-not-allowed text-[12px] font-semibold rounded-lg transition-colors w-fit mt-1 ${
                alreadyInstalled
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                  : 'bg-[#1bd96a] hover:bg-[#17c05d] text-black'
              }`}
            >
              <Download size={13} strokeWidth={2.5} />
              {alreadyInstalled ? 'Заменить ядро' : 'Скачать и установить'}
            </button>
          </div>
        )}
      </div>

      {showWarning && (
        <ReinstallWarningModal
          type={type}
          previousType={null}
          onConfirm={runDownload}
          onCancel={() => setShowWarning(false)}
        />
      )}
    </>
  )
}
