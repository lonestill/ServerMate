import React, { useState, useEffect, useRef } from 'react'
import { Check } from '../Icons'
import { useLang } from '../LangContext'

export default function PropertiesEditor({ server, isRunning }) {
  const { t } = useLang()

  const SECTIONS = [
    {
      titleKey: 'section_basic',
      props: [
        { key: 'server-port', labelKey: 'prop_port', type: 'number', hintKey: 'prop_port_hint', min: 1, max: 65535, span: 1 },
        { key: 'max-players', labelKey: 'prop_max_players', type: 'number', min: 1, max: 1000, span: 1 },
        { key: 'motd', labelKey: 'prop_motd', type: 'text', hintKey: 'prop_motd_hint', span: 2 },
        { key: 'level-name', labelKey: 'prop_level_name', type: 'text', span: 1 },
        { key: 'level-seed', labelKey: 'prop_level_seed', type: 'text', hintKey: 'prop_level_seed_hint', span: 1 },
      ],
    },
    {
      titleKey: 'section_gameplay',
      props: [
        { key: 'gamemode', labelKey: 'prop_gamemode', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'], optionKeys: ['gamemode_survival', 'gamemode_creative', 'gamemode_adventure', 'gamemode_spectator'], span: 1 },
        { key: 'difficulty', labelKey: 'prop_difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], optionKeys: ['difficulty_peaceful', 'difficulty_easy', 'difficulty_normal', 'difficulty_hard'], span: 1 },
        { key: 'view-distance', labelKey: 'prop_view_distance', type: 'number', hintKey: 'prop_view_distance_hint', min: 4, max: 32, span: 1 },
        { key: 'simulation-distance', labelKey: 'prop_sim_distance', type: 'number', hintKey: 'prop_sim_distance_hint', min: 3, max: 32, span: 1 },
        { key: 'pvp', labelKey: 'prop_pvp', type: 'toggle', span: 1 },
        { key: 'allow-flight', labelKey: 'prop_flight', type: 'toggle', span: 1 },
        { key: 'spawn-monsters', labelKey: 'prop_monsters', type: 'toggle', span: 1 },
        { key: 'spawn-animals', labelKey: 'prop_animals', type: 'toggle', span: 1 },
        { key: 'spawn-npcs', labelKey: 'prop_npcs', type: 'toggle', span: 1 },
        { key: 'allow-nether', labelKey: 'prop_nether', type: 'toggle', span: 1 },
        { key: 'enable-command-block', labelKey: 'prop_cmd_block', type: 'toggle', span: 1 },
        { key: 'force-gamemode', labelKey: 'prop_force_gamemode', type: 'toggle', hintKey: 'prop_force_gamemode_hint', span: 1 },
      ],
    },
    {
      titleKey: 'section_access',
      props: [
        { key: 'online-mode', labelKey: 'prop_online_mode', type: 'toggle', hintKey: 'prop_online_mode_hint', span: 2 },
        { key: 'white-list', labelKey: 'prop_whitelist', type: 'toggle', hintKey: 'prop_whitelist_hint', span: 1 },
        { key: 'enforce-whitelist', labelKey: 'prop_enforce_whitelist', type: 'toggle', span: 1 },
        { key: 'max-tick-time', labelKey: 'prop_watchdog', type: 'number', hintKey: 'prop_watchdog_hint', min: -1, span: 1 },
        { key: 'network-compression-threshold', labelKey: 'prop_compression', type: 'number', hintKey: 'prop_compression_hint', min: -1, span: 1 },
        { key: 'player-idle-timeout', labelKey: 'prop_afk', type: 'number', hintKey: 'prop_afk_hint', min: 0, span: 1 },
        { key: 'op-permission-level', labelKey: 'prop_op_level', type: 'select', options: ['1', '2', '3', '4'], span: 1 },
      ],
    },
  ]

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
            {server.hasJar ? t('props_no_jar') : t('props_no_install')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 py-2 border-b border-[#2a2a35] bg-[#111116] shrink-0 h-9">
        {saving && <span className="text-[11px] text-[#55556a]">{t('saving')}</span>}
        {!saving && savedAt && <span className="flex items-center gap-1 text-[11px] text-[#1bd96a]"><Check size={10} strokeWidth={3}/>{t('saved')}</span>}
        {isRunning && <span className="text-[11px] text-[#55556a] ml-auto">{t('changes_after_restart')}</span>}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 max-w-2xl flex flex-col gap-6">
          {SECTIONS.map((section) => (
            <div key={section.titleKey}>
              <p className="text-[11px] font-semibold text-[#55556a] uppercase tracking-wider mb-3">{t(section.titleKey)}</p>
              <div className="grid grid-cols-2 gap-3">
                {section.props.map(({ key, labelKey, type, options, optionKeys, hintKey, min, max, span }) => {
                  const value = props[key]
                  return (
                    <div
                      key={key}
                      className={`flex flex-col gap-1.5 p-3 bg-[#1e1e26] border border-[#2a2a35] rounded-xl ${span === 2 ? 'col-span-2' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-[#8b8b9e]">{t(labelKey)}</label>
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
                          {options.map((o, oi) => (
                            <button
                              key={o}
                              onClick={() => set(key, o)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                                (value ?? options[0]) === o
                                  ? 'bg-[#1bd96a] text-black'
                                  : 'bg-[#17171c] border border-[#2a2a35] text-[#55556a] hover:border-[#33333f] hover:text-[#8b8b9e]'
                              }`}
                            >
                              {optionKeys ? t(optionKeys[oi]) : o}
                            </button>
                          ))}
                        </div>
                      )}

                      {hintKey && <p className="text-[10px] text-[#33334a]">{t(hintKey)}</p>}
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
