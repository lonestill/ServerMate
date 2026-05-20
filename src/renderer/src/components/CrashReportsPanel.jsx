import React, { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, ChevronRight, X, Clock } from '../Icons'
import { useLang } from '../LangContext'

function parseCrashSummary(content) {
  if (!content) return null
  const descMatch = content.match(/Description:\s*(.+)/i)
  const exceptionMatch = content.match(/^([A-Za-z.]+Exception[^\n]*)/m)
  return {
    description: descMatch?.[1]?.trim() ?? null,
    exception: exceptionMatch?.[1]?.trim().split('\n')[0] ?? null,
  }
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function CrashReportsPanel({ server }) {
  const { t } = useLang()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [loadingReport, setLoadingReport] = useState(false)

  async function load() {
    setLoading(true)
    const rs = await window.api.listCrashReports(server.name)
    setReports(rs)
    setLoading(false)
  }

  useEffect(() => { load() }, [server.name])

  async function openReport(r) {
    setLoadingReport(true)
    const res = await window.api.readCrashReport(server.name, r.filename)
    setLoadingReport(false)
    if (res.ok) setSelected({ filename: r.filename, content: res.content })
  }

  if (selected) {
    const summary = parseCrashSummary(selected.content)
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a35] bg-[#111116] shrink-0">
          <AlertTriangle size={13} className="text-red-400 shrink-0" />
          <span className="text-[12px] font-medium text-[#ecedee] truncate flex-1">{selected.filename}</span>
          <button onClick={() => setSelected(null)} className="text-[#33334a] hover:text-[#55556a] transition-colors">
            <X size={14} />
          </button>
        </div>
        {summary?.description && (
          <div className="shrink-0 mx-4 mt-3 p-3 bg-red-500/8 border border-red-500/20 rounded-xl">
            <p className="text-[11px] font-semibold text-red-400 mb-0.5">{t('crash_description')}</p>
            <p className="text-[12px] text-red-200">{summary.description}</p>
            {summary.exception && <p className="text-[11px] text-[#55556a] mt-1 font-mono">{summary.exception}</p>}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <pre className="text-[11px] text-[#8b8b9e] font-mono whitespace-pre-wrap break-all leading-relaxed">{selected.content}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 max-w-lg flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[#ecedee]">{t('crashes_title')}</h2>
          <button onClick={load} className="text-[#33334a] hover:text-[#55556a] transition-colors p-1">
            <RefreshCw size={13} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[12px] text-[#55556a]">
            <div className="w-4 h-4 rounded-full border border-[#55556a] border-t-transparent animate-spin" />
            {t('loading')}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <AlertTriangle size={32} className="text-[#2a2a35]" />
            <p className="text-[13px] text-[#55556a]">{t('no_crashes')}</p>
            <p className="text-[11px] text-[#33334a]">{t('crashes_appear_if')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map(r => (
              <button
                key={r.filename}
                onClick={() => openReport(r)}
                className="flex items-center gap-3 p-3.5 bg-[#1e1e26] border border-[#2a2a35] hover:border-red-500/30 rounded-xl text-left transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle size={14} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#ecedee] truncate">{r.filename}</p>
                  <p className="text-[10px] text-[#33334a] mt-0.5 flex items-center gap-1">
                    <Clock size={9} />
                    {formatDate(r.createdAt)}
                  </p>
                </div>
                <ChevronRight size={13} className="text-[#33334a] group-hover:text-[#55556a] shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
