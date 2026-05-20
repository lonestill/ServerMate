import React from 'react'
import { Plus } from '../Icons'

export default function Sidebar({ onCreateServer }) {
  return (
    <div className="flex flex-col w-[220px] shrink-0 bg-[#111] border-r border-[#1f1f1f]">
      {/* App title */}
      <div className="px-4 pt-5 pb-3">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-[#555] uppercase">
          ServerMate
        </span>
      </div>

      {/* Section label */}
      <div className="px-4 pb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-[0.1em] text-[#444] uppercase">
          Серверы
        </span>
        <button
          onClick={onCreateServer}
          className="w-4 h-4 flex items-center justify-center text-[#444] hover:text-[#888] transition-colors"
          title="Новый сервер"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Server list injected as children */}
      <div className="flex-1 overflow-y-auto" id="server-list-slot" />
    </div>
  )
}
