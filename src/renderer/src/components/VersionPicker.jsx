import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { Search, Check, ChevronDown } from '../Icons'

export default function VersionPicker({ versions, value, onChange, placeholder = 'Выбери версию' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState({})
  const triggerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const filtered = query.trim()
    ? versions.filter(v => v.id.toLowerCase().includes(query.trim().toLowerCase()))
    : versions

  function openDropdown() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    // Position below trigger, flip up if not enough space
    const spaceBelow = window.innerHeight - rect.bottom
    const dropHeight = Math.min(220, filtered.length * 32 + 52)
    const goUp = spaceBelow < dropHeight && rect.top > dropHeight
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(goUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      zIndex: 9999,
    })
    setOpen(true)
  }

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (!triggerRef.current?.contains(e.target) && !document.getElementById('version-picker-portal')?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Scroll selected into view
  useEffect(() => {
    if (!open || !value) return
    setTimeout(() => {
      const el = listRef.current?.querySelector('[data-selected="true"]')
      el?.scrollIntoView({ block: 'nearest' })
    }, 50)
  }, [open])

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return
    function reposition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setDropdownStyle(s => ({ ...s, left: rect.left, width: rect.width, top: rect.bottom + 4 }))
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  function select(id) {
    onChange(id)
    setOpen(false)
  }

  const selected = versions.find(v => v.id === value)

  const dropdown = open ? ReactDOM.createPortal(
    <div
      id="version-picker-portal"
      style={dropdownStyle}
      className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#2a2a35]">
        <Search size={13} className="text-[#55556a] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск версии…"
          className="flex-1 bg-transparent text-[12px] text-[#ecedee] placeholder-[#33334a] outline-none"
          style={{ userSelect: 'text' }}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && filtered.length > 0) select(filtered[0].id)
          }}
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[#33334a] hover:text-[#55556a] text-[11px] transition-colors">✕</button>
        )}
      </div>

      {/* List */}
      <div ref={listRef} className="max-h-52 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-[11px] text-[#33334a]">Ничего не найдено</p>
        )}
        {filtered.map(v => {
          const isSelected = v.id === value
          const isPreRelease = v.type === 'snapshot' || /-(rc|pre|alpha|beta)\d*/i.test(v.id)
          return (
            <button
              key={v.id}
              data-selected={isSelected}
              onClick={() => select(v.id)}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                isSelected
                  ? 'bg-[#1bd96a12] text-[#1bd96a]'
                  : isPreRelease
                  ? 'text-[#55556a] hover:bg-[#26262f] hover:text-[#8b8b9e]'
                  : 'text-[#c8c8d8] hover:bg-[#26262f]'
              }`}
            >
              <span className="text-[12px]">{v.id}</span>
              <div className="flex items-center gap-2">
                {isPreRelease && !isSelected && (
                  <span className="text-[10px] text-[#2e2e3a]">pre</span>
                )}
                {isSelected && <Check size={11} strokeWidth={3} className="text-[#1bd96a]" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={open ? () => setOpen(false) : openDropdown}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[13px] transition-all text-left ${
          open
            ? 'border-[#1bd96a] bg-[#17171c]'
            : 'border-[#2a2a35] bg-[#17171c] hover:border-[#33333f]'
        }`}
      >
        <span className={selected ? 'text-[#ecedee]' : 'text-[#33334a]'}>
          {selected ? selected.id : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-[#55556a] transition-transform shrink-0 ml-2 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {dropdown}
    </div>
  )
}
