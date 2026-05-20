import React from 'react'
import { Server } from '../Icons'

export default function ServerList({ servers, selected, runningServer, onSelect }) {
  return (
    <div className="w-56 flex flex-col bg-[#0d0d1f] border-r border-slate-800 overflow-y-auto">
      <div className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Серверы
      </div>

      {servers.length === 0 && (
        <div className="px-3 py-2 text-xs text-slate-600">Нет серверов</div>
      )}

      {servers.map((s) => {
        const isRunning = runningServer === s.name
        const isSelected = selected?.name === s.name
        return (
          <button
            key={s.name}
            onClick={() => onSelect(s)}
            className={`flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
              isSelected
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Server size={14} />
              {isRunning && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400" />
              )}
            </div>
            <span className="truncate">{s.name}</span>
            {!s.hasJar && (
              <span className="ml-auto text-xs text-yellow-600">!</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
