import React, { useState, useEffect } from 'react'
import { Archive, FolderOpen, Trash2, RefreshCw, HardDrive, Clock } from '../Icons'
import { useLang } from '../LangContext'

function fmtSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const AUTO_INTERVALS = [
  { value: 0,    key: 'auto_backup_off' },
  { value: 60,   key: 'auto_backup_1h'  },
  { value: 360,  key: 'auto_backup_6h'  },
  { value: 720,  key: 'auto_backup_12h' },
  { value: 1440, key: 'auto_backup_24h' },
]

export default function BackupsPanel({ server, isRunning }) {
  const { t } = useLang()
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [backing, setBacking] = useState(false)
  const [backupDone, setBackupDone] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [autoInterval, setAutoInterval] = useState(0)
  const [lastAutoAt, setLastAutoAt] = useState(null)

  async function load() {
    setLoading(true)
    const [list, auto] = await Promise.all([
      window.api.listBackups(server.name),
      window.api.getAutoBackup(server.name),
    ])
    setBackups(list)
    setAutoInterval(auto.interval || 0)
    setLastAutoAt(auto.lastAt || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [server.name])

  // Listen for auto-backup completion
  useEffect(() => {
    const unsub = window.api.onAutoBackupDone(({ serverName }) => {
      if (serverName === server.name) load()
    })
    return unsub
  }, [server.name])

  async function handleSetInterval(val) {
    setAutoInterval(val)
    await window.api.setAutoBackup(server.name, val)
  }

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
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[14px] font-semibold text-[#ecedee]">{t('backups_title')}</h2>
            <p className="text-[11px] text-[#55556a] mt-0.5">
              {backups.length > 0
                ? t(backups.length === 1 ? 'backups_count' : 'backups_count_many', { n: backups.length, size: fmtSize(totalSize) })
                : t('no_backups_created')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.api.openBackupsFolder(server.name)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] text-[11px] text-[#8b8b9e] rounded-lg transition-all"
            >
              <FolderOpen size={12} /> {t('folder_btn')}
            </button>
            <button
              onClick={handleBackup}
              disabled={backing || isRunning}
              title={isRunning ? t('backup_stop_hint') : ''}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[12px] font-semibold rounded-lg transition-colors"
            >
              {backing ? <RefreshCw size={12} className="animate-spin" /> : <Archive size={12} />}
              {backing ? t('creating_backup') : backupDone ? t('done') : t('create_backup_btn')}
            </button>
          </div>
        </div>

        {/* Auto-backup schedule */}
        <div className="mb-5 p-3.5 bg-[#1e1e26] border border-[#2a2a35] rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-[#55556a] shrink-0" />
            <div className="flex-1">
              <p className="text-[12px] font-medium text-[#ecedee]">{t('auto_backup_label')}</p>
              <p className="text-[10px] text-[#33334a] mt-0.5">{t('auto_backup_desc')}</p>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {AUTO_INTERVALS.map(({ value, key }) => (
              <button
                key={value}
                onClick={() => handleSetInterval(value)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  autoInterval === value
                    ? 'bg-[#1bd96a20] text-[#1bd96a] border border-[#1bd96a40]'
                    : 'bg-[#17171c] text-[#55556a] border border-[#2a2a35] hover:border-[#33333f] hover:text-[#8b8b9e]'
                }`}
              >
                {t(key)}
              </button>
            ))}
          </div>
          {autoInterval > 0 && (
            <p className="text-[10px] text-[#33334a] flex items-center gap-1">
              <span>{t('last_auto_backup')}</span>
              <span className="text-[#55556a]">
                {lastAutoAt ? fmtDate(lastAutoAt) : t('auto_backup_never')}
              </span>
            </p>
          )}
          {autoInterval > 0 && isRunning && (
            <p className="text-[10px] text-yellow-500/70">{t('auto_backup_running_note')}</p>
          )}
        </div>

        {isRunning && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-[11px] text-yellow-300">{t('stop_before_backup_hint')}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-[#55556a] py-4">
            <RefreshCw size={13} className="animate-spin" /> {t('loading')}
          </div>
        )}

        {!loading && backups.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#1e1e26] border border-[#2a2a35] flex items-center justify-center">
              <Archive size={20} className="text-[#2a2a35]" />
            </div>
            <p className="text-[12px] text-[#55556a]">{t('no_backups_yet')}</p>
            <p className="text-[11px] text-[#33334a]">{t('click_to_create_backup')}</p>
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
                  <span className="text-[11px] text-[#8b8b9e]">{t('delete_q')}</span>
                  <button
                    onClick={async () => {
                      await window.api.deleteBackup(server.name, backup.filename)
                      setDeleteTarget(null)
                      load()
                    }}
                    className="px-2 py-1 text-[11px] text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg"
                  >{t('yes')}</button>
                  <button onClick={() => setDeleteTarget(null)} className="px-2 py-1 text-[11px] text-[#55556a] rounded-lg">{t('no')}</button>
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
