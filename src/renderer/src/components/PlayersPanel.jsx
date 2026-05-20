import React, { useState, useEffect, useRef } from 'react'
import { UserX, ShieldOff, Trash2, Plus, RefreshCw, Users, Shield, Ban, Wifi } from '../Icons'

const TABS = [
  { id: 'online',    label: 'Онлайн',          icon: Users },
  { id: 'whitelist', label: 'Вайтлист',         icon: Users },
  { id: 'ops',       label: 'Операторы',        icon: Shield },
  { id: 'banned',    label: 'Баны',             icon: Ban },
  { id: 'bannedIps', label: 'Забаненные IP',    icon: Wifi },
]

export default function PlayersPanel({ server, isRunning, onlinePlayers = [] }) {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('whitelist')
  const [addName, setAddName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const inputRef = useRef(null)

  async function load() {
    const d = await window.api.getPlayers(server.name)
    setData(d)
  }

  useEffect(() => { load() }, [server.name])

  const noData = data === null
  const currentList = data ? (data[tab] ?? []) : []
  const notGenerated = data && data[tab] === null

  async function handleAdd() {
    const name = addName.trim()
    if (!name) return
    if (!/^\w{2,16}$/.test(name)) { setAddError('Никнейм: 2–16 символов, только буквы/цифры/_'); return }
    setAdding(true)
    setAddError('')
    try {
      if (tab === 'whitelist') {
        if (isRunning) await window.api.sendCommand(`whitelist add ${name}`)
        const res = await window.api.addWhitelist(server.name, name)
        if (res && !res.ok) setAddError(res.error || 'Ошибка')
      } else if (tab === 'ops') {
        if (isRunning) {
          await window.api.sendCommand(`op ${name}`)
        } else {
          setAddError('Сервер должен быть запущен для выдачи OP')
          setAdding(false)
          return
        }
      } else if (tab === 'banned') {
        if (isRunning) {
          await window.api.sendCommand(`ban ${name}`)
        } else {
          setAddError('Сервер должен быть запущен для бана')
          setAdding(false)
          return
        }
      }
    } catch (e) {
      setAddError(e.message)
    }
    setAddName('')
    setAdding(false)
    setTimeout(load, 800)
  }

  async function handleRemove(item) {
    if (tab === 'whitelist') {
      if (isRunning) await window.api.sendCommand(`whitelist remove ${item.name}`)
      await window.api.removeWhitelist(server.name, item.name)
    } else if (tab === 'ops') {
      if (isRunning) await window.api.sendCommand(`deop ${item.name}`)
      await window.api.removeOp(server.name, item.name)
    } else if (tab === 'banned') {
      if (isRunning) await window.api.sendCommand(`pardon ${item.name}`)
      await window.api.removeBan(server.name, item.name)
    } else if (tab === 'bannedIps') {
      if (isRunning) await window.api.sendCommand(`pardon-ip ${item.ip}`)
      await window.api.removeBannedIp(server.name, item.ip)
    }
    await load()
  }

  const canAdd = tab !== 'online' && (tab === 'whitelist' || tab === 'ops' || tab === 'banned')
  const addPlaceholder = tab === 'ops' ? 'Никнейм для /op…' : tab === 'banned' ? 'Никнейм для /ban…' : 'Никнейм игрока…'
  const addLabel = tab === 'ops' ? 'Выдать OP' : tab === 'banned' ? 'Забанить' : 'Добавить'

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-5 py-2.5 border-b border-[#2a2a35] bg-[#111116] shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = id === 'online' ? onlinePlayers.length : data?.[id]?.length
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => { setTab(id); setAddName(''); setAddError('') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                active ? 'bg-[#1bd96a18] text-[#1bd96a]' : 'text-[#55556a] hover:text-[#8b8b9e] hover:bg-[#1e1e26]'
              }`}
            >
              <Icon size={12} />
              {label}
              {count !== undefined && count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-[#1bd96a25] text-[#1bd96a]' : 'bg-[#26262f] text-[#55556a]'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
        <button onClick={load} className="ml-auto text-[#33334a] hover:text-[#55556a] transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'online' ? (
          <div className="max-w-lg flex flex-col gap-3">
            {!isRunning ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Users size={32} className="text-[#2a2a35]" />
                <p className="text-[13px] text-[#55556a]">Сервер не запущен</p>
                <p className="text-[11px] text-[#33334a]">Игроки онлайн появятся здесь после запуска</p>
              </div>
            ) : onlinePlayers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Users size={32} className="text-[#2a2a35]" />
                <p className="text-[13px] text-[#55556a]">Нет игроков онлайн</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {onlinePlayers.map(name => (
                  <div key={name} className="group flex items-center gap-3 px-3 py-2.5 bg-[#1e1e26] border border-[#1bd96a20] rounded-xl">
                    <PlayerAvatar name={name} uuid={null} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#ecedee]">{name}</p>
                      <p className="text-[10px] text-[#1bd96a]">онлайн</p>
                    </div>
                    <button
                      onClick={() => window.api.sendCommand(`kick ${name}`)}
                      className="opacity-0 group-hover:opacity-100 px-2.5 py-1 text-[11px] text-[#55556a] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      Кик
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : notGenerated ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-[13px] text-[#55556a]">Файл ещё не создан</p>
            <p className="text-[11px] text-[#33334a]">Запусти сервер хотя бы один раз</p>
          </div>
        ) : (
          <div className="max-w-lg flex flex-col gap-3">
            {/* Add player (whitelist only) */}
            {canAdd && (
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={addName}
                  onChange={(e) => { setAddName(e.target.value); setAddError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder={addPlaceholder}
                  className="flex-1 bg-[#1e1e26] border border-[#2a2a35] focus:border-[#1bd96a] rounded-lg px-3 py-2 text-[12px] text-[#ecedee] placeholder-[#33334a] outline-none transition-colors"
                  style={{ userSelect: 'text' }}
                />
                <button
                  onClick={handleAdd}
                  disabled={!addName.trim() || adding}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[12px] font-semibold rounded-lg transition-colors"
                >
                  <Plus size={13} />
                  {addLabel}
                </button>
              </div>
            )}
            {addError && <p className="text-[11px] text-red-400">{addError}</p>}

            {tab === 'whitelist' && !data?.['whitelist']?.length && (
              <div className="py-2">
                <div className="flex items-start gap-2 p-3 bg-[#1e1e26] border border-[#2a2a35] rounded-lg">
                  <p className="text-[11px] text-[#55556a]">
                    Белый список пуст. Включи его в Настройках (white-list = true), затем добавляй игроков.
                    {isRunning && ' Изменения применяются сразу через /whitelist reload.'}
                  </p>
                </div>
              </div>
            )}

            {/* Player list */}
            {currentList.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {currentList.map((item, i) => (
                  <PlayerRow
                    key={item.uuid || item.name || item.ip || i}
                    item={item}
                    tab={tab}
                    onRemove={() => handleRemove(item)}
                  />
                ))}
              </div>
            )}

            {/* Ops info */}
            {tab === 'ops' && currentList.length === 0 && (
              <p className="text-[11px] text-[#55556a] py-4 text-center">
                Нет операторов. Добавь через консоль: /op НикнейМ
              </p>
            )}

            {/* Bans info */}
            {(tab === 'banned' || tab === 'bannedIps') && currentList.length === 0 && (
              <p className="text-[11px] text-[#55556a] py-4 text-center">
                Список пуст
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PlayerRow({ item, tab, onRemove }) {
  const [confirm, setConfirm] = useState(false)

  const displayName = item.name || item.ip || '?'
  const sub = tab === 'ops' ? `Уровень ${item.level ?? '?'}` : item.created ? `С ${new Date(item.created).toLocaleDateString('ru')}` : null
  const reason = item.reason && item.reason !== '' ? item.reason : null

  function RemoveIcon() {
    if (tab === 'whitelist') return <UserX size={13} />
    if (tab === 'ops') return <ShieldOff size={13} />
    return <Trash2 size={13} />
  }

  function removeLabel() {
    if (tab === 'whitelist') return 'Убрать'
    if (tab === 'ops') return 'Снять OP'
    return 'Помиловать'
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#1e1e26] border border-[#2a2a35] rounded-xl hover:border-[#33333f] transition-colors group">
      <PlayerAvatar name={displayName} uuid={item.uuid} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#ecedee]">{displayName}</p>
        {sub && <p className="text-[10px] text-[#55556a]">{sub}</p>}
        {reason && <p className="text-[10px] text-[#55556a]">Причина: {reason}</p>}
      </div>
      {confirm ? (
        <div className="flex items-center gap-1.5">
          <button onClick={() => { onRemove(); setConfirm(false) }} className="px-2 py-1 text-[11px] bg-red-500/15 text-red-400 hover:bg-red-500/25 rounded-lg transition-colors">
            Да
          </button>
          <button onClick={() => setConfirm(false)} className="px-2 py-1 text-[11px] text-[#55556a] hover:text-[#8b8b9e] transition-colors">
            Нет
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-[11px] text-[#55556a] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
        >
          <RemoveIcon />
          {removeLabel()}
        </button>
      )}
    </div>
  )
}

function PlayerAvatar({ name, uuid }) {
  const [error, setError] = useState(false)

  const src = name && name.length >= 2 && /^\w+$/.test(name)
    ? `https://mc-heads.net/head/${name}/32`
    : null

  if (!src || error) {
    const colors = ['#1bd96a', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    const color = colors[(name.charCodeAt(0) ?? 0) % colors.length]
    return (
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-bold text-black" style={{ background: color }}>
        {name[0]?.toUpperCase() ?? '?'}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setError(true)}
      className="w-8 h-8 rounded-lg shrink-0"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
