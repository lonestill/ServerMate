import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, ArrowLeft, ArrowRight, Check, Download, AlertTriangle, RefreshCw, Eye, EyeOff } from '../Icons'
import VersionPicker from './VersionPicker'
import { useLang } from '../LangContext'

export default function CreateServerModal({ onClose, onCreated, existingServers = [] }) {
  const { t } = useLang()

  const CORES = [
    { id: 'paper', label: 'Paper', desc: t('paper_core_desc'), badge: t('paper_popular') },
    { id: 'fabric', label: 'Fabric', desc: t('fabric_core_desc'), badge: null },
    { id: 'vanilla', label: 'Vanilla', desc: t('vanilla_core_desc'), badge: null },
  ]

  const STEPS = [t('step_name'), t('step_core'), t('step_version'), t('step_java')]

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [core, setCore] = useState('paper')
  const [versions, setVersions] = useState([])
  const [allVersions, setAllVersions] = useState([])
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState('')
  const [fabricLoaders, setFabricLoaders] = useState([])
  const [selectedLoader, setSelectedLoader] = useState('')
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [javas, setJavas] = useState([])
  const [installableJavas, setInstallableJavas] = useState([])
  const [javaOk, setJavaOk] = useState(false)
  const [loadingJava, setLoadingJava] = useState(false)
  const [javaInstalling, setJavaInstalling] = useState(null)
  const [javaInstallPhase, setJavaInstallPhase] = useState(null)
  const [javaInstallPct, setJavaInstallPct] = useState(0)
  const [javaError, setJavaError] = useState('')
  const [installProgress, setInstallProgress] = useState(0)
  const [installPhase, setInstallPhase] = useState('')
  const [installError, setInstallError] = useState('')

  function requiredJavaForVersion(mcVersion) {
    if (!mcVersion) return 17
    const parts = mcVersion.split('.')
    const minor = parseInt(parts[1] ?? '0')
    if (minor >= 21) return 21
    if (minor >= 18) return 17
    if (minor === 17) return 16
    return 8
  }

  const requiredJava = requiredJavaForVersion(selectedVersion)
  const hasCompatibleJava = javas.some((j) => j.major >= requiredJava)
  const recommendedInstall = installableJavas.find((v) => {
    const compatible = installableJavas.filter(x => x.major >= requiredJava)
    if (!compatible.length) return false
    return v.major === Math.min(...compatible.map(x => x.major))
  })

  useEffect(() => {
    if (!allVersions.length) return
    if (core === 'paper') {
      setVersions(allVersions)
    } else {
      const filtered = showSnapshots ? allVersions : allVersions.filter(v => v.type === 'release')
      setVersions(filtered)
      if (!filtered.find(v => v.id === selectedVersion)) {
        setSelectedVersion(filtered[0]?.id ?? '')
      }
    }
  }, [showSnapshots, allVersions, core])

  useEffect(() => {
    if (step !== 2) return
    setAllVersions([])
    setVersions([])
    setSelectedVersion('')
    setLoadingVersions(true)
    const load = async () => {
      try {
        if (core === 'paper') {
          const v = await window.api.getPaperVersions()
          const mapped = v.map(id => ({ id }))
          setAllVersions(mapped)
          setVersions(mapped)
          setSelectedVersion(v[0] ?? '')
        } else {
          const v = await window.api.getVanillaVersions()
          setAllVersions(v)
          const filtered = showSnapshots ? v : v.filter(x => x.type === 'release')
          setVersions(filtered)
          setSelectedVersion(filtered[0]?.id ?? '')
          if (core === 'fabric') {
            const loaders = await window.api.getFabricVersions()
            setFabricLoaders(loaders)
            setSelectedLoader(loaders[0] ?? '')
          }
        }
      } catch {}
      setLoadingVersions(false)
    }
    load()
  }, [step, core])

  useEffect(() => {
    if (step !== 3) return
    const load = async () => {
      setLoadingJava(true)
      const [list, installable] = await Promise.all([
        window.api.getJavaInstallations(),
        window.api.getInstallableJavaVersions(),
      ])
      setJavas(list)
      setInstallableJavas(installable)
      setJavaOk(list.some(j => j.major >= requiredJava))
      setLoadingJava(false)
    }
    load()
    const unsub = window.api.onJavaInstallProgress((data) => {
      setJavaInstallPhase(data.phase)
      setJavaInstallPct(data.pct)
      if (data.phase === 'done') {
        window.api.getJavaInstallations().then((list) => {
          setJavas(list)
          setJavaOk(list.some(j => j.major >= requiredJava))
          setJavaInstalling(null)
        })
      }
    })
    return unsub
  }, [step])

  useEffect(() => {
    const unsub = window.api.onDownloadProgress((pct) => setInstallProgress(pct))
    return unsub
  }, [])

  async function installJava(ver) {
    setJavaInstalling(ver.major)
    setJavaError('')
    const res = await window.api.installJava({ major: ver.major, downloadUrl: ver.downloadUrl, name: ver.name, installDir: ver.installDir })
    if (!res.ok) {
      setJavaError(res.error)
      setJavaInstalling(null)
      setJavaInstallPhase(null)
    }
  }

  async function startInstall() {
    const finalName = sanitizedName
    setStep(4)
    setInstallPhase('downloading')
    setInstallProgress(0)
    setInstallError('')

    const createRes = await window.api.createServer({ name: finalName })
    if (!createRes.ok) { setInstallPhase('error'); setInstallError(createRes.error); return }

    try {
      let res
      if (core === 'paper') {
        res = await window.api.downloadPaper({ serverName: finalName, version: selectedVersion })
      } else if (core === 'vanilla') {
        const v = allVersions.find(v => v.id === selectedVersion)
        res = await window.api.downloadVanilla({ serverName: finalName, version: selectedVersion, versionUrl: v?.url })
      } else {
        res = await window.api.downloadFabric({ serverName: finalName, mcVersion: selectedVersion, loaderVersion: selectedLoader })
      }
      if (!res.ok) { setInstallPhase('error'); setInstallError(res.error); return }
    } catch (e) {
      setInstallPhase('error'); setInstallError(e.message); return
    }

    await window.api.saveMeta(finalName, {
      core,
      mcVersion: selectedVersion,
      loaderVersion: selectedLoader || undefined,
      createdAt: new Date().toISOString(),
    })

    setInstallPhase('done')
    setTimeout(() => onCreated(finalName), 1000)
  }

  async function retryInstall() {
    await startInstall()
  }

  function validateName() {
    const v = name.trim()
    if (!v) { setNameError(t('allowed_chars')); return false }
    if (!/^[a-zA-Z0-9_\- ]+$/.test(v)) { setNameError(t('allowed_chars')); return false }
    if (isDuplicate) { setNameError(t('name_duplicate', { name: sanitizedName })); return false }
    return true
  }

  const sanitizedName = name.trim().replace(/\s+/g, '-')
  const isDuplicate = sanitizedName.length > 0 && existingServers.some(s => s.name.toLowerCase() === sanitizedName.toLowerCase())

  function next() {
    if (step === 0 && !validateName()) return
    setStep(s => s + 1)
  }

  const canNext = step === 0
    ? (name.trim().length > 0 && !isDuplicate)
    : step === 2 ? !!selectedVersion
    : step === 3 ? (javaOk && !loadingJava && !javaInstalling)
    : true

  const isInstalling = step === 4

  function handleOverlayClick(e) {
    if (e.target !== e.currentTarget) return
    if (isInstalling && installPhase === 'downloading') return
    if (isInstalling && installPhase !== 'error') return
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35]">
          <p className="text-[14px] font-semibold text-[#ecedee]">{t('new_server_modal')}</p>
          {(!isInstalling || installPhase === 'error') && (
            <button onClick={onClose} className="text-[#55556a] hover:text-[#8b8b9e] transition-colors">
              <X size={15} />
            </button>
          )}
        </div>

        {!isInstalling && (
          <div className="flex items-center px-5 py-3 border-b border-[#2a2a35]">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 ${i <= step ? 'text-[#ecedee]' : 'text-[#33334a]'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i < step ? 'bg-[#1bd96a] text-black' : i === step ? 'bg-[#26262f] border border-[#1bd96a] text-[#1bd96a]' : 'bg-[#26262f] border border-[#2a2a35] text-[#33334a]'
                  }`}>
                    {i < step ? <Check size={10} strokeWidth={3} /> : i + 1}
                  </div>
                  <span className="text-[11px] font-medium">{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-[#1bd96a40]' : 'bg-[#26262f]'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {step === 0 && (
            <StepName
              name={name}
              setName={setName}
              error={nameError}
              setError={setNameError}
              isDuplicate={isDuplicate}
              sanitizedName={sanitizedName}
              onNext={next}
            />
          )}
          {step === 1 && <StepCore core={core} setCore={setCore} cores={CORES} onNext={next} />}
          {step === 2 && (
            <StepVersion
              core={core}
              versions={versions}
              selectedVersion={selectedVersion}
              setSelectedVersion={setSelectedVersion}
              fabricLoaders={fabricLoaders}
              selectedLoader={selectedLoader}
              setSelectedLoader={setSelectedLoader}
              loading={loadingVersions}
              showSnapshots={showSnapshots}
              setShowSnapshots={setShowSnapshots}
            />
          )}
          {step === 3 && (
            <StepJava
              requiredJava={requiredJava}
              javas={javas}
              hasCompatible={hasCompatibleJava}
              installableJavas={installableJavas}
              recommendedInstall={recommendedInstall}
              loading={loadingJava}
              installing={javaInstalling}
              installPhase={javaInstallPhase}
              installPct={javaInstallPct}
              error={javaError}
              onInstall={installJava}
              onRescan={() => window.api.getJavaInstallations().then(list => {
                setJavas(list)
                setJavaOk(list.some(j => j.major >= requiredJava))
              })}
            />
          )}
          {step === 4 && (
            <StepInstalling
              serverName={sanitizedName}
              core={core}
              version={selectedVersion}
              phase={installPhase}
              progress={installProgress}
              error={installError}
              onRetry={retryInstall}
              onClose={onClose}
            />
          )}
        </div>

        {!isInstalling && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#2a2a35]">
            <button
              onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#55556a] hover:text-[#8b8b9e] transition-colors"
            >
              {step > 0 && <ArrowLeft size={13} />}
              {step === 0 ? t('cancel') : t('back')}
            </button>

            <button
              onClick={step === STEPS.length - 1 ? startInstall : next}
              disabled={!canNext}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1bd96a] hover:bg-[#17c05d] disabled:opacity-30 disabled:cursor-not-allowed text-black text-[12px] font-semibold rounded-lg transition-colors"
            >
              {step === STEPS.length - 1 ? (
                <><Download size={13} strokeWidth={2.5} /> {t('install')}</>
              ) : (
                <>{t('next')} <ArrowRight size={13} /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StepName({ name, setName, error, setError, isDuplicate, sanitizedName, onNext }) {
  const { t } = useLang()

  function handleChange(e) {
    setName(e.target.value)
    setError('')
  }

  const showSanitized = name.includes(' ') && sanitizedName && sanitizedName !== name.trim()

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-[#8b8b9e] mb-2">{t('how_to_name')}</p>
      <input
        type="text"
        value={name}
        onChange={handleChange}
        onKeyDown={(e) => e.key === 'Enter' && onNext()}
        placeholder="my-server"
        autoFocus
        className={`bg-[#17171c] border rounded-lg px-3 py-2.5 text-[13px] text-[#ecedee] placeholder-[#33334a] outline-none transition-colors ${
          isDuplicate || error ? 'border-red-500/60 focus:border-red-500' : 'border-[#2a2a35] focus:border-[#1bd96a]'
        }`}
        style={{ userSelect: 'text' }}
      />
      {error && <span className="text-[11px] text-red-400">{error}</span>}
      {!error && isDuplicate && (
        <span className="text-[11px] text-red-400">"{sanitizedName}" {t('already_exists')}</span>
      )}
      {!error && !isDuplicate && showSanitized && (
        <span className="text-[11px] text-[#55556a]">{t('spaces_replaced')} <span className="text-[#8b8b9e]">{sanitizedName}</span></span>
      )}
      {!error && !isDuplicate && !showSanitized && (
        <p className="text-[11px] text-[#33334a]">{t('allowed_chars')}</p>
      )}
    </div>
  )
}

function StepCore({ core, setCore, cores, onNext }) {
  const { t } = useLang()
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-[#8b8b9e] mb-2">{t('choose_core')}</p>
      {cores.map((c) => (
        <label
          key={c.id}
          onDoubleClick={() => { setCore(c.id); onNext() }}
          className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
            core === c.id ? 'border-[#1bd96a] bg-[#1bd96a08]' : 'border-[#2a2a35] bg-[#17171c] hover:border-[#33333f]'
          }`}
        >
          <input type="radio" name="core" checked={core === c.id} onChange={() => setCore(c.id)} className="sr-only" />
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${core === c.id ? 'border-[#1bd96a]' : 'border-[#33333f]'}`}>
            {core === c.id && <div className="w-2 h-2 rounded-full bg-[#1bd96a]" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-[#ecedee]">{c.label}</p>
              {c.badge && <span className="text-[10px] text-[#1bd96a] bg-[#1bd96a15] px-1.5 py-0.5 rounded">{c.badge}</span>}
            </div>
            <p className="text-[11px] text-[#55556a] mt-0.5">{c.desc}</p>
          </div>
        </label>
      ))}
    </div>
  )
}

function StepVersion({ core, versions, selectedVersion, setSelectedVersion, fabricLoaders, selectedLoader, setSelectedLoader, loading, showSnapshots, setShowSnapshots }) {
  const { t } = useLang()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#8b8b9e]">{t('choose_mc_version')}</p>
        {core !== 'paper' && (
          <button
            onClick={() => setShowSnapshots(v => !v)}
            className="flex items-center gap-1 text-[11px] text-[#55556a] hover:text-[#8b8b9e] transition-colors"
          >
            {showSnapshots ? <Eye size={11} /> : <EyeOff size={11} />}
            {showSnapshots ? t('hide_snapshots') : t('show_snapshots')}
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-[#55556a]">
          <div className="w-3 h-3 rounded-full border border-[#55556a] border-t-transparent animate-spin" />
          {t('loading_versions_create')}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#8b8b9e]">{t('step_version')}</label>
            <VersionPicker versions={versions} value={selectedVersion} onChange={setSelectedVersion} />
          </div>
          {core === 'fabric' && fabricLoaders.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#8b8b9e]">Fabric Loader</label>
              <VersionPicker versions={fabricLoaders.map(v => ({ id: v }))} value={selectedLoader} onChange={setSelectedLoader} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StepJava({ requiredJava, javas, hasCompatible, installableJavas, recommendedInstall, loading, installing, installPhase, installPct, error, onInstall, onRescan }) {
  const { t } = useLang()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#1bd96a] border-t-transparent animate-spin" />
        <div className="text-center">
          <p className="text-[13px] text-[#ecedee]">{t('checking_java_title')}</p>
          <p className="text-[11px] text-[#55556a] mt-1">{t('checking_java_desc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {hasCompatible ? (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#1bd96a10] border border-[#1bd96a25]">
          <Check size={14} className="text-[#1bd96a] shrink-0" strokeWidth={3} />
          <p className="text-[12px] text-[#1bd96a] font-medium">
            {t('java_found_ready', { major: javas.find(j => j.major >= requiredJava)?.major })}
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-medium text-red-300">{t('java_not_found_create', { required: requiredJava })}</p>
            <p className="text-[11px] text-red-400/70 mt-0.5">{t('java_for_mc', { required: requiredJava })}</p>
          </div>
        </div>
      )}

      {!hasCompatible && recommendedInstall && (
        <div className="p-4 bg-[#17171c] border border-[#1bd96a30] rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[13px] font-semibold text-[#ecedee]">Java {recommendedInstall.major}</p>
              <p className="text-[11px] text-[#55556a] mt-0.5">{(recommendedInstall.size / 1024 / 1024).toFixed(0)} MB · {t('no_admin_create')}</p>
            </div>
            <span className="text-[10px] text-[#1bd96a] bg-[#1bd96a15] px-2 py-1 rounded font-medium">{t('recommended_badge')}</span>
          </div>

          {installing === recommendedInstall.major && installPhase !== 'done' ? (
            <div>
              <div className="flex justify-between text-[10px] text-[#55556a] mb-1.5">
                <span>{installPhase === 'download' ? t('downloading_progress') : t('installing_progress')}</span>
                {installPhase === 'download' && <span>{installPct}%</span>}
              </div>
              <div className="h-1.5 bg-[#26262f] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${installPhase === 'install' ? 'bg-yellow-400 w-full animate-pulse' : 'bg-[#1bd96a]'}`}
                  style={{ width: installPhase === 'download' ? `${installPct}%` : '100%' }}
                />
              </div>
            </div>
          ) : installing === recommendedInstall.major && installPhase === 'done' ? (
            <div className="flex items-center gap-1.5 text-[12px] text-[#1bd96a]">
              <Check size={13} strokeWidth={3} /> {t('installed_ok')}
            </div>
          ) : (
            <button
              onClick={() => onInstall(recommendedInstall)}
              disabled={!!installing}
              className="w-full flex items-center justify-center gap-2 py-2 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-40"
            >
              <Download size={13} strokeWidth={2.5} />
              {t('install')} Java {recommendedInstall.major}
            </button>
          )}
        </div>
      )}

      {!hasCompatible && !recommendedInstall && installableJavas.length === 0 && (
        <p className="text-[11px] text-[#55556a]">{t('failed_to_load')}</p>
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <button onClick={onRescan} className="flex items-center gap-1.5 text-[11px] text-[#55556a] hover:text-[#8b8b9e] transition-colors w-fit">
        <RefreshCw size={11} /> {t('rescan')}
      </button>

      {hasCompatible && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium text-[#8b8b9e]">{t('compatible_installs')}</p>
          {javas.filter(j => j.major >= requiredJava).map(j => (
            <div key={j.path} className="flex items-center gap-2 px-3 py-2 bg-[#17171c] border border-[#2a2a35] rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1bd96a]" />
              <span className="text-[12px] text-[#ecedee]">Java {j.major}</span>
              <span className="text-[11px] text-[#55556a] truncate">{j.path}</span>
              {j.local && <span className="text-[10px] text-[#55556a] bg-[#26262f] px-1.5 py-0.5 rounded shrink-0">{t('servermate_badge')}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StepInstalling({ serverName, core, version, phase, progress, error, onRetry, onClose }) {
  const { t } = useLang()
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      {phase === 'downloading' && (
        <>
          <div className="w-10 h-10 rounded-full border-2 border-[#1bd96a] border-t-transparent animate-spin" />
          <div className="text-center">
            <p className="text-[13px] font-semibold text-[#ecedee]">{t('downloading_server', { core, version })}</p>
            <p className="text-[11px] text-[#55556a] mt-1">{progress}%</p>
          </div>
          <div className="w-48 h-1.5 bg-[#26262f] rounded-full overflow-hidden">
            <div className="h-full bg-[#1bd96a] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] text-[#33334a]">{t('do_not_close')}</p>
        </>
      )}
      {phase === 'done' && (
        <>
          <div className="w-12 h-12 rounded-full bg-[#1bd96a20] flex items-center justify-center">
            <Check size={22} className="text-[#1bd96a]" strokeWidth={3} />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-[#ecedee]">{t('server_created_msg', { name: serverName })}</p>
            <p className="text-[11px] text-[#55556a] mt-1">{t('opening')}</p>
          </div>
        </>
      )}
      {phase === 'error' && (
        <>
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-red-300">{t('install_error')}</p>
            <p className="text-[11px] text-red-400/70 mt-1 max-w-xs">{error}</p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1bd96a] hover:bg-[#17c05d] text-black text-[12px] font-semibold rounded-lg transition-colors"
            >
              <RefreshCw size={13} /> {t('retry')}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-[12px] text-[#55556a] hover:text-[#8b8b9e] transition-colors"
            >
              {t('close')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
