import React, { useState, useEffect } from 'react'
import { X, Bell, Monitor, Globe, Info, BookOpen } from '../Icons'
import { useLang } from '../LangContext'

export default function AppSettings({ onClose, onReplayTour }) {
  const { lang, setLang, t } = useLang()
  const [settings, setSettings] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.getAppSettings().then(s => {
      setSettings({
        minimizeToTray: true,
        notifications: true,
        ...s,
      })
    })
  }, [])

  async function save() {
    await window.api.setAppSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  function toggle(key) {
    setSettings(s => ({ ...s, [key]: !s[key] }))
  }

  if (!settings) return null

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl w-[400px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35]">
          <p className="text-[14px] font-semibold text-[#ecedee]">{t('app_settings_title')}</p>
          <button onClick={onClose} className="text-[#33334a] hover:text-[#55556a] transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <SettingRow
            icon={Monitor}
            title={t('minimize_to_tray')}
            desc={t('minimize_to_tray_desc')}
            checked={settings.minimizeToTray}
            onChange={() => toggle('minimizeToTray')}
          />
          <SettingRow
            icon={Bell}
            title={t('notifications')}
            desc={t('notifications_desc')}
            checked={settings.notifications}
            onChange={() => toggle('notifications')}
          />

          {/* Replay tour */}
          <div className="flex items-start gap-3 p-3 bg-[#17171c] border border-[#2a2a35] rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-[#1e1e26] flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen size={14} className="text-[#55556a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#ecedee]">{t('replay_tour')}</p>
              <p className="text-[11px] text-[#55556a] mt-0.5 leading-relaxed">{t('replay_tour_desc')}</p>
            </div>
            <button
              onClick={onReplayTour}
              className="shrink-0 px-2.5 py-1 bg-[#26262f] hover:bg-[#2e2e3a] border border-[#33333f] text-[11px] text-[#8b8b9e] rounded-lg transition-colors"
            >
              ▶
            </button>
          </div>

          {/* Language selector */}
          <div className="flex items-start gap-3 p-3 bg-[#17171c] border border-[#2a2a35] rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-[#1e1e26] flex items-center justify-center shrink-0 mt-0.5">
              <Globe size={14} className="text-[#55556a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#ecedee]">{t('language')}</p>
              <p className="text-[11px] text-[#55556a] mt-0.5 leading-relaxed">{t('language_desc')}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setLang('ru')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${lang === 'ru' ? 'bg-[#1bd96a20] text-[#1bd96a] border border-[#1bd96a40]' : 'bg-[#26262f] text-[#55556a] hover:text-[#8b8b9e] border border-transparent'}`}
              >
                RU
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${lang === 'en' ? 'bg-[#1bd96a20] text-[#1bd96a] border border-[#1bd96a40]' : 'bg-[#26262f] text-[#55556a] hover:text-[#8b8b9e] border border-transparent'}`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-[#2a2a35]">
          <div className="flex items-start gap-1.5 flex-1">
            <Info size={11} className="text-[#33334a] mt-0.5 shrink-0" />
            <p className="text-[10px] text-[#33334a]">{t('data_local')}</p>
          </div>
          <button
            onClick={save}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[12px] font-semibold rounded-lg transition-colors"
          >
            {saved ? t('saved_ok') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#1bd96a]' : 'bg-[#2a2a35]'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
    </button>
  )
}

function SettingRow({ icon: Icon, title, desc, checked, onChange }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-[#17171c] border border-[#2a2a35] rounded-xl">
      <div className="w-8 h-8 rounded-lg bg-[#1e1e26] flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-[#55556a]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#ecedee]">{title}</p>
        <p className="text-[11px] text-[#55556a] mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}
