import React, { useState, useEffect, useRef } from 'react'
import LeftPanel from './components/LeftPanel'
import ServerPanel from './components/ServerPanel'
import CreateServerModal from './components/CreateServerModal'
import { Plus, AlertTriangle, Check, X, FolderInput } from './Icons'
import AppSettings from './components/AppSettings'

export default function App() {
  const [servers, setServers] = useState([])
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [runningServer, setRunningServer] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const autostartedRef = useRef(false)

  async function refreshServers() {
    const list = await window.api.listServers()
    setServers(list)
    return list
  }

  // Sync running state from main process (handles tray reopen + true restarts)
  async function syncStatus() {
    const status = await window.api.getStatus()
    setRunningServer(status.running && status.name ? status.name : null)
  }

  useEffect(() => {
    refreshServers().then(async list => {
      // Sync server running state first
      await syncStatus()

      // Autostart: find first server with autostart=true that has a jar
      if (autostartedRef.current) return
      const status = await window.api.getStatus()
      if (status.running) { autostartedRef.current = true; return } // already running
      const toStart = list.find(s => s.autostart && s.hasJar)
      if (toStart) {
        autostartedRef.current = true
        setSelected(toStart)
        window.api.startServer({ serverName: toStart.name }).then(res => {
          if (res.ok) setRunningServer(toStart.name)
        })
      }
    })

    // Re-sync every time the window gains focus (e.g. restored from tray)
    window.addEventListener('focus', syncStatus)
    return () => window.removeEventListener('focus', syncStatus)
  }, [])

  // Keep selected in sync when servers list changes
  useEffect(() => {
    if (!selected) return
    const updated = servers.find(s => s.name === selected.name)
    if (updated) setSelected(updated)
    else setSelected(servers[0] ?? null) // deleted server → pick first
  }, [servers])

  async function handleDeleteServer(server) {
    setDeleteTarget(server)
    setDeleteError('')
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const res = await window.api.deleteServer(deleteTarget.name)
    if (!res.ok) { setDeleteError(res.error); return }
    if (selected?.name === deleteTarget.name) setSelected(null)
    setDeleteTarget(null)
    await refreshServers()
  }

  async function handleRename(oldServer, newName) {
    const res = await window.api.renameServer(oldServer.name, newName)
    if (!res.ok) return res.error
    const list = await refreshServers()
    if (selected?.name === oldServer.name) {
      const updated = list.find(s => s.name === newName)
      if (updated) setSelected(updated)
    }
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#17171c' }}>
      <LeftPanel
        servers={servers}
        selected={selected}
        runningServer={runningServer}
        onSelect={setSelected}
        onCreateServer={() => setShowCreate(true)}
        onImportServer={() => setShowImport(true)}
        onDeleteServer={handleDeleteServer}
        onRenameServer={setRenameTarget}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="flex-1 overflow-hidden">
        {selected ? (
          <ServerPanel
            key={selected.name}
            server={selected}
            runningServer={runningServer}
            onStarted={(name) => setRunningServer(name)}
            onStopped={() => setRunningServer(null)}
            onRefresh={refreshServers}
          />
        ) : (
          <EmptyState onCreateServer={() => setShowCreate(true)} onImportServer={() => setShowImport(true)} />
        )}
      </div>

      {showCreate && (
        <CreateServerModal
          existingServers={servers}
          onClose={() => setShowCreate(false)}
          onCreated={async (name) => {
            const list = await refreshServers()
            setShowCreate(false)
            const created = list.find(s => s.name === name)
            if (created) setSelected(created)
          }}
        />
      )}

      {showImport && (
        <ImportModal
          existingServers={servers}
          onClose={() => setShowImport(false)}
          onImported={async (name) => {
            const list = await refreshServers()
            setShowImport(false)
            const imported = list.find(s => s.name === name)
            if (imported) setSelected(imported)
          }}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          server={deleteTarget}
          isRunning={runningServer === deleteTarget.name}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => { setDeleteTarget(null); setDeleteError('') }}
        />
      )}

      {showSettings && <AppSettings onClose={() => setShowSettings(false)} />}

      {renameTarget && (
        <RenameModal
          server={renameTarget}
          existingServers={servers}
          isRunning={runningServer === renameTarget.name}
          onRename={handleRename}
          onClose={() => setRenameTarget(null)}
        />
      )}
    </div>
  )
}

