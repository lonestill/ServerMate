import https from 'https'
import http from 'http'
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { spawn } from 'child_process'

// Download zip (no admin needed), extract to AppData
const ADOPTIUM = 'https://api.adoptium.net/v3'
const JAVA_DIR = join(app.getPath('userData'), 'java')

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': 'ServerMate/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302)
        return fetchJson(res.headers.location).then(resolve).catch(reject)
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': 'ServerMate/1.0' } }, (res) => {
      // Follow all redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const location = res.headers.location
        if (!location) return reject(new Error('Redirect without location'))
        // Consume response to free socket
        res.resume()
        return downloadFile(location, dest, onProgress).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      const file = createWriteStream(dest)
      res.on('data', (chunk) => {
        received += chunk.length
        if (total > 0) onProgress(Math.round((received / total) * 100))
      })
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve(received)))
      file.on('error', reject)
    }).on('error', reject)
  })
}

// Follow redirects and return final URL (HEAD request)
function resolveRedirect(url, depth = 0) {
  if (depth > 10) return Promise.resolve(url)
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const req = client.request(url, { method: 'HEAD', headers: { 'User-Agent': 'ServerMate/1.0' } }, (res) => {
      res.resume()
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        resolve(resolveRedirect(res.headers.location, depth + 1))
      } else {
        resolve(url)
      }
    })
    req.on('error', () => resolve(url))
    req.end()
  })
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const proc = spawn('powershell.exe', [
      '-NonInteractive', '-NoProfile', '-Command', script
    ], { windowsHide: true })
    let out = ''
    proc.stdout.on('data', (d) => (out += d))
    proc.stderr.on('data', (d) => (out += d))
    proc.on('close', (code) => code === 0 ? resolve(out.trim()) : reject(new Error(out.trim())))
    proc.on('error', reject)
  })
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      const proc = spawn('powershell.exe', [
        '-NonInteractive', '-NoProfile', '-Command',
        `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`
      ], { windowsHide: true })
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`PowerShell exit ${code}`)))
      proc.on('error', reject)
    } else {
      mkdirSync(destDir, { recursive: true })
      const proc = spawn('unzip', ['-o', zipPath, '-d', destDir])
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`unzip exit ${code}`)))
      proc.on('error', () => {
        // fallback: tar (some distros don't have unzip)
        const proc2 = spawn('tar', ['-xf', zipPath, '-C', destDir])
        proc2.on('close', (c) => c === 0 ? resolve() : reject(new Error(`tar exit ${c}`)))
        proc2.on('error', reject)
      })
    }
  })
}

function getFirstSubdir(dir) {
  const { readdirSync: rd, statSync: st } = require('fs')
  for (const name of rd(dir)) {
    if (st(join(dir, name)).isDirectory()) return join(dir, name)
  }
  return null
}

function copyDirContents(src, dest) {
  const { cpSync } = require('fs')
  cpSync(src, dest, { recursive: true })
}

export function getLocalJavaDir() {
  return JAVA_DIR
}

// Scan java installs inside our userData/java folder
export function scanLocalJavaInstalls() {
  if (!existsSync(JAVA_DIR)) return []
  const { readdirSync } = require('fs')
  const exeName = process.platform === 'win32' ? 'java.exe' : 'java'
  const results = []
  try {
    for (const dir of readdirSync(JAVA_DIR)) {
      const exe = join(JAVA_DIR, dir, 'bin', exeName)
      if (!existsSync(exe)) continue
      const match = dir.match(/jdk[^0-9]*(\d+)/)
      if (match) results.push({ path: exe, major: parseInt(match[1]), version: dir, local: true })
    }
  } catch {}
  return results
}

export function setupJavaInstallerHandlers(ipcMain, getWindow) {
  ipcMain.handle('java:getInstallableVersions', async () => {
    const LTS = [21, 17, 11, 8]
    const results = []
    const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux'
    for (const ver of LTS) {
      try {
        const data = await fetchJson(
          `${ADOPTIUM}/assets/latest/${ver}/hotspot?architecture=x64&image_type=jdk&os=${os}&vendor=eclipse`
        )
        const asset = data?.[0]
        if (!asset) continue

        const binaryUrl = `${ADOPTIUM}/binary/latest/${ver}/ga/${os}/x64/jdk/hotspot/normal/eclipse`
        const finalUrl = await resolveRedirect(binaryUrl)

        results.push({
          major: ver,
          version: asset.version?.semver ?? String(ver),
          downloadUrl: finalUrl,
          size: asset.binary?.package?.size ?? 0,
          name: `jdk-${ver}.zip`,
          installDir: join(JAVA_DIR, `jdk-${ver}`),
        })
      } catch {}
    }
    return results
  })

  ipcMain.handle('java:install', async (_, { major, downloadUrl, name, installDir }) => {
    const win = getWindow()
    const tmpDir = join(app.getPath('temp'), 'servermate-java')
    mkdirSync(tmpDir, { recursive: true })
    mkdirSync(JAVA_DIR, { recursive: true })

    // Use unique name per attempt to avoid EBUSY from previous interrupted download
    const zipPath = join(tmpDir, `jdk-${major}-${Date.now()}.zip`)

    // Clean up any leftover zips for this major version
    try {
      const { readdirSync } = await import('fs')
      for (const f of readdirSync(tmpDir)) {
        if (f.startsWith(`jdk-${major}-`) && f.endsWith('.zip')) {
          try { unlinkSync(join(tmpDir, f)) } catch {}
        }
      }
    } catch {}

    // 1. Download zip
    win?.webContents.send('java:installProgress', { phase: 'download', pct: 0 })
    try {
      await downloadFile(downloadUrl, zipPath, (pct) => {
        win?.webContents.send('java:installProgress', { phase: 'download', pct })
      })
    } catch (e) {
      return { ok: false, error: 'Ошибка скачивания: ' + e.message }
    }

    // 2. Extract archive
    win?.webContents.send('java:installProgress', { phase: 'install', pct: 0 })
    try {
      const extractTmp = join(tmpDir, `extract-${major}`)
      await extractZip(zipPath, extractTmp)
      const inner = getFirstSubdir(extractTmp)
      if (!inner) throw new Error('Не удалось найти папку JDK внутри архива')
      mkdirSync(installDir, { recursive: true })
      copyDirContents(inner, installDir)
    } catch (e) {
      return { ok: false, error: 'Ошибка распаковки: ' + e.message }
    }

    const exeName = process.platform === 'win32' ? 'java.exe' : 'java'
    const javaExe = join(installDir, 'bin', exeName)

    // Make executable on Linux/macOS
    if (process.platform !== 'win32') {
      try { require('fs').chmodSync(javaExe, 0o755) } catch {}
    }

    win?.webContents.send('java:installProgress', { phase: 'done', pct: 100 })
    return { ok: true, javaExe }
  })
}
