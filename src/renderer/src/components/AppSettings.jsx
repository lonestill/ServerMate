import React, { useState, useEffect } from 'react'
import { X, Bell, Monitor, Power, Info } from '../Icons'

export default function AppSettings({ onClose }) {
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35]">
          <p className="text-[14px] font-semibold text-[#ecedee]">Настройки приложения</p>
          <button onClick={onClose} className="text-[#33334a] hover:text-[#55556a] transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <SettingRow
            icon={Monitor}
            title="Сворачивать в трей"
            desc="При закрытии окна приложение остаётся в трее, сервер продолжает работать"
            checked={settings.minimizeToTray}
            onChange={() => toggle('minimizeToTray')}
          />
          <SettingRow
            icon={Bell}
            title="Уведомления"
            desc="Показывать уведомления когда сервер запущен или упал"
            checked={settings.notifications}
            onChange={() => toggle('notifications')}
          />
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-[#2a2a35]">
          <div className="flex items-start gap-1.5 flex-1">
            <Info size={11} className="text-[#33334a] mt-0.5 shrink-0" />
            <p className="text-[10px] text-[#33334a]">Данные хранятся локально на этом компьютере</p>
          </div>
          <button
            onClick={save}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[12px] font-semibold rounded-lg transition-colors"
          >
            {saved ? 'Сохранено!' : 'Сохранить'}
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
