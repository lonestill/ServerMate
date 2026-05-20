import React, { useState, useEffect } from 'react'
import { Archive, FolderOpen, Trash2, RefreshCw, HardDrive } from '../Icons'

function fmtSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function BackupsPanel({ server, isRunning }) {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [backing, setBacking] = useState(false)
  const [backupDone, setBackupDone] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function load() {
    setLoading(true)
    const list = await window.api.listBackups(server.name)
    setBackups(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [server.name])

  async function handleBackup() {
    setBacking(true)
    setError('')
    setBackupDone(false)
    const res = await window.api.backupWorld(server.name)
    setBacking(false)
    if (res.ok) {
      setBackupDone(true)
      setTimeout(() => setBackupDone(false), 3000)
      load()
    } else {
      setError(res.error)
    }
  }

  const totalSize = backups.reduce((s, b) => s + (b.size || 0), 0)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[14px] font-semibold text-[#ecedee]">Бэкапы мира</h2>
            <p className="text-[11px] text-[#55556a] mt-0.5">
              {backups.length > 0 ? `${backups.length} бэкап${backups.length === 1 ? '' : 'а'} · ${fmtSize(totalSize)}` : 'Бэкапы не созданы'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.api.openBackupsFolder(server.name)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] text-[11px] text-[#8b8b9e] rounded-lg transition-all"
            >
              <FolderOpen size={12} /> Папка
            </button>
            <button
              onClick={handleBackup}
              disabled={backing || isRunning}
              title={isRunning ? 'Останови сервер перед бэкапом' : ''}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[12px] font-semibold rounded-lg transition-colors"
            >
              {backing ? <RefreshCw size={12} className="animate-spin" /> : <Archive size={12} />}
              {backing ? 'Создание…' : backupDone ? 'Готово!' : 'Создать бэкап'}
            </button>
          </div>
        </div>

        {isRunning && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-[11px] text-yellow-300">Останови сервер перед созданием бэкапа, чтобы не повредить мир</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-[#55556a] py-4">
            <RefreshCw size={13} className="animate-spin" /> Загрузка…
          </div>
        )}

        {!loading && backups.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#1e1e26] border border-[#2a2a35] flex items-center justify-center">
              <Archive size={20} className="text-[#2a2a35]" />
            </div>
            <p className="text-[12px] text-[#55556a]">Бэкапов пока нет</p>
            <p className="text-[11px] text-[#33334a]">Нажми «Создать бэкап» чтобы сохранить мир</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {backups.map(backup => (
            <div
              key={backup.filename}
              className="flex items-center gap-3 p-3 bg-[#1e1e26] border border-[#2a2a35] rounded-xl"
            >
              <Archive size={16} className="text-[#55556a] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#ecedee] truncate">{backup.filename}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-[#55556a]">{fmtDate(backup.createdAt)}</span>
                  <span className="flex items-center gap-0.5 text-[10px] text-[#33334a]">
                    <HardDrive size={9} /> {fmtSize(backup.size)}
                  </span>
                </div>
              </div>

              {deleteTarget === backup.filename ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-[#8b8b9e]">Удалить?</span>
                  <button
                    onClick={async () => {
                      await window.api.deleteBackup(server.name, backup.filename)
                      setDeleteTarget(null)
                      load()
                    }}
                    className="px-2 py-1 text-[11px] text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg"
                  >Да</button>
                  <button onClick={() => setDeleteTarget(null)} className="px-2 py-1 text-[11px] text-[#55556a] rounded-lg">Нет</button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteTarget(backup.filename)}
                  className="p-1.5 text-[#33334a] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
