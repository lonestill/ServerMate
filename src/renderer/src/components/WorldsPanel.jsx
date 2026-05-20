import React, { useState, useEffect } from 'react'
import { Globe, Trash2, AlertTriangle, RefreshCw } from '../Icons'
import { useLang } from '../LangContext'

function fmt(bytes) {
  if (bytes > 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes > 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return Math.round(bytes / 1e3) + ' KB'
}

export default function WorldsPanel({ server, isRunning }) {
  const { t } = useLang()
  const [worlds, setWorlds] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [levelName, setLevelName] = useState('world')

  async function load() {
    setLoading(true)
    const [ws, props] = await Promise.all([
      window.api.listWorlds(server.name),
      window.api.readProps(server.name),
    ])
    setWorlds(ws)
    if (props?.['level-name']) setLevelName(props['level-name'])
    setLoading(false)
  }

  useEffect(() => { load() }, [server.name])

  async function handleDelete(worldName) {
    setError('')
    const res = await window.api.deleteWorld(server.name, worldName)
    if (res.ok) {
      setDeleting(null)
      await load()
    } else {
      setError(res.error)
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 max-w-lg flex flex-col gap-4">

        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[#ecedee]">{t('worlds_title')}</h2>
          <button onClick={load} className="text-[#33334a] hover:text-[#55556a] transition-colors p-1">
            <RefreshCw size={13} />
          </button>
        </div>

        {isRunning && (
          <div className="flex items-start gap-2 p-3 bg-[#f59e0b0d] border border-[#f59e0b25] rounded-xl">
            <AlertTriangle size={13} className="text-[#f59e0b] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[#f59e0b]">{t('stop_before_delete_world')}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-[12px] text-[#55556a]">
            <div className="w-4 h-4 rounded-full border border-[#55556a] border-t-transparent animate-spin" />
            {t('loading')}
          </div>
        ) : worlds.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <Globe size={32} className="text-[#2a2a35]" />
            <p className="text-[13px] text-[#55556a]">{t('no_worlds')}</p>
            <p className="text-[11px] text-[#33334a]">{t('run_server_once')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {worlds.map(w => {
              const isActive = w.name === levelName
              const isConfirming = deleting === w.name
              return (
                <div
                  key={w.name}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                    isActive ? 'border-[#1bd96a30] bg-[#1bd96a08]' : 'border-[#2a2a35] bg-[#1e1e26]'
                  }`}
                >
                  <Globe size={20} className={isActive ? 'text-[#1bd96a]' : 'text-[#33334a]'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-[#ecedee]">{w.name}</p>
                      {isActive && (
                        <span className="text-[9px] font-semibold text-[#1bd96a] bg-[#1bd96a15] px-1.5 py-0.5 rounded">{t('active_badge')}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#33334a] mt-0.5">{fmt(w.size)}</p>
                  </div>

                  {!isConfirming ? (
                    <button
                      onClick={() => setDeleting(w.name)}
                      disabled={isRunning}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#55556a] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={12} />
                      {t('delete_world')}
                    </button>
                  ) : (
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[11px] text-[#55556a]">{t('are_you_sure')}</span>
                      <button
                        onClick={() => handleDelete(w.name)}
                        className="px-2.5 py-1 text-[11px] bg-red-500/15 text-red-400 hover:bg-red-500/25 rounded-lg transition-colors"
                      >
                        {t('yes_delete')}
                      </button>
                      <button
                        onClick={() => setDeleting(null)}
                        className="px-2.5 py-1 text-[11px] text-[#55556a] hover:text-[#8b8b9e] transition-colors"
                      >
                        {t('no')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <div className="p-3 bg-[#17171c] border border-[#2a2a35] rounded-xl">
          <p className="text-[11px] text-[#55556a] leading-relaxed">
            {t('worlds_info', { param: 'level-name' }).split('level-name')[0]}
            <span className="font-mono text-[#ecedee]">level-name</span>
            {t('worlds_info', { param: 'level-name' }).split('level-name')[1]}
          </p>
        </div>

      </div>
    </div>
  )
}
