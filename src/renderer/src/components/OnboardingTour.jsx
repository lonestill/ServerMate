import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { ArrowRight } from '../Icons'
import { useLang } from '../LangContext'

export const TOUR_KEY = 'onboarding_done'

// Step types:
//   'info'   — just read + Next button
//   'action' — shows an action button that triggers something; also auto-advances on waitFor
//   'wait'   — no Next button, auto-advances on waitFor; hideOverlay=true for modal-open state

const STEPS = [
  {
    type: 'info',
    selector: null,
    titleKey: 'tour_welcome_title',
    descKey: 'tour_welcome_desc',
    nextKey: 'tour_next',
  },
  {
    type: 'action',
    selector: '[data-tour="create-btn"]',
    titleKey: 'tour_create_title',
    descKey: 'tour_create_desc',
    actionKey: 'tour_open_wizard',
    action: 'createServer',
    waitFor: 'wizardOpen',
  },
  {
    type: 'wait',
    selector: null,
    titleKey: 'tour_wizard_title',
    descKey: 'tour_wizard_desc',
    waitFor: 'serverCreated',
    hideOverlay: true,
    corner: true,
  },
  {
    type: 'info',
    selector: '[data-tour="server-list"]',
    titleKey: 'tour_server_ready_title',
    descKey: 'tour_server_ready_desc',
    nextKey: 'tour_next',
  },
  {
    type: 'action',
    selector: '[data-tour="tabs-area"]',
    titleKey: 'tour_settings_tab_title',
    descKey: 'tour_settings_tab_desc',
    actionKey: 'tour_go_settings',
    action: 'switchToSettings',
    waitFor: 'onSettings',
  },
  {
    type: 'info',
    selector: null,
    titleKey: 'tour_configure_title',
    descKey: 'tour_configure_desc',
    nextKey: 'tour_next',
  },
  {
    type: 'action',
    selector: '[data-tour="tabs-area"]',
    titleKey: 'tour_console_title',
    descKey: 'tour_console_desc',
    actionKey: 'tour_go_console',
    action: 'switchToConsole',
    waitFor: 'onConsole',
  },
  {
    type: 'info',
    selector: null,
    titleKey: 'tour_done_title',
    descKey: 'tour_done_desc',
    nextKey: 'tour_finish',
    isLast: true,
  },
]

const PAD = 10
const CARD_W = 288

