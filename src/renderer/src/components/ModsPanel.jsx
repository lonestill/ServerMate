import React, { useState, useEffect, useRef } from 'react'
import { FolderOpen, RefreshCw, Puzzle, Power, Trash2, FileText, ChevronRight, Check, AlertTriangle, X, Search } from '../Icons'

export default function ModsPanel({ server }) {
  const [modsData, setModsData] = useState(null)
  const [configs, setConfigs] = useState([])
  const [configTab, setConfigTab] = useState('mods') // 'mods' | 'configs'
  const [selectedConfig, setSelectedConfig] = useState(null)
  const [configContent, setConfigContent] = useState('')
  const [configDirty, setConfigDirty] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [deletingMod, setDeletingMod] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modSearch, setModSearch] = useState('')
  const debounceRef = useRef(null)

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  async function loadMods() {
    setLoading(true)
    const [mods, cfgs] = await Promise.all([
      window.api.listMods(server.name),
      window.api.listConfigs(server.name),
    ])
    setModsData(mods)
    setConfigs(cfgs)
    setLoading(false)
  }

  useEffect(() => { loadMods() }, [server.name])

  async function toggleMod(mod) {
    await window.api.toggleMod(server.name, mod.filename)
    await loadMods()
  }

  async function deleteMod(mod) {
    await window.api.deleteMod(server.name, mod.filename)
    setDeletingMod(null)
    await loadMods()
  }

  async function openConfig(cfg) {
    const res = await window.api.readConfig(cfg.path)
    if (res.ok) {
      setSelectedConfig(cfg)
      setConfigContent(res.content)
      setConfigDirty(false)
      setConfigSaved(false)
    }
  }

  async function saveConfig(path, content) {
    const res = await window.api.writeConfig(path, content)
    if (res.ok) {
      setConfigDirty(false)
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 1500)
    }
  }

  function handleConfigChange(value) {
    setConfigContent(value)
    setConfigDirty(true)
    setConfigSaved(false)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveConfig(selectedConfig.path, value), 700)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[12px] text-[#55556a]">
        <div className="w-4 h-4 rounded-full border border-[#55556a] border-t-transparent animate-spin" />
        Загрузка…
      </div>
    )
  }

  const hasNoPluginsFolder = !modsData?.type
  const typeLabel = modsData?.type === 'plugins' ? 'плагины' : modsData?.type === 'mods' ? 'моды' : null
  const enabledCount = modsData?.mods?.filter(m => m.enabled).length ?? 0
  const totalCount = modsData?.mods?.length ?? 0

  return (
    <div className="flex h-full">
      {/* Left panel: mod list or config list */}
      <div className="w-72 shrink-0 border-r border-[#2a2a35] flex flex-col bg-[#111116]">
        {/* Sub-tab switcher */}
        <div className="flex border-b border-[#2a2a35]">
          <button
            onClick={() => setConfigTab('mods')}
            className={`flex-1 py-2.5 text-[11px] font-medium transition-colors ${configTab === 'mods' ? 'text-[#1bd96a] border-b border-[#1bd96a]' : 'text-[#55556a] hover:text-[#8b8b9e]'}`}
          >
            {typeLabel ? typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1) : 'Моды'}
          </button>
          <button
            onClick={() => setConfigTab('configs')}
            className={`flex-1 py-2.5 text-[11px] font-medium transition-colors ${configTab === 'configs' ? 'text-[#1bd96a] border-b border-[#1bd96a]' : 'text-[#55556a] hover:text-[#8b8b9e]'}`}
          >
            Конфиги {configs.length > 0 && <span className="text-[#33334a]">({configs.length})</span>}
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#2a2a35]">
          <div className="flex flex-1 items-center gap-1.5 px-2 py-1 bg-[#17171c] border border-[#2a2a35] rounded-lg focus-within:border-[#1bd96a] transition-colors">
            <Search size={11} className="text-[#33334a] shrink-0" />
            <input
              type="text"
              value={modSearch}
              onChange={e => setModSearch(e.target.value)}
              placeholder="Поиск…"
              className="flex-1 bg-transparent text-[11px] text-[#ecedee] placeholder-[#33334a] outline-none"
              style={{ userSelect: 'text' }}
            />
          </div>
          <button onClick={loadMods} className="text-[#33334a] hover:text-[#55556a] transition-colors p-1">
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => window.api.openModsFolder(server.name)}
            className="text-[#33334a] hover:text-[#55556a] transition-colors p-1"
            title="Открыть папку"
          >
            <FolderOpen size={12} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {configTab === 'mods' ? (
            hasNoPluginsFolder ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
                <Puzzle size={28} className="text-[#2a2a35]" />
                <p className="text-[12px] text-[#55556a]">Папка плагинов не найдена</p>
                <p className="text-[11px] text-[#33334a]">Запусти сервер хотя бы раз</p>
              </div>
            ) : modsData.mods.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
                <Puzzle size={28} className="text-[#2a2a35]" />
                <p className="text-[12px] text-[#55556a]">Нет {typeLabel}</p>
                <p className="text-[11px] text-[#33334a]">Скопируй .jar файлы в папку {modsData.type}/</p>
              </div>
            ) : (
              <div className="py-1">
                {totalCount > 0 && (
                  <p className="px-3 py-1.5 text-[10px] text-[#33334a]">{enabledCount} из {totalCount} активны</p>
                )}
                {modsData.mods
                  .filter(m => !modSearch || m.name.toLowerCase().includes(modSearch.toLowerCase()))
                  .map(mod => (
                  <ModRow
                    key={mod.filename}
                    mod={mod}
                    onToggle={() => toggleMod(mod)}
                    onDelete={() => setDeletingMod(mod)}
                  />
                ))}
              </div>
            )
          ) : (
            configs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
                <FileText size={28} className="text-[#2a2a35]" />
                <p className="text-[12px] text-[#55556a]">Конфиги не найдены</p>
                <p className="text-[11px] text-[#33334a]">Появятся после первого запуска</p>
              </div>
            ) : (
              <div className="py-1">
                {configs.map((cfg, i) => (
                  <button
                    key={i}
                    onClick={() => openConfig(cfg)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      selectedConfig?.path === cfg.path ? 'bg-[#1e1e26] text-[#ecedee]' : 'text-[#8b8b9e] hover:bg-[#1a1a21]'
                    }`}
                  >
                    <FileText size={12} className="shrink-0 text-[#55556a]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate">{cfg.file}</p>
                      <p className="text-[10px] text-[#33334a] truncate">{cfg.plugin}</p>
                    </div>
                    <ChevronRight size={11} className="text-[#33334a] shrink-0" />
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Right panel: config editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedConfig ? (
          <>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a35] bg-[#111116] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={13} className="text-[#55556a] shrink-0" />
                <span className="text-[12px] font-medium text-[#ecedee] truncate">{selectedConfig.plugin} / {selectedConfig.file}</span>
                {configDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#1bd96a] shrink-0" />}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => window.api.openConfigFile(selectedConfig.path)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#55556a] hover:text-[#8b8b9e] transition-colors"
                >
                  <FolderOpen size={11} /> В редакторе
                </button>
                {configSaved && (
                  <span className="flex items-center gap-1 text-[11px] text-[#1bd96a]">
                    <Check size={10} strokeWidth={3} /> сохранено
                  </span>
                )}
                <button onClick={() => setSelectedConfig(null)} className="text-[#33334a] hover:text-[#55556a] ml-1 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
            <textarea
              value={configContent}
              onChange={(e) => handleConfigChange(e.target.value)}
              className="flex-1 bg-[#111116] text-[12px] text-[#c8c8d8] font-mono p-4 outline-none resize-none leading-relaxed"
              style={{ userSelect: 'text', tabSize: 2 }}
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <FileText size={36} className="text-[#2a2a35]" />
            <p className="text-[13px] text-[#55556a]">Выбери конфиг из списка слева</p>
            <p className="text-[11px] text-[#33334a]">Конфиги появляются в папках плагинов после первого запуска</p>
            <button
              onClick={() => window.api.openServerFolder(server.name)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e26] border border-[#2a2a35] hover:border-[#33333f] text-[11px] text-[#55556a] hover:text-[#8b8b9e] rounded-lg transition-all mt-2"
            >
              <FolderOpen size={12} />
              Открыть папку сервера
            </button>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deletingMod && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl p-5 w-72 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400" />
              <p className="text-[13px] font-semibold text-[#ecedee]">Удалить плагин?</p>
            </div>
            <p className="text-[12px] text-[#55556a] mb-4">«{deletingMod.name}» будет удалён навсегда.</p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteMod(deletingMod)}
                className="flex-1 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-[12px] font-semibold rounded-lg transition-colors"
              >
                Удалить
              </button>
              <button
                onClick={() => setDeletingMod(null)}
                className="flex-1 py-2 bg-[#26262f] hover:bg-[#2e2e3a] text-[#8b8b9e] text-[12px] rounded-lg transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModRow({ mod, onToggle, onDelete }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${hovered ? 'bg-[#1e1e26]' : ''} ${!mod.enabled ? 'opacity-50' : ''}`}
    >
      {/* Toggle */}
      <button
        onClick={onToggle}
        title={mod.enabled ? 'Выключить' : 'Включить'}
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
          mod.enabled ? 'bg-[#1bd96a15] text-[#1bd96a] hover:bg-[#1bd96a25]' : 'bg-[#26262f] text-[#33334a] hover:text-[#55556a]'
        }`}
      >
        <Power size={12} strokeWidth={2.5} />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-[#ecedee] truncate">{mod.name}</p>
        {!mod.enabled && <p className="text-[10px] text-[#33334a]">выключен</p>}
      </div>

      {hovered && (
        <button
          onClick={onDelete}
          className="shrink-0 w-6 h-6 flex items-center justify-center text-[#33334a] hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}
