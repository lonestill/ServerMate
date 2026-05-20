import React, { useState, useEffect, useRef } from 'react'
import { Plus, Server, FolderOpen, Pencil, Trash2, FolderInput, Power, Settings } from '../Icons'

const CORE_COLORS = {
  paper:   { bg: '#3b82f615', text: '#60a5fa', label: 'Paper' },
  fabric:  { bg: '#f59e0b15', text: '#fbbf24', label: 'Fabric' },
  vanilla: { bg: '#8b5cf615', text: '#a78bfa', label: 'Vanilla' },
}

export default function LeftPanel({ servers, selected, runningServer, onSelect, onCreateServer, onImportServer, onDeleteServer, onRenameServer, onOpenSettings }) {
  const [ctx, setCtx] = useState(null) // { x, y, server }
  const ctxRef = useRef(null)

  useEffect(() => {
    if (!ctx) return
    function handle(e) {
      if (!ctxRef.current?.contains(e.target)) setCtx(null)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [ctx])

  function handleContextMenu(e, server) {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY, server })
  }

  function ctxAction(fn) {
    setCtx(null)
    fn()
  }

  return (
    <div className="flex flex-col w-56 shrink-0 border-r border-[#2a2a35] bg-[#111116]">
      {/* Brand */}
      <div className="h-12 flex items-center px-4 border-b border-[#2a2a35] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#1bd96a] flex items-center justify-center shadow-[0_0_8px_#1bd96a60]">
            <Server size={13} strokeWidth={2.5} className="text-black" />
          </div>
          <span className="text-[13px] font-semibold text-[#ecedee]">ServerMate</span>
        </div>
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <span className="text-[10px] font-semibold text-[#33334a] uppercase tracking-widest">Серверы</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onImportServer}
            className="w-5 h-5 flex items-center justify-center rounded-md text-[#55556a] hover:text-[#8b8b9e] hover:bg-[#1e1e26] transition-all"
            title="Импортировать сервер"
          >
            <FolderInput size={12} strokeWidth={2} />
          </button>
          <button
            onClick={onCreateServer}
            className="w-5 h-5 flex items-center justify-center rounded-md text-[#55556a] hover:text-[#1bd96a] hover:bg-[#1bd96a15] transition-all"
            title="Новый сервер"
          >
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Server list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {servers.length === 0 && (
          <button
            onClick={onCreateServer}
            className="w-full flex flex-col items-center gap-2 py-8 text-center rounded-lg border border-dashed border-[#2a2a35] hover:border-[#1bd96a40] hover:bg-[#1bd96a05] transition-all group"
          >
            <Plus size={18} className="text-[#2a2a35] group-hover:text-[#1bd96a40]" />
            <span className="text-[11px] text-[#2a2a35] group-hover:text-[#33334a]">Создать сервер</span>
          </button>
        )}
        {servers.map((s) => {
          const isRunning = runningServer === s.name
          const isSelected = selected?.name === s.name
          const coreStyle = CORE_COLORS[s.core]

          return (
            <button
              key={s.name}
              onClick={() => onSelect(s)}
              onContextMenu={(e) => handleContextMenu(e, s)}
              className={`w-full flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-all mb-0.5 group ${
                isSelected
                  ? 'bg-[#1e1e26] text-[#ecedee]'
                  : 'text-[#8b8b9e] hover:text-[#ecedee] hover:bg-[#18181f]'
              }`}
            >
              {/* Status dot */}
              <div className="pt-0.5 shrink-0">
                <div
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${isRunning ? 'bg-[#1bd96a] shadow-[0_0_4px_#1bd96a]' : 'bg-[#2e2e3a]'}`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate leading-tight">{s.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {coreStyle && (
                    <span className="text-[9px] font-semibold px-1 py-0.5 rounded" style={{ background: coreStyle.bg, color: coreStyle.text }}>
                      {coreStyle.label}
                    </span>
                  )}
                  {s.mcVersion && (
                    <span className="text-[9px] text-[#33334a]">{s.mcVersion}</span>
                  )}
                  {!s.hasJar && (
                    <span className="text-[9px] text-[#55556a]">нет jar</span>
                  )}
                  {s.autostart && !isRunning && (
                    <Power size={8} className="text-[#33334a]" title="Автозапуск" />
                  )}
                  {isRunning && (
                    <span className="text-[9px] text-[#1bd96a] font-semibold">онлайн</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Bottom settings button */}
      <div className="border-t border-[#2a2a35] p-2 shrink-0">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-[#33334a] hover:text-[#55556a] hover:bg-[#1e1e26] transition-all"
        >
          <Settings size={13} />
          Настройки приложения
        </button>
      </div>

      {/* Context menu */}
      {ctx && (
        <div
          ref={ctxRef}
          style={{ position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 1000 }}
          className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl py-1 min-w-[160px]"
        >
          <CtxItem icon={FolderOpen} label="Открыть папку" onClick={() => ctxAction(() => window.api.openServerFolder(ctx.server.name))} />
          <CtxItem icon={Pencil} label="Переименовать" onClick={() => ctxAction(() => onRenameServer(ctx.server))} />
          <div className="my-1 h-px bg-[#2a2a35]" />
          <CtxItem icon={Trash2} label="Удалить" danger onClick={() => ctxAction(() => onDeleteServer(ctx.server))} />
        </div>
      )}
    </div>
  )
}

function CtxItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors ${
        danger ? 'text-red-400 hover:bg-red-500/10' : 'text-[#c8c8d8] hover:bg-[#26262f]'
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}
