import { execSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync, openSync, readSync, closeSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const LOCAL_JAVA_DIR = join(app.getPath('userData'), 'java')
import { createRequire } from 'module'

const CONFIG_PATH = join(app.getPath('userData'), 'config.json')

// class file major version → Java major version
const CLASS_VER_TO_JAVA = { 45: 1, 46: 2, 47: 3, 48: 4, 49: 5, 50: 6, 51: 7, 52: 8, 53: 9, 54: 10, 55: 11, 56: 12, 57: 13, 58: 14, 59: 15, 60: 16, 61: 17, 62: 18, 63: 19, 64: 20, 65: 21, 66: 22, 67: 23, 68: 24 }

function readConfig() {
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) } catch { return {} }
}

function writeConfig(data) {
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2))
}

function getJavaVersion(javaExe) {
  try {
    const out = execSync(`"${javaExe}" -version 2>&1`, { timeout: 4000 }).toString()
    const match = out.match(/version "([^"]+)"/)
    if (!match) return null
    const raw = match[1]
    const major = raw.startsWith('1.') ? parseInt(raw.split('.')[1]) : parseInt(raw.split('.')[0])
    return { version: raw, major }
  } catch {
    return null
  }
}

function javaExeName() {
  return process.platform === 'win32' ? 'java.exe' : 'java'
}

function scanJavaInstallations() {
  const found = new Map()
  const isWin = process.platform === 'win32'
  const exe = javaExeName()

  try {
    const cmd = isWin ? 'where java 2>nul' : 'which java 2>/dev/null'
    const inPath = execSync(cmd, { timeout: 3000 }).toString().trim().split('\n').map(s => s.trim()).filter(Boolean)
    for (const p of inPath) { if (existsSync(p)) found.set(p, true) }
  } catch {}

  const roots = isWin ? [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Amazon Corretto',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files\\Azul Systems',
    'C:\\Program Files\\Eclipse Foundation',
    'C:\\Program Files (x86)\\Java',
  ] : [
    '/usr/lib/jvm',
    '/usr/java',
    '/opt/java',
    '/opt/jdk',
    '/usr/local/lib/jvm',
  ]

  for (const root of roots) {
    if (!existsSync(root)) continue
    try {
      for (const dir of readdirSync(root)) {
        const candidate = join(root, dir, 'bin', exe)
        if (existsSync(candidate)) found.set(candidate, true)
      }
    } catch {}
  }

  const javaHome = process.env.JAVA_HOME
  if (javaHome) {
    const candidate = join(javaHome, 'bin', exe)
    if (existsSync(candidate)) found.set(candidate, true)
  }

  // Also scan java installed locally by ServerMate (no admin, in userData/java)
  if (existsSync(LOCAL_JAVA_DIR)) {
    try {
      for (const dir of readdirSync(LOCAL_JAVA_DIR)) {
        const candidate = join(LOCAL_JAVA_DIR, dir, 'bin', exe)
        if (existsSync(candidate)) found.set(candidate, true)
      }
    } catch {}
  }

  const results = []
  for (const [exe] of found) {
    const info = getJavaVersion(exe)
    if (info) results.push({ path: exe, ...info, local: exe.startsWith(LOCAL_JAVA_DIR) })
  }
  results.sort((a, b) => b.major - a.major)
  return results
}

// Read required Java version from server.jar by inspecting class file bytes inside the zip
function getRequiredJavaFromJar(jarPath) {
  try {
    // Use Node's built-in zlib via require — read zip local file headers to find a .class file
    // Simpler: spawn java -XshowSettings:all to avoid needing a zip library
    // Instead: read the jar as binary and find the first CAFEBABE signature
    const fd = openSync(jarPath, 'r')
    const buf = Buffer.alloc(8 * 1024 * 1024) // read first 8MB
    const bytesRead = readSync(fd, buf, 0, buf.length, 0)
    closeSync(fd)

    const magic = Buffer.from([0xCA, 0xFE, 0xBA, 0xBE])
    let offset = 0
    let highestMajor = 0

    // Scan for CAFEBABE headers (class files embedded in jar)
    while (offset < bytesRead - 8) {
      if (buf[offset] === 0xCA && buf[offset + 1] === 0xFE &&
          buf[offset + 2] === 0xBA && buf[offset + 3] === 0xBE) {
        // bytes 4-5: minor version, bytes 6-7: major version
        const major = buf.readUInt16BE(offset + 6)
        if (major >= 45 && major <= 70) {
          if (major > highestMajor) highestMajor = major
        }
        offset += 8
      } else {
        offset++
      }
    }

    if (highestMajor === 0) return null
    return CLASS_VER_TO_JAVA[highestMajor] ?? (highestMajor - 44)
  } catch {
    return null
  }
}

export function setupJavaHandlers(ipcMain) {
  ipcMain.handle('java:scan', () => scanJavaInstallations())

  ipcMain.handle('java:getForServer', (_, serverName) => {
    const cfg = readConfig()
    return cfg.javaPerServer?.[serverName] ?? null
  })

  ipcMain.handle('java:setForServer', (_, { serverName, javaPath }) => {
    const cfg = readConfig()
    if (!cfg.javaPerServer) cfg.javaPerServer = {}
    cfg.javaPerServer[serverName] = javaPath
    writeConfig(cfg)
    return { ok: true }
  })

  ipcMain.handle('java:getArgs', (_, serverName) => {
    const cfg = readConfig()
    return cfg.javaArgs?.[serverName] ?? '-Xmx2G -Xms512M'
  })

  ipcMain.handle('java:setArgs', (_, { serverName, args }) => {
    const cfg = readConfig()
    if (!cfg.javaArgs) cfg.javaArgs = {}
    cfg.javaArgs[serverName] = args
    writeConfig(cfg)
    return { ok: true }
  })

  ipcMain.handle('java:detectRequired', (_, jarPath) => {
    if (!existsSync(jarPath)) return null
    return getRequiredJavaFromJar(jarPath)
  })
}

export function getJavaForServer(serverName) {
  const cfg = readConfig()
  const path = cfg.javaPerServer?.[serverName]
  const args = (cfg.javaArgs?.[serverName] ?? '-Xmx2G -Xms512M').split(' ').filter(Boolean)
  return { path: path || 'java', args }
}

export { scanJavaInstallations, getRequiredJavaFromJar }