export default function OnboardingTour({
  onDone,
  onCreateServer,
  onSwitchTab,
  wizardOpen,
  serverCreated,
  activeTab,
  hasServer,
}) {
  const { t } = useLang()
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)
  const [cardStyle, setCardStyle] = useState({})
  const [visible, setVisible] = useState(false)
  const cardRef = useRef(null)

  const current = STEPS[step]

  // Fade in
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(id)
  }, [])

  // Auto-advance based on external state
  useEffect(() => {
    if (!current.waitFor) return
    const conditions = {
      wizardOpen: wizardOpen,
      serverCreated: serverCreated && !wizardOpen,
      onSettings: hasServer && activeTab === 'settings',
      onConsole: hasServer && activeTab === 'console',
    }
    if (conditions[current.waitFor]) {
      const id = setTimeout(() => setStep(s => s + 1), 400)
      return () => clearTimeout(id)
    }
  }, [wizardOpen, serverCreated, activeTab, hasServer, step, current.waitFor])

  // Measure target element
  useEffect(() => {
    if (!current.selector) { setRect(null); return }
    const el = document.querySelector(current.selector)
    if (!el) { setRect(null); return }

    function measure() {
      const r = el.getBoundingClientRect()
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step, current.selector])

  // Position the card
  useLayoutEffect(() => {
    if (!cardRef.current) return
    const cardH = cardRef.current.offsetHeight
    const WW = window.innerWidth
    const WH = window.innerHeight
    const MARGIN = 16

    // Corner card (wizard waiting step)
    if (current.corner) {
      setCardStyle({
        position: 'fixed',
        right: MARGIN,
        bottom: MARGIN,
        left: 'auto',
        top: 'auto',
      })
      return
    }

    // No target → center
    if (!rect) {
      setCardStyle({
        position: 'fixed',
        left: WW / 2 - CARD_W / 2,
        top: WH / 2 - cardH / 2,
      })
      return
    }

    // Try right of target
    let x = rect.x + rect.w + PAD + MARGIN
    let y = rect.y + rect.h / 2 - cardH / 2

    // No room on right → try below
    if (x + CARD_W > WW - MARGIN) {
      x = Math.max(MARGIN, rect.x + rect.w / 2 - CARD_W / 2)
      y = rect.y + rect.h + PAD + MARGIN
    }

    y = Math.max(MARGIN, Math.min(y, WH - cardH - MARGIN))
    x = Math.max(MARGIN, Math.min(x, WW - CARD_W - MARGIN))
    setCardStyle({ position: 'fixed', left: x, top: y })
  }, [rect, step, current.corner])

  function skip() {
    localStorage.setItem(TOUR_KEY, '1')
    onDone()
  }

  function next() {
    if (current.isLast) {
      localStorage.setItem(TOUR_KEY, '1')
      onDone()
    } else {
      setStep(s => s + 1)
    }
  }

  function handleAction() {
    if (current.action === 'createServer') onCreateServer()
    if (current.action === 'switchToSettings') onSwitchTab('settings')
    if (current.action === 'switchToConsole') onSwitchTab('console')
  }

  const WW = typeof window !== 'undefined' ? window.innerWidth : 1280
  const WH = typeof window !== 'undefined' ? window.innerHeight : 800

  // Progress: skip the 'wait' step in dot display
  const visibleSteps = STEPS.filter(s => s.type !== 'wait')
  const visibleIndex = visibleSteps.indexOf(current) === -1
    ? visibleSteps.findIndex((_, i) => STEPS.indexOf(visibleSteps[i]) >= step)
    : visibleSteps.indexOf(current)

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 9990, opacity: visible ? 1 : 0, transition: 'opacity 0.25s ease', pointerEvents: 'none' }}
    >
      {/* Overlay */}
      {!current.hideOverlay && (
        <svg width={WW} height={WH} className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          {rect ? (
            <>
              <defs>
                <mask id="tour-mask">
                  <rect width={WW} height={WH} fill="white" />
                  <rect
                    x={rect.x - PAD} y={rect.y - PAD}
                    width={rect.w + PAD * 2} height={rect.h + PAD * 2}
                    rx={10} fill="black"
                  />
                </mask>
              </defs>
              <rect width={WW} height={WH} fill="rgba(0,0,0,0.72)" mask="url(#tour-mask)" />
              <rect
                x={rect.x - PAD} y={rect.y - PAD}
                width={rect.w + PAD * 2} height={rect.h + PAD * 2}
                rx={10} fill="none" stroke="#1bd96a" strokeWidth="1.5" opacity="0.8"
              />
            </>
          ) : (
            <rect width={WW} height={WH} fill="rgba(0,0,0,0.72)" />
          )}
        </svg>
      )}

      {/* Card */}
      <div
        ref={cardRef}
        style={{ ...cardStyle, width: CARD_W, zIndex: 9991, pointerEvents: 'auto' }}
        className="absolute bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl p-4 flex flex-col gap-3"
      >
        {/* Header: progress dots + step counter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {visibleSteps.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  height: 4,
                  width: i === visibleIndex ? 16 : 6,
                  background: i < visibleIndex ? '#1bd96a60' : i === visibleIndex ? '#1bd96a' : '#2a2a35',
                }}
              />
            ))}
          </div>
          <button
            onClick={skip}
            className="text-[10px] text-[#33334a] hover:text-[#55556a] transition-colors"
          >
            {t('tour_skip')}
          </button>
        </div>

        {/* Icon for centered steps */}
        {!current.selector && !current.corner && (
          <div className="flex justify-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
              current.isLast
                ? 'bg-[#1bd96a20] shadow-[0_0_16px_#1bd96a20]'
                : 'bg-[#1bd96a] shadow-[0_0_16px_#1bd96a50]'
            }`}>
              {current.isLast ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1bd96a" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="M8 21h8M12 17v4" strokeLinecap="round"/>
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Spinner for wait step */}
        {current.type === 'wait' && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-[#1bd96a] border-t-transparent animate-spin shrink-0" />
            <span className="text-[10px] text-[#1bd96a]">{t('tour_wizard_title')}</span>
          </div>
        )}

        {/* Text */}
        <div>
          <p className="text-[13px] font-semibold text-[#ecedee]">{t(current.titleKey)}</p>
          <p className="text-[11px] text-[#55556a] mt-1.5 leading-relaxed">{t(current.descKey)}</p>
        </div>

        {/* Buttons */}
        {current.type !== 'wait' && (
          <div className="flex items-center gap-2 pt-0.5">
            {current.type === 'action' && (
              <button
                onClick={handleAction}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[11px] font-semibold rounded-lg transition-colors"
              >
                {t(current.actionKey)} <ArrowRight size={11} />
              </button>
            )}
            {current.type === 'info' && (
              <button
                onClick={next}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[11px] font-semibold rounded-lg transition-colors ml-auto"
              >
                {t(current.nextKey)}
                {!current.isLast && <ArrowRight size={11} />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
