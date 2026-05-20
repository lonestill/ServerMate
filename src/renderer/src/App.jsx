import React, { useState, useEffect, useRef } from 'react'
import { LangProvider, useLang } from './LangContext'
import LeftPanel from './components/LeftPanel'
import ServerPanel from './components/ServerPanel'
import CreateServerModal from './components/CreateServerModal'
import OnboardingTour, { TOUR_KEY } from './components/OnboardingTour'
import { Plus, AlertTriangle, Check, X, FolderInput } from './Icons'
import AppSettings from './components/AppSettings'

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  )
}

function AppInner() {
  const { lang, setLang, t } = useLang()
  const [servers, setServers] = useState([])
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [runningServer, setRunningServer] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [activeTab, setActiveTab] = useState('console')
  const autostartedRef = useRef(false)

  async function refreshServers() {
    const list = await window.api.listServers()
    setServers(list)
    return list
  }

  async function syncStatus() {
    const status = await window.api.getStatus()
    setRunningServer(status.running && status.name ? status.name : null)
  }

  useEffect(() => {
    refreshServers().then(async list => {
      await syncStatus()
      if (autostartedRef.current) return
      const status = await window.api.getStatus()
      if (status.running) { autostartedRef.current = true; return }
      const toStart = list.find(s => s.autostart && s.hasJar)
      if (toStart) {
        autostartedRef.current = true
        setSelected(toStart)
        window.api.startServer({ serverName: toStart.name }).then(res => {
          if (res.ok) setRunningServer(toStart.name)
        })
      }
    })

    window.addEventListener('focus', syncStatus)
    return () => window.removeEventListener('focus', syncStatus)
  }, [])

  useEffect(() => {
    if (!selected) return
    const updated = servers.find(s => s.name === selected.name)
    if (updated) setSelected(updated)
    else setSelected(servers[0] ?? null)
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

  async function handleReorderServers(order) {
    await window.api.saveServerOrder(order)
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

  // Show language picker on first launch
  if (lang === null) {
    return <LangPickerModal onSelect={(l) => { setLang(l); setShowTour(true) }} />
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
        onReorderServers={handleReorderServers}
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
            activeTab={activeTab}
            onTabChange={setActiveTab}
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

      {showSettings && <AppSettings onClose={() => setShowSettings(false)} onReplayTour={() => { setShowSettings(false); setShowTour(true) }} />}

      {showTour && (
        <OnboardingTour
          onDone={() => setShowTour(false)}
          onCreateServer={() => setShowCreate(true)}
          onSwitchTab={setActiveTab}
          wizardOpen={showCreate}
          serverCreated={servers.length > 0}
          activeTab={activeTab}
          hasServer={!!selected}
        />
      )}

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

function LangPickerModal({ onSelect }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#17171c' }}>
      <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl w-[320px] p-6 flex flex-col items-center gap-5">
        <div className="w-10 h-10 rounded-xl bg-[#1bd96a] flex items-center justify-center shadow-[0_0_16px_#1bd96a60]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-[#ecedee]">Choose language / Выберите язык</p>
          <p className="text-[11px] text-[#55556a] mt-1">You can change it later in settings / Можно изменить в настройках</p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={() => onSelect('en')}
            className="flex-1 py-2.5 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] hover:border-[#1bd96a40] text-[#ecedee] text-[13px] font-semibold rounded-xl transition-all"
          >
            English
          </button>
          <button
            onClick={() => onSelect('ru')}
            className="flex-1 py-2.5 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] hover:border-[#1bd96a40] text-[#ecedee] text-[13px] font-semibold rounded-xl transition-all"
          >
            Русский
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onCreateServer, onImportServer }) {
  const { t } = useLang()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-[#1e1e26] border border-[#2a2a35] flex items-center justify-center mb-2">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[#2a2a35]">
          <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[14px] font-medium text-[#55556a]">{t('no_server_selected')}</p>
        <p className="text-[12px] text-[#33334a] mt-1">{t('create_or_import_hint')}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCreateServer}
          className="flex items-center gap-2 px-4 py-2 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[12px] font-semibold rounded-lg transition-colors"
        >
          <Plus size={13} /> {t('create_server')}
        </button>
        <button
          onClick={onImportServer}
          className="flex items-center gap-2 px-4 py-2 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] text-[#8b8b9e] text-[12px] rounded-lg transition-colors"
        >
          <FolderInput size={13} /> {t('import')}
        </button>
      </div>
    </div>
  )
}

function ImportModal({ existingServers, onClose, onImported }) {
  const { t } = useLang()
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
    const folderName = path.split(/[\\/]/).pop()
    setName(folderName)
    setError('')
  }

  async function handleImport(e) {
    e.preventDefault()
    if (!sourcePath) { setError(t('select_folder')); return }
    if (!sanitized) { setError(t('enter_name')); return }
    if (isDuplicate) { setError(t('already_exists', { name: sanitized })); return }
    if (!/^[a-zA-Z0-9_\-а-яА-ЯёЁ]+$/.test(sanitized)) { setError(t('letters_nums_only')); return }
    setImporting(true)
    const res = await window.api.importServer({ sourcePath, serverName: sanitized })
    if (!res.ok) { setError(res.error); setImporting(false); return }
    onImported(sanitized)
  }

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl w-[420px] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[14px] font-semibold text-[#ecedee]">{t('import_server')}</p>
          <button onClick={onClose} className="text-[#33334a] hover:text-[#55556a]"><X size={15} /></button>
        </div>

        <form onSubmit={handleImport} className="flex flex-col gap-3">
          <div>
            <label className="block text-[11px] text-[#55556a] mb-1.5">{t('server_folder')}</label>
            <button
              type="button"
              onClick={pickFolder}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-[#17171c] border border-[#2a2a35] hover:border-[#33333f] rounded-lg text-left transition-colors"
            >
              <FolderInput size={14} className="text-[#55556a] shrink-0" />
              <span className={`text-[12px] truncate ${sourcePath ? 'text-[#ecedee]' : 'text-[#33334a]'}`}>
                {sourcePath || t('click_to_select')}
              </span>
            </button>
          </div>

          <div>
            <label className="block text-[11px] text-[#55556a] mb-1.5">{t('name_in_app')}</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="my-server"
              className={`w-full bg-[#17171c] border rounded-lg px-3 py-2.5 text-[13px] text-[#ecedee] outline-none transition-colors ${
                isDuplicate || error ? 'border-red-500/60' : 'border-[#2a2a35] focus:border-[#1bd96a]'
              }`}
              style={{ userSelect: 'text' }}
            />
            {!error && isDuplicate && <p className="text-[11px] text-red-400 mt-1">{t('already_exists', { name: sanitized })}</p>}
            {!error && name.includes(' ') && !isDuplicate && (
              <p className="text-[11px] text-[#55556a] mt-1">{t('spaces_to_dashes')} <span className="text-[#8b8b9e]">{sanitized}</span></p>
            )}
          </div>

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <p className="text-[11px] text-[#33334a]">{t('folder_copy_note')}</p>

          <div className="flex gap-2 mt-1">
            <button
              type="submit"
              disabled={importing || !sourcePath || !sanitized || isDuplicate}
              className="flex-1 py-2 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[12px] font-semibold rounded-lg transition-colors"
            >
              {importing ? t('importing') : t('import_btn')}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-[#26262f] hover:bg-[#2e2e3a] text-[#8b8b9e] text-[12px] rounded-lg transition-colors">
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteModal({ server, isRunning, error, onConfirm, onClose }) {
  const { t } = useLang()
  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl w-[380px] p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#ecedee]">{t('delete_server_title')}</p>
            <p className="text-[12px] text-[#55556a] mt-1">{t('delete_server_desc', { name: server.name })}</p>
          </div>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-3">
            <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
            <p className="text-[11px] text-yellow-300">{t('stop_server_first')}</p>
          </div>
        )}
        {error && <p className="text-[11px] text-red-400 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={isRunning}
            className="flex-1 py-2 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 text-[12px] font-semibold rounded-lg transition-colors">
            {t('delete_forever')}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 bg-[#26262f] hover:bg-[#2e2e3a] text-[#8b8b9e] text-[12px] rounded-lg transition-colors">
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RenameModal({ server, existingServers, isRunning, onRename, onClose }) {
  const { t } = useLang()
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
    if (!newName) { setError(t('enter_name')); return }
    if (newName === server.name) { onClose(); return }
    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) { setError(t('letters_nums_only')); return }
    if (isDuplicate) { setError(t('already_exists', { name: newName })); return }
    setSaving(true)
    const err = await onRename(server, newName)
    if (err) { setError(err); setSaving(false) }
    else onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl w-[360px] p-5">
        <p className="text-[14px] font-semibold text-[#ecedee] mb-4">{t('rename_server')}</p>
        {isRunning && (
          <div className="flex items-center gap-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-3">
            <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
            <p className="text-[11px] text-yellow-300">{t('stop_server_first')}</p>
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
          {!error && isDuplicate && <p className="text-[11px] text-red-400">{t('already_exists', { name: sanitized })}</p>}
          {!error && !isDuplicate && value.includes(' ') && (
            <p className="text-[11px] text-[#55556a]">{t('spaces_to_dashes')} <span className="text-[#8b8b9e]">{sanitized}</span></p>
          )}
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={isRunning || saving || !value.trim()}
              className="flex-1 py-2 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[12px] font-semibold rounded-lg transition-colors">
              {saving ? t('saving') : t('rename')}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-2 bg-[#26262f] hover:bg-[#2e2e3a] text-[#8b8b9e] text-[12px] rounded-lg transition-colors">
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