function EmptyState({ onCreateServer, onImportServer }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-[#1e1e26] border border-[#2a2a35] flex items-center justify-center mb-2">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[#2a2a35]">
          <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[14px] font-medium text-[#55556a]">Нет выбранного сервера</p>
        <p className="text-[12px] text-[#33334a] mt-1">Создай новый или импортируй существующий</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCreateServer}
          className="flex items-center gap-2 px-4 py-2 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[12px] font-semibold rounded-lg transition-colors"
        >
          <Plus size={13} /> Создать сервер
        </button>
        <button
          onClick={onImportServer}
          className="flex items-center gap-2 px-4 py-2 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] text-[#8b8b9e] text-[12px] rounded-lg transition-colors"
        >
          <FolderInput size={13} /> Импорт
        </button>
      </div>
    </div>
  )
}

function ImportModal({ existingServers, onClose, onImported }) {
  const [sourcePath, setSourcePath] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const sanitized = name.trim().replace(/\s+/g, '-')
  const isDuplicate = existingServers.some(s => s.name.toLowerCase() === sanitized.toLowerCase())

  async function pickFolder() {
    const path = await window.api.showFolderDialog()
    if (!path) return
    setSourcePath(path)
    // Auto-fill name from folder name
    const folderName = path.split(/[\\/]/).pop()
    setName(folderName)
    setError('')
  }

  async function handleImport(e) {
    e.preventDefault()
    if (!sourcePath) { setError('Выбери папку'); return }
    if (!sanitized) { setError('Введи название'); return }
    if (isDuplicate) { setError(`Сервер «${sanitized}» уже существует`); return }
    if (!/^[a-zA-Z0-9_\-а-яА-ЯёЁ]+$/.test(sanitized)) { setError('Только буквы, цифры, _ и -'); return }
    setImporting(true)
    const res = await window.api.importServer({ sourcePath, serverName: sanitized })
    if (!res.ok) { setError(res.error); setImporting(false); return }
    onImported(sanitized)
  }

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl w-[420px] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[14px] font-semibold text-[#ecedee]">Импорт сервера</p>
          <button onClick={onClose} className="text-[#33334a] hover:text-[#55556a]"><X size={15} /></button>
        </div>

        <form onSubmit={handleImport} className="flex flex-col gap-3">
          <div>
            <label className="block text-[11px] text-[#55556a] mb-1.5">Папка сервера</label>
            <button
              type="button"
              onClick={pickFolder}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-[#17171c] border border-[#2a2a35] hover:border-[#33333f] rounded-lg text-left transition-colors"
            >
              <FolderInput size={14} className="text-[#55556a] shrink-0" />
              <span className={`text-[12px] truncate ${sourcePath ? 'text-[#ecedee]' : 'text-[#33334a]'}`}>
                {sourcePath || 'Нажми чтобы выбрать…'}
              </span>
            </button>
          </div>

          <div>
            <label className="block text-[11px] text-[#55556a] mb-1.5">Название в ServerMate</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="Мой сервер"
              className={`w-full bg-[#17171c] border rounded-lg px-3 py-2.5 text-[13px] text-[#ecedee] outline-none transition-colors ${
                isDuplicate || error ? 'border-red-500/60' : 'border-[#2a2a35] focus:border-[#1bd96a]'
              }`}
              style={{ userSelect: 'text' }}
            />
            {!error && isDuplicate && <p className="text-[11px] text-red-400 mt-1">Сервер «{sanitized}» уже существует</p>}
            {!error && name.includes(' ') && !isDuplicate && (
              <p className="text-[11px] text-[#55556a] mt-1">Пробелы → дефисы: <span className="text-[#8b8b9e]">{sanitized}</span></p>
            )}
          </div>

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <p className="text-[11px] text-[#33334a]">Папка будет скопирована в хранилище ServerMate. Оригинал останется на месте.</p>

          <div className="flex gap-2 mt-1">
            <button
              type="submit"
              disabled={importing || !sourcePath || !sanitized || isDuplicate}
              className="flex-1 py-2 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[12px] font-semibold rounded-lg transition-colors"
            >
              {importing ? 'Импорт…' : 'Импортировать'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-[#26262f] hover:bg-[#2e2e3a] text-[#8b8b9e] text-[12px] rounded-lg transition-colors">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteModal({ server, isRunning, error, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl w-[380px] p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#ecedee]">Удалить сервер?</p>
            <p className="text-[12px] text-[#55556a] mt-1">
              «{server.name}» будет удалён вместе со всеми мирами, плагинами и настройками. Это действие необратимо.
            </p>
          </div>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-3">
            <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
            <p className="text-[11px] text-yellow-300">Сначала останови сервер</p>
          </div>
        )}
        {error && <p className="text-[11px] text-red-400 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={isRunning}
            className="flex-1 py-2 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 text-[12px] font-semibold rounded-lg transition-colors">
            Удалить навсегда
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 bg-[#26262f] hover:bg-[#2e2e3a] text-[#8b8b9e] text-[12px] rounded-lg transition-colors">
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

function RenameModal({ server, existingServers, isRunning, onRename, onClose }) {
  const [value, setValue] = useState(server.name)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.select() }, [])

  const sanitized = value.trim().replace(/\s+/g, '-')
  const isDuplicate = sanitized.toLowerCase() !== server.name.toLowerCase() &&
    existingServers.some(s => s.name.toLowerCase() === sanitized.toLowerCase())

  async function handleSubmit(e) {
    e?.preventDefault()
    const newName = sanitized
    if (!newName) { setError('Введи название'); return }
    if (newName === server.name) { onClose(); return }
    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) { setError('Только буквы, цифры, _ и -'); return }
    if (isDuplicate) { setError(`Сервер «${newName}» уже существует`); return }
    setSaving(true)
    const err = await onRename(server, newName)
    if (err) { setError(err); setSaving(false) }
    else onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl w-[360px] p-5">
        <p className="text-[14px] font-semibold text-[#ecedee] mb-4">Переименовать сервер</p>
        {isRunning && (
          <div className="flex items-center gap-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-3">
            <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
            <p className="text-[11px] text-yellow-300">Сначала останови сервер</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            disabled={isRunning || saving}
            className={`bg-[#17171c] border rounded-lg px-3 py-2.5 text-[13px] text-[#ecedee] outline-none transition-colors ${
              isDuplicate || error ? 'border-red-500/60' : 'border-[#2a2a35] focus:border-[#1bd96a]'
            }`}
            style={{ userSelect: 'text' }}
          />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          {!error && isDuplicate && <p className="text-[11px] text-red-400">Сервер «{sanitized}» уже существует</p>}
          {!error && !isDuplicate && value.includes(' ') && (
            <p className="text-[11px] text-[#55556a]">Пробелы → дефисы: <span className="text-[#8b8b9e]">{sanitized}</span></p>
          )}
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={isRunning || saving || !value.trim()}
              className="flex-1 py-2 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[12px] font-semibold rounded-lg transition-colors">
              {saving ? 'Сохранение…' : 'Переименовать'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-2 bg-[#26262f] hover:bg-[#2e2e3a] text-[#8b8b9e] text-[12px] rounded-lg transition-colors">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
