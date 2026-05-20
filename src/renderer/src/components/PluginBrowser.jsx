import React, { useState, useEffect, useRef } from 'react'
import { Search, Download, Check, AlertTriangle, RefreshCw, ExternalLink, X, ChevronDown, Star, Puzzle, Trash2, ArrowUpCircle } from '../Icons'

const SOURCES = [
  { id: 'all',      label: 'Все' },
  { id: 'modrinth', label: 'Modrinth' },
  { id: 'hangar',   label: 'Hangar' },
]

const SOURCE_STYLE = {
  modrinth: { bg: '#1bd96a15', text: '#1bd96a', dot: '#1bd96a' },
  hangar:   { bg: '#3b82f615', text: '#60a5fa', dot: '#3b82f6' },
}

// Detect server type → what to search and which loaders to use
function getServerMeta(server) {
  const core = server.core || 'paper'
  const isFabric = core === 'fabric'
  const projectType = isFabric ? 'mod' : 'plugin'
  const loaders = isFabric
    ? ['fabric']
    : ['paper', 'spigot', 'bukkit', 'purpur', 'folia']
  return { projectType, loaders, isFabric }
}

function fmtNum(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PluginBrowser({ server }) {
  const { projectType, loaders, isFabric } = getServerMeta(server)

  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchErrors, setSearchErrors] = useState([])
  const [selected, setSelected] = useState(null) // plugin object
  const [versions, setVersions] = useState([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [installing, setInstalling] = useState(null) // versionId
  const [installProgress, setInstallProgress] = useState(0)
  const [installed, setInstalled] = useState(new Set()) // filenames (lowercased)
  const [justInstalled, setJustInstalled] = useState(new Set()) // versionIds installed this session
  const [expandChangelog, setExpandChangelog] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [sortBy, setSortBy] = useState('downloads') // downloads | updated | name

  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  // Load installed plugins list
  useEffect(() => {
    window.api.listInstalledPlugins(server.name).then(list => {
      setInstalled(new Set(list))
    })
  }, [server.name])

  // Subscribe to install progress
  useEffect(() => {
    const unsub = window.api.onPluginProgress((data) => {
      setInstallProgress(data.pct)
    })
    return unsub
  }, [])

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setHasSearched(false); return }
    debounceRef.current = setTimeout(() => doSearch(query), 400)
    return () => clearTimeout(debounceRef.current)
  }, [query, source])

  async function doSearch(q) {
    setSearching(true)
    setSearchErrors([])
    setSelected(null)
    setHasSearched(true)
    const res = await window.api.searchPlugins({
      query: q,
      source,
      projectType,
      mcVersion: server.mcVersion || null,
    })
    setResults(res.results)
    setSearchErrors(res.errors || [])
    setSearching(false)
  }

  async function selectPlugin(plugin) {
    setSelected(plugin)
    setVersions([])
    setExpandChangelog(null)
    setLoadingVersions(true)
    const vers = await window.api.getPluginVersions({
      source: plugin.source,
      projectId: plugin.id,
      slug: plugin.slug,
      author: plugin.author,
      loaders,
      mcVersion: server.mcVersion || null,
    })
    setVersions(vers)
    setLoadingVersions(false)
  }

  async function installVersion(ver, isUpdate = false) {
    if (!selected) return
    // If updating, delete old file first
    if (isUpdate) {
      const oldFile = findInstalledFilename(installed, selected)
      if (oldFile) {
        await window.api.deleteMod(server.name, oldFile)
        setInstalled(s => { const n = new Set(s); n.delete(oldFile); return n })
      }
    }
    setInstalling(ver.id)
    setInstallProgress(0)
    const res = await window.api.installPlugin({
      serverName: server.name,
      downloadUrl: ver.downloadUrl,
      filename: ver.filename,
      source: selected.source,
      author: selected.author,
      slug: selected.slug,
      versionId: ver.versionId || ver.id,
    })
    setInstalling(null)
    if (res.ok) {
      setJustInstalled(s => new Set([...s, ver.id]))
      setInstalled(s => new Set([...s, res.filename.toLowerCase()]))
    } else {
      alert('Ошибка установки: ' + res.error)
    }
  }

  async function deletePlugin() {
    if (!selected) return
    const filename = findInstalledFilename(installed, selected)
    if (!filename) return
    await window.api.deleteMod(server.name, filename)
    setInstalled(s => { const n = new Set(s); n.delete(filename); return n })
    setJustInstalled(new Set())
  }

  const isPluginInstalled = (plugin) => {
    if (!plugin) return false
    return !!findInstalledFilename(installed, plugin)
  }

  function findInstalledFilename(installedSet, plugin) {
    const slug = (plugin.slug || plugin.name || '').toLowerCase().replace(/\s+/g, '-')
    for (const f of installedSet) {
      if (f.replace('.jar.disabled', '.jar').includes(slug)) return f
    }
    return null
  }

  const typeLabel = isFabric ? 'мод' : 'плагин'
  const typeLabelPlural = isFabric ? 'моды' : 'плагины'

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: search + results */}
      <div className="w-[340px] shrink-0 flex flex-col border-r border-[#2a2a35] bg-[#111116]">
        {/* Search bar */}
        <div className="p-3 border-b border-[#2a2a35]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e26] border border-[#2a2a35] focus-within:border-[#1bd96a] rounded-xl transition-colors">
            <Search size={13} className="text-[#55556a] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Поиск ${typeLabelPlural}…`}
              autoFocus
              className="flex-1 bg-transparent text-[12px] text-[#ecedee] placeholder-[#33334a] outline-none"
              style={{ userSelect: 'text' }}
            />
            {searching && <RefreshCw size={12} className="text-[#55556a] animate-spin shrink-0" />}
            {query && !searching && (
              <button onClick={() => setQuery('')} className="text-[#33334a] hover:text-[#55556a] transition-colors">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Source filter + sort */}
          <div className="flex gap-1 mt-2 flex-wrap">
            {SOURCES.filter(s => s.id !== 'hangar' || !isFabric).map(s => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  source === s.id ? 'bg-[#1bd96a18] text-[#1bd96a]' : 'text-[#55556a] hover:text-[#8b8b9e] hover:bg-[#1e1e26]'
                }`}
              >
                {s.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {server.mcVersion && (
                <span className="text-[10px] text-[#33334a] self-center mr-1">MC {server.mcVersion}</span>
              )}
              {[{id:'downloads',label:'↓'},{id:'updated',label:'🕐'},{id:'name',label:'A-Z'}].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id)}
                  title={{ downloads: 'По скачиваниям', updated: 'По дате', name: 'По названию' }[s.id]}
                  className={`px-2 py-0.5 rounded text-[10px] transition-all ${sortBy === s.id ? 'bg-[#1bd96a18] text-[#1bd96a]' : 'text-[#33334a] hover:text-[#55556a]'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!hasSearched && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center pb-8">
              <div className="w-14 h-14 rounded-2xl bg-[#1e1e26] border border-[#2a2a35] flex items-center justify-center">
                <Puzzle size={22} className="text-[#2a2a35]" />
              </div>
              <div>
                <p className="text-[12px] text-[#55556a]">Ищи {typeLabelPlural} по названию</p>
                <p className="text-[10px] text-[#33334a] mt-1">Modrinth + Hangar</p>
              </div>
              <div className="flex flex-col gap-1 w-full">
                {(isFabric
                ? ['Fabric API', 'Lithium', 'Sodium', 'Iris', 'Carpet']
                : ['WorldEdit', 'EssentialsX', 'LuckPerms', 'Vault', 'ProtocolLib']
              ).map(s => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="px-3 py-1.5 text-[11px] text-[#55556a] hover:text-[#8b8b9e] bg-[#1e1e26] hover:bg-[#26262f] border border-[#2a2a35] rounded-lg transition-all text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasSearched && !searching && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-[12px] text-[#55556a]">Ничего не найдено</p>
              {searchErrors.length > 0 && (
                <div className="px-4 text-center">
                  {searchErrors.map((e, i) => (
                    <p key={i} className="text-[10px] text-red-400/70">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {[...results].sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name)
            if (sortBy === 'updated') return new Date(b.updated || 0) - new Date(a.updated || 0)
            return (b.downloads || 0) - (a.downloads || 0)
          }).map(plugin => (
            <ResultRow
              key={`${plugin.source}-${plugin.id}`}
              plugin={plugin}
              selected={selected?.id === plugin.id && selected?.source === plugin.source}
              installed={isPluginInstalled(plugin)}
              onClick={() => selectPlugin(plugin)}
            />
          ))}

          {searchErrors.length > 0 && results.length > 0 && (
            <div className="px-3 py-2 border-t border-[#2a2a35]">
              {searchErrors.map((e, i) => (
                <p key={i} className="text-[10px] text-red-400/70">{e}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#17171c]">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[12px] text-[#33334a]">Выбери {typeLabel} из списка</p>
          </div>
        ) : (
          <PluginDetail
            plugin={selected}
            versions={versions}
            loadingVersions={loadingVersions}
            installing={installing}
            installProgress={installProgress}
            justInstalled={justInstalled}
            installed={isPluginInstalled(selected)}
            installedFiles={installed}
            onInstall={installVersion}
            onDelete={deletePlugin}
            expandChangelog={expandChangelog}
            setExpandChangelog={setExpandChangelog}
            typeLabel={typeLabel}
            server={server}
          />
        )}
      </div>
    </div>
  )
}

function ResultRow({ plugin, selected, installed, onClick }) {
  const style = SOURCE_STYLE[plugin.source] || SOURCE_STYLE.modrinth
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-[#1a1a21] ${
        selected ? 'bg-[#1e1e26]' : 'hover:bg-[#18181f]'
      }`}
    >
      <PluginIcon icon={plugin.icon} name={plugin.name} size={32} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[12px] font-medium text-[#ecedee] truncate">{plugin.name}</p>
          {installed && <Check size={10} className="text-[#1bd96a] shrink-0" strokeWidth={3} />}
        </div>
        <p className="text-[10px] text-[#55556a] truncate mt-0.5 leading-snug">{plugin.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: style.bg, color: style.text }}>
            {plugin.source === 'modrinth' ? 'Modrinth' : 'Hangar'}
          </span>
          <span className="text-[10px] text-[#33334a] flex items-center gap-0.5">
            <Download size={9} /> {fmtNum(plugin.downloads)}
          </span>
        </div>
      </div>
    </button>
  )
}

function PluginDetail({ plugin, versions, loadingVersions, installing, installProgress, justInstalled, installed, installedFiles, onInstall, onDelete, expandChangelog, setExpandChangelog, typeLabel, server }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const style = SOURCE_STYLE[plugin.source] || SOURCE_STYLE.modrinth

  const pageUrl = plugin.source === 'modrinth'
    ? `https://modrinth.com/plugin/${plugin.slug}`
    : `https://hangar.papermc.io/${plugin.author}/${plugin.slug}`

  // Find which version is currently installed by filename match
  const installedVersionIdx = versions.findIndex(v => installedFiles.has(v.filename.toLowerCase()))
  // Newest version is index 0; if installed but not the newest → update available
  const hasUpdate = installed && installedVersionIdx > 0

  function versionState(ver, idx) {
    if (justInstalled.has(ver.id)) return 'done'
    if (installing === ver.id) return 'installing'
    if (installedFiles.has(ver.filename.toLowerCase())) return 'current'
    if (installed && idx === 0 && hasUpdate) return 'update'
    if (installed) return 'blocked'
    return 'install'
  }

  async function handleDelete() {
    setConfirmDelete(false)
    await onDelete()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 p-5 border-b border-[#2a2a35] bg-[#111116] shrink-0">
        <PluginIcon icon={plugin.icon} name={plugin.name} size={52} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-[#ecedee] truncate">{plugin.name}</h2>
              {plugin.author && <p className="text-[11px] text-[#55556a] mt-0.5">{plugin.author}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {installed && !confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  title="Удалить плагин"
                  className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-[#55556a] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                >
                  <Trash2 size={12} />
                  Удалить
                </button>
              )}
              {confirmDelete && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#8b8b9e]">Точно?</span>
                  <button
                    onClick={handleDelete}
                    className="px-2 py-1 text-[11px] font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors"
                  >
                    Да
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-[11px] text-[#55556a] hover:text-[#8b8b9e] rounded-lg transition-colors"
                  >
                    Нет
                  </button>
                </div>
              )}
              <button
                onClick={() => window.open(pageUrl, '_blank')}
                title="Открыть в браузере"
                className="text-[#55556a] hover:text-[#8b8b9e] transition-colors p-1"
              >
                <ExternalLink size={11} />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[#8b8b9e] mt-1.5 leading-relaxed line-clamp-2">{plugin.description}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.text }}>
              {plugin.source === 'modrinth' ? 'Modrinth' : 'Hangar'}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[#55556a]">
              <Download size={11} /> {fmtNum(plugin.downloads)}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[#55556a]">
              <Star size={11} /> {fmtNum(plugin.follows)}
            </span>
            {installed && !hasUpdate && (
              <span className="flex items-center gap-1 text-[11px] text-[#1bd96a]">
                <Check size={11} strokeWidth={3} /> Установлен
              </span>
            )}
            {hasUpdate && (
              <span className="flex items-center gap-1 text-[11px] text-[#f59e0b]">
                <ArrowUpCircle size={11} /> Доступно обновление
              </span>
            )}
          </div>
          {plugin.categories?.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              {plugin.categories.slice(0, 5).map(c => (
                <span key={c} className="text-[9px] px-1.5 py-0.5 bg-[#26262f] text-[#55556a] rounded">{c}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Versions */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-[11px] font-semibold text-[#55556a] uppercase tracking-wider mb-3">Версии</p>

        {loadingVersions && (
          <div className="flex items-center gap-2 text-[12px] text-[#55556a] py-4">
            <RefreshCw size={13} className="animate-spin" /> Загрузка версий…
          </div>
        )}

        {!loadingVersions && versions.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-[12px] text-[#55556a]">Нет совместимых версий</p>
            {server.mcVersion && <p className="text-[11px] text-[#33334a] mt-1">для MC {server.mcVersion}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {versions.map((ver, idx) => {
            const state = versionState(ver, idx)
            const mcStr = ver.mcVersions?.slice(0, 3).join(', ') + (ver.mcVersions?.length > 3 ? '…' : '')

            return (
              <div
                key={ver.id}
                className={`border rounded-xl p-3 transition-colors ${
                  state === 'current' ? 'bg-[#1bd96a08] border-[#1bd96a25]' :
                  state === 'update'  ? 'bg-[#f59e0b08] border-[#f59e0b25]' :
                  'bg-[#1e1e26] border-[#2a2a35]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-[#ecedee]">{ver.versionNumber}</span>
                      {state === 'current' && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-[#1bd96a20] text-[#1bd96a] rounded font-medium">текущая</span>
                      )}
                      {ver.loaders?.map(l => (
                        <span key={l} className="text-[9px] px-1.5 py-0.5 bg-[#26262f] text-[#55556a] rounded capitalize">{l}</span>
                      ))}
                    </div>
                    {mcStr && <p className="text-[10px] text-[#55556a] mt-0.5">MC {mcStr}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-[#33334a]">{fmtDate(ver.published)}</span>
                      {ver.downloads > 0 && (
                        <span className="text-[10px] text-[#33334a] flex items-center gap-0.5">
                          <Download size={9} /> {fmtNum(ver.downloads)}
                        </span>
                      )}
                    </div>
                    {ver.changelog && (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpandChangelog(expandChangelog === ver.id ? null : ver.id)}
                          className="flex items-center gap-1 text-[10px] text-[#55556a] hover:text-[#8b8b9e] transition-colors"
                        >
                          <ChevronDown size={10} className={`transition-transform ${expandChangelog === ver.id ? 'rotate-180' : ''}`} />
                          Что нового
                        </button>
                        {expandChangelog === ver.id && (
                          <p className="text-[10px] text-[#55556a] mt-1.5 leading-relaxed whitespace-pre-wrap line-clamp-6">
                            {ver.changelog.slice(0, 600)}{ver.changelog.length > 600 ? '…' : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    {state === 'done' && (
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#1bd96a15] rounded-lg">
                        <Check size={12} className="text-[#1bd96a]" strokeWidth={3} />
                        <span className="text-[11px] text-[#1bd96a] font-medium">Готово</span>
                      </div>
                    )}
                    {state === 'installing' && (
                      <div className="flex flex-col items-end gap-1.5 min-w-[80px]">
                        <div className="text-[10px] text-[#55556a]">{installProgress}%</div>
                        <div className="w-20 h-1 bg-[#2a2a35] rounded-full overflow-hidden">
                          <div className="h-full bg-[#1bd96a] rounded-full transition-all duration-200" style={{ width: `${installProgress}%` }} />
                        </div>
                      </div>
                    )}
                    {state === 'current' && (
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#1bd96a15] rounded-lg">
                        <Check size={12} className="text-[#1bd96a]" strokeWidth={3} />
                        <span className="text-[11px] text-[#1bd96a] font-medium">Установлена</span>
                      </div>
                    )}
                    {state === 'update' && (
                      <button
                        onClick={() => onInstall(ver, true)}
                        disabled={!!installing}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[11px] font-semibold rounded-lg transition-colors"
                      >
                        <ArrowUpCircle size={11} strokeWidth={2.5} />
                        Обновить
                      </button>
                    )}
                    {state === 'blocked' && (
                      <div className="px-3 py-2 text-[11px] text-[#33334a]">—</div>
                    )}
                    {state === 'install' && (
                      <button
                        onClick={() => onInstall(ver, false)}
                        disabled={!!installing}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[11px] font-semibold rounded-lg transition-colors"
                      >
                        <Download size={11} strokeWidth={2.5} />
                        Установить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {justInstalled.size > 0 && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-[#1bd96a08] border border-[#1bd96a20] rounded-xl">
            <AlertTriangle size={13} className="text-[#1bd96a] shrink-0" />
            <p className="text-[11px] text-[#1bd96a]">Перезапусти сервер чтобы применить изменения</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PluginIcon({ icon, name, size }) {
  const [err, setErr] = useState(false)
  const colors = ['#1bd96a', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899']
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length]

  if (!icon || err) {
    return (
      <div
        className="rounded-xl flex items-center justify-center shrink-0 text-black font-bold"
        style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      >
        {name?.[0]?.toUpperCase() ?? '?'}
      </div>
    )
  }

  return (
    <img
      src={icon}
      alt={name}
      onError={() => setErr(true)}
      className="rounded-xl object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  )
}
