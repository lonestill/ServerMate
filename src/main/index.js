import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, Notification } from 'electron'
import { join } from 'path'
import { deflateRawSync } from 'zlib'
import { is, electronApp, optimizer } from '@electron-toolkit/utils'
import { setupServerHandlers } from './serverManager'
import { setupDownloadHandlers } from './downloader'
import { setupPropertiesHandlers } from './properties'
import { setupJavaHandlers } from './javaManager'
import { setupJavaInstallerHandlers } from './javaInstaller'
import { setupPlayersHandlers } from './playersManager'
import { setupModsHandlers } from './modsManager'
import { setupPluginSearchHandlers } from './pluginSearch'
import { readFileSync, writeFileSync, existsSync } from 'fs'

let mainWindow = null
let tray = null

// ─── Settings ────────────────────────────────────────────────────────────────

function getSettingsPath() {
  return join(app.getPath('userData'), 'app-settings.json')
}

function readSettings() {
  try { return JSON.parse(readFileSync(getSettingsPath(), 'utf-8')) } catch { return {} }
}

function writeSettings(data) {
  const current = readSettings()
  writeFileSync(getSettingsPath(), JSON.stringify({ ...current, ...data }, null, 2))
}

// ─── Tray icon (generated 32×32 PNG) ─────────────────────────────────────────

function makePng(width, height, r, g, b, a = 255) {
  function u32(n) { const buf = Buffer.alloc(4); buf.writeUInt32BE(n); return buf }
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  function crc32(buf) {
    let crc = 0xFFFFFFFF
    for (const byte of buf) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
    return (crc ^ 0xFFFFFFFF) >>> 0
  }
  function chunk(type, data) {
    const typeB = Buffer.from(type)
    const crcBuf = crc32(Buffer.concat([typeB, data]))
    return Buffer.concat([u32(data.length), typeB, data, u32(crcBuf)])
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = chunk('IHDR', Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])]))

  // Draw circle on transparent bg
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0 // filter
    for (let x = 0; x < width; x++) {
      const cx = width / 2, cy = height / 2, rad = width / 2 - 1
      const dist = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2)
      const alpha = dist < rad ? a : 0
      const i = y * (1 + width * 4) + 1 + x * 4
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = alpha
    }
  }

  const idat = chunk('IDAT', deflateRawSync(raw))
  const iend = chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdr, idat, iend])
}

function createTray() {
  const iconBuf = makePng(32, 32, 0x1b, 0xd9, 0x6a)
  const icon = nativeImage.createFromBuffer(iconBuf)
  tray = new Tray(icon)
  tray.setToolTip('ServerMate')
  updateTrayMenu()
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus() }
  })
}

function updateTrayMenu(serverName = null) {
  if (!tray) return
  const menu = Menu.buildFromTemplate([
    { label: serverName ? `Сервер: ${serverName}` : 'Нет запущенных серверов', enabled: false },
    { type: 'separator' },
    { label: 'Показать', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Выход', click: () => { app.isQuiting = true; app.quit() } },
  ])
  tray.setContextMenu(menu)
}

// ─── Notifications ────────────────────────────────────────────────────────────

function notify(title, body) {
  if (!Notification.isSupported()) return
  const settings = readSettings()
  if (settings.notifications === false) return
  new Notification({ title, body, silent: false }).show()
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#17171c',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.on('close', (e) => {
    if (app.isQuiting) return
    const settings = readSettings()
    if (settings.minimizeToTray !== false) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── App settings IPC ────────────────────────────────────────────────────────

function setupAppHandlers() {
  ipcMain.handle('app:getSettings', () => readSettings())
  ipcMain.handle('app:setSettings', (_, data) => { writeSettings(data); return { ok: true } })

  // Notify from renderer
  ipcMain.handle('app:notify', (_, { title, body }) => { notify(title, body); return { ok: true } })

  // Tray menu update when server starts/stops
  ipcMain.handle('app:setRunningServer', (_, name) => { updateTrayMenu(name); return { ok: true } })

  ipcMain.handle('app:quit', () => { app.isQuiting = true; app.quit() })
  ipcMain.handle('app:showWindow', () => { mainWindow?.show(); mainWindow?.focus() })
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.servermate.app')
  app.on('browser-window-created', (_, win) => optimizer.watchWindowShortcuts(win))

  setupServerHandlers(ipcMain, () => mainWindow)
  setupDownloadHandlers(ipcMain, () => mainWindow)
  setupPropertiesHandlers(ipcMain)
  setupJavaHandlers(ipcMain)
  setupJavaInstallerHandlers(ipcMain, () => mainWindow)
  setupPlayersHandlers(ipcMain)
  setupModsHandlers(ipcMain)
  setupPluginSearchHandlers(ipcMain, () => mainWindow)
  setupAppHandlers()

  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && app.isQuiting) app.quit()
})

app.on('before-quit', () => { app.isQuiting = true })
