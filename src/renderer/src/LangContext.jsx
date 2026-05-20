import React, { createContext, useContext, useState } from 'react'
import { t as translate } from './i18n'

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || null)

  function setLang(l) {
    localStorage.setItem('lang', l)
    setLangState(l)
  }

  function t(key, vars) {
    return translate(lang || 'ru', key, vars)
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}
