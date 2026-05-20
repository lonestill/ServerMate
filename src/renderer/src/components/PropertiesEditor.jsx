import React, { useState, useEffect, useRef } from 'react'
import { Check } from '../Icons'

const SECTIONS = [
  {
    title: 'Основное',
    props: [
      { key: 'server-port', label: 'Порт', type: 'number', hint: 'По умолчанию 25565', min: 1, max: 65535, span: 1 },
      { key: 'max-players', label: 'Макс. игроков', type: 'number', min: 1, max: 1000, span: 1 },
      { key: 'motd', label: 'MOTD', type: 'text', hint: 'Описание сервера в лаунчере', span: 2 },
      { key: 'level-name', label: 'Имя мира', type: 'text', span: 1 },
      { key: 'level-seed', label: 'Сид мира', type: 'text', hint: 'Оставь пустым для случайного', span: 1 },
    ],
  },
  {
    title: 'Геймплей',
    props: [
      { key: 'gamemode', label: 'Режим игры', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'], span: 1 },
      { key: 'difficulty', label: 'Сложность', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], span: 1 },
      { key: 'view-distance', label: 'Дальность прорисовки', type: 'number', hint: 'Чанков (4–32)', min: 4, max: 32, span: 1 },
      { key: 'simulation-distance', label: 'Дальность симуляции', type: 'number', hint: 'Чанков (3–32)', min: 3, max: 32, span: 1 },
      { key: 'pvp', label: 'PvP', type: 'toggle', span: 1 },
      { key: 'allow-flight', label: 'Полёт', type: 'toggle', span: 1 },
      { key: 'spawn-monsters', label: 'Мобы', type: 'toggle', span: 1 },
      { key: 'spawn-animals', label: 'Животные', type: 'toggle', span: 1 },
      { key: 'spawn-npcs', label: 'Деревенские жители', type: 'toggle', span: 1 },
      { key: 'allow-nether', label: 'Нижний мир', type: 'toggle', span: 1 },
      { key: 'enable-command-block', label: 'Командные блоки', type: 'toggle', span: 1 },
      { key: 'force-gamemode', label: 'Принудительный режим', type: 'toggle', hint: 'Сбрасывает режим игрока при входе', span: 1 },
    ],
  },
  {
    title: 'Доступ',
    props: [
      { key: 'online-mode', label: 'Online mode', type: 'toggle', hint: 'Проверка лицензии Mojang. Выключи для пиратских клиентов', span: 2 },
      { key: 'white-list', label: 'Белый список', type: 'toggle', hint: 'Только игроки из вайтлиста', span: 1 },
      { key: 'enforce-whitelist', label: 'Кик при выкл. вайтлиста', type: 'toggle', span: 1 },
      { key: 'max-tick-time', label: 'Watchdog (мс)', type: 'number', hint: '-1 = выключить', min: -1, span: 1 },
      { key: 'network-compression-threshold', label: 'Сжатие пакетов', type: 'number', hint: '-1 = выключить', min: -1, span: 1 },
      { key: 'player-idle-timeout', label: 'AFK кик (мин)', type: 'number', hint: '0 = выключить', min: 0, span: 1 },
      { key: 'op-permission-level', label: 'Уровень оператора', type: 'select', options: ['1', '2', '3', '4'], span: 1 },
    ],
  },
]

const SELECT_LABELS = {
  survival: 'Выживание',
  creative: 'Творческий',
  adventure: 'Приключение',
  spectator: 'Наблюдатель',
  peaceful: 'Мирная',
  easy: 'Лёгкая',
  normal: 'Нормальная',
  hard: 'Сложная',
}

export default function PropertiesEditor({ server, isRunning }) {
  const [props, setProps] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const debounceRef = useRef(null)
  const propsRef = useRef(null)

  useEffect(() => {
    window.api.readProps(server.name).then(p => { setProps(p); propsRef.current = p })
  }, [server.name])

  function set(key, value) {
    const next = { ...propsRef.current, [key]: value }
    propsRef.current = next
    setProps(next)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      await window.api.writeProps(server.name, next)
      setSaving(false)
      setSavedAt(Date.now())
    }, 600)
  }

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  if (!props) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-[13px] text-[#55556a]">
            {server.hasJar
              ? 'Запусти сервер один раз — он создаст server.properties'
              : 'Сначала установи сервер на вкладке «Установка»'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-[#2a2a35] bg-[#111116] shrink-0 h-9">
        {saving && <span className="text-[11px] text-[#55556a]">Сохранение…</span>}
        {!saving && savedAt && <span className="flex items-center gap-1 text-[11px] text-[#1bd96a]"><Check size={10} strokeWidth={3}/>Сохранено</span>}
        {isRunning && <span className="text-[11px] text-[#55556a] ml-auto">Изменения вступят в силу после перезапуска</span>}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 max-w-2xl flex flex-col gap-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-[11px] font-semibold text-[#55556a] uppercase tracking-wider mb-3">{section.title}</p>
              <div className="grid grid-cols-2 gap-3">
                {section.props.map(({ key, label, type, options, hint, min, max, span }) => {
                  const value = props[key]
                  return (
                    <div
                      key={key}
                      className={`flex flex-col gap-1.5 p-3 bg-[#1e1e26] border border-[#2a2a35] rounded-xl ${span === 2 ? 'col-span-2' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-[#8b8b9e]">{label}</label>
                        {type === 'toggle' && (
                          <Toggle
                            checked={value === 'true' || value === true}
                            onChange={(v) => set(key, v ? 'true' : 'false')}
                          />
                        )}
                      </div>

                      {type === 'text' && (
                        <input
                          type="text"
                          value={value ?? ''}
                          onChange={(e) => set(key, e.target.value)}
                          className="bg-[#17171c] border border-[#2a2a35] focus:border-[#1bd96a] rounded-lg px-2.5 py-1.5 text-[12px] text-[#ecedee] outline-none transition-colors"
                          style={{ userSelect: 'text' }}
                        />
                      )}

                      {type === 'number' && (
                        <input
                          type="number"
                          value={value ?? ''}
                          min={min}
                          max={max}
                          onChange={(e) => set(key, e.target.value)}
                          className="bg-[#17171c] border border-[#2a2a35] focus:border-[#1bd96a] rounded-lg px-2.5 py-1.5 text-[12px] text-[#ecedee] outline-none transition-colors"
                          style={{ userSelect: 'text' }}
                        />
                      )}

                      {type === 'select' && (
                        <div className="flex gap-1 flex-wrap">
                          {options.map(o => (
                            <button
                              key={o}
                              onClick={() => set(key, o)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                                (value ?? options[0]) === o
                                  ? 'bg-[#1bd96a] text-black'
                                  : 'bg-[#17171c] border border-[#2a2a35] text-[#55556a] hover:border-[#33333f] hover:text-[#8b8b9e]'
                              }`}
                            >
                              {SELECT_LABELS[o] ?? o}
                            </button>
                          ))}
                        </div>
                      )}

                      {hint && <p className="text-[10px] text-[#33334a]">{hint}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#1bd96a]' : 'bg-[#2a2a35]'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )
}
