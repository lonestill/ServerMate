import { spawn, execSync } from 'child_process'
import { join } from 'path'
import { existsSync, rmSync, renameSync, readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'fs'
import { networkInterfaces } from 'os'
import { createServer as netServer } from 'net'
import { app } from 'electron'
import { getJavaForServer, scanJavaInstallations, getRequiredJavaFromJar } from './javaManager'

let serverProcess = null
let runningServerName = null

function getServersDir() {
  return join(app.getPath('userData'), 'servers')
}

function getMetaPath(serverName) {
  return join(getServersDir(), serverName, '.servermate.json')
}

function readMeta(serverName) {
  try { return JSON.parse(readFileSync(getMetaPath(serverName), 'utf-8')) } catch { return {} }
}

function writeMeta(serverName, data) {
  writeFileSync(getMetaPath(serverName), JSON.stringify(data, null, 2))
}

function getLocalIp() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}

function readConfig() {
  const CONFIG_PATH = join(app.getPath('userData'), 'config.json')
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) } catch { return {} }
}

function writeConfig(data) {
  const CONFIG_PATH = join(app.getPath('userData'), 'config.json')
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2))
}

// Returns path to the server jar: prefers server.jar, falls back to any .jar in root
function findServerJar(serverDir) {
  const preferred = join(serverDir, 'server.jar')
  if (existsSync(preferred)) return preferred
  try {
    const jars = readdirSync(serverDir).filter(f => f.endsWith('.jar') && !f.startsWith('.'))
    if (jars.length > 0) return join(serverDir, jars[0])
  } catch {}
  return null
}

function ensureEula(serverDir) {
  const eulaPath = join(serverDir, 'eula.txt')
  if (!existsSync(eulaPath)) {
    writeFileSync(eulaPath,
      '#By changing the setting below to TRUE you are indicating your agreement to our EULA\n' +
      '#https://aka.ms/MinecraftEULA\neula=true\n'
    )
    return true
  }
  // Fix if eula=false
  const content = readFileSync(eulaPath, 'utf-8')
  if (/eula=false/i.test(content)) {
    writeFileSync(eulaPath, content.replace(/eula=false/i, 'eula=true'))
    return true
  }
  return false
}

function getServerPort(serverDir) {
  try {
    const propsPath = join(serverDir, 'server.properties')
    if (!existsSync(propsPath)) return 25565
    const content = readFileSync(propsPath, 'utf-8')
    const match = content.match(/^server-port=(\d+)/m)
    return match ? parseInt(match[1]) : 25565
  } catch { return 25565 }
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const srv = netServer()
    srv.listen(port, '0.0.0.0', () => { srv.close(() => resolve(false)) })
    srv.on('error', () => resolve(true))
  })
}

function zipDir(sourceDir, destZip) {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      const ps = spawn('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        `Compress-Archive -Path "${sourceDir}\\*" -DestinationPath "${destZip}" -Force`
      ])
      ps.on('close', code => code === 0 ? resolve() : reject(new Error(`PowerShell exit ${code}`)))
      ps.on('error', reject)
    } else {
      // Use zip if available, fallback to tar.gz (change ext handled by caller)
      const proc = spawn('zip', ['-r', destZip, '.'], { cwd: sourceDir })
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`zip exit ${code}`)))
      proc.on('error', () => {
        // zip not found — try tar
        const tar = spawn('tar', ['-czf', destZip, '-C', sourceDir, '.'])
        tar.on('close', c => c === 0 ? resolve() : reject(new Error(`tar exit ${c}`)))
        tar.on('error', reject)
      })
    }
  })
}

function getDirSize(dir) {
  let size = 0
  try {
    for (const f of readdirSync(dir)) {
      const full = join(dir, f)
      try {
        const { statSync } = require('fs')
        const s = statSync(full)
        size += s.isDirectory() ? getDirSize(full) : s.size
      } catch {}
    }
  } catch {}
  return size
}

export function setupServerHandlers(ipcMain, getWindow) {
  ipcMain.handle('server:start', async (_, { serverName }) => {
    if (serverProcess) return { ok: false, error: 'Сервер уже запущен' }

    const serverDir = join(getServersDir(), serverName)
    const jarPath = findServerJar(serverDir)
    if (!jarPath) return { ok: false, error: 'Файл .jar не найден в папке сервера' }

    // Auto-accept EULA
    const eulaCreated = ensureEula(serverDir)
    if (eulaCreated) {
      getWindow()?.webContents.send('server:log', {
        type: 'sys',
        text: '[ServerMate] EULA принята автоматически\n'
      })
    }

    // Port conflict check
    const port = getServerPort(serverDir)
    const portBusy = await isPortInUse(port)
    if (portBusy) {
      return { ok: false, error: `Порт ${port} уже занят другим процессом.\nПроверь что другой сервер не запущен, или смени порт в Настройках.` }
    }

    const { args: jvmArgs } = getJavaForServer(serverName)

    // Always auto-select best Java — ignore any stored per-server path
    const installations = scanJavaInstallations()
    const requiredMajor = getRequiredJavaFromJar(jarPath)
    let javaExe = 'java'

    if (installations.length > 0) {
      if (requiredMajor) {
        const compatible = installations.find((j) => j.major >= requiredMajor)
        if (compatible) {
          javaExe = compatible.path
          getWindow()?.webContents.send('server:log', {
            type: 'sys',
            text: `[ServerMate] Автовыбор Java ${compatible.major} (требуется Java ${requiredMajor}+)\n`
          })
        } else {
          return {
            ok: false,
            error: `Для этого сервера нужна Java ${requiredMajor}+, но установлена только Java ${installations[0].major}.\nОткрой вкладку Java и установи нужную версию.`
          }
        }
      } else {
        // Can't detect — use highest available
        javaExe = installations[0].path
        getWindow()?.webContents.send('server:log', {
          type: 'sys',
          text: `[ServerMate] Автовыбор Java ${installations[0].major}\n`
        })
      }
    }

    const jarFilename = require('path').basename(jarPath)
    const spawnArgs = [...jvmArgs, '-jar', jarFilename, 'nogui']
    serverProcess = spawn(javaExe, spawnArgs, { cwd: serverDir })
    runningServerName = serverName

    serverProcess.stdout.on('data', (data) => {
      getWindow()?.webContents.send('server:log', { type: 'out', text: data.toString() })
    })
    serverProcess.stderr.on('data', (data) => {
      getWindow()?.webContents.send('server:log', { type: 'err', text: data.toString() })
    })
    serverProcess.on('close', (code) => {
      serverProcess = null
      runningServerName = null
      getWindow()?.webContents.send('server:stopped', { code })
    })

    return { ok: true }
  })

  ipcMain.handle('server:stop', async () => {
    if (!serverProcess) return { ok: false, error: 'Сервер не запущен' }
    serverProcess.stdin.write('stop\n')
    return { ok: true }
  })

  ipcMain.handle('server:kill', async () => {
    if (!serverProcess) return { ok: false }
    serverProcess.kill('SIGKILL')
    serverProcess = null
    return { ok: true }
  })

  ipcMain.handle('server:command', async (_, cmd) => {
    if (!serverProcess) return { ok: false }
    serverProcess.stdin.write(cmd + '\n')
    return { ok: true }
  })

  ipcMain.handle('server:status', () => ({ running: serverProcess !== null, name: runningServerName }))

  // RAM stats for the running java process
  ipcMain.handle('server:getStats', async () => {
    if (!serverProcess?.pid) return null
    const pid = serverProcess.pid

    if (process.platform === 'win32') {
      return new Promise((resolve) => {
        const wmic = spawn('wmic', ['process', 'where', `ProcessId=${pid}`, 'get', 'WorkingSetSize,PageFileUsage', '/value'], {
          windowsHide: true, shell: false
        })
        let out = ''
        wmic.stdout.on('data', d => (out += d.toString()))
        wmic.on('close', () => {
          const ws = out.match(/WorkingSetSize=(\d+)/)
          const pf = out.match(/PageFileUsage=(\d+)/)
          if (!ws) return resolve(null)
          resolve({
            ramBytes: parseInt(ws[1]),
            virtualBytes: pf ? parseInt(pf[1]) * 1024 : null,
            pid,
          })
        })
        wmic.on('error', () => resolve(null))
      })
    }

    // Linux/macOS: read from /proc/<pid>/status or use ps
    if (process.platform === 'linux') {
      try {
        const { execSync } = require('child_process')
        const { readFileSync } = require('fs')
        const status = readFileSync(`/proc/${pid}/status`, 'utf-8')
        const vmRss = status.match(/VmRSS:\s+(\d+)\s+kB/)
        const vmVirt = status.match(/VmSize:\s+(\d+)\s+kB/)
        if (!vmRss) return null
        return {
          ramBytes: parseInt(vmRss[1]) * 1024,
          virtualBytes: vmVirt ? parseInt(vmVirt[1]) * 1024 : null,
          pid,
        }
      } catch { return null }
    }

    // macOS
    try {
      const { execSync } = require('child_process')
      const out = execSync(`ps -o rss= -p ${pid}`, { timeout: 2000 }).toString().trim()
      const rss = parseInt(out)
      if (isNaN(rss)) return null
      return { ramBytes: rss * 1024, virtualBytes: null, pid }
    } catch { return null }
  })

  ipcMain.handle('server:list', async () => {
    const { readdirSync, statSync } = await import('fs')
    const dir = getServersDir()
    mkdirSync(dir, { recursive: true })
    return readdirSync(dir)
      .filter((name) => statSync(join(dir, name)).isDirectory())
      .map((name) => {
        const jar = findServerJar(join(dir, name))
        return {
          name,
          hasJar: !!jar,
          jarName: jar ? require('path').basename(jar) : null,
          ...readMeta(name),
        }
      })
  })

  ipcMain.handle('server:create', async (_, { name }) => {
    const dir = join(getServersDir(), name)
    if (existsSync(dir)) return { ok: false, error: `Сервер с именем «${name}» уже существует` }
    mkdirSync(dir, { recursive: true })
    return { ok: true, path: dir }
  })

  // Merge meta instead of overwrite
  ipcMain.handle('server:saveMeta', (_, { serverName, meta }) => {
    const existing = readMeta(serverName)
    writeMeta(serverName, { ...existing, ...meta })
    return { ok: true }
  })

  ipcMain.handle('server:getDir', (_, name) => join(getServersDir(), name))

  ipcMain.handle('server:getLocalIp', () => getLocalIp())

  ipcMain.handle('server:delete', async (_, serverName) => {
    if (serverProcess) return { ok: false, error: 'Сначала останови сервер' }
    const dir = join(getServersDir(), serverName)
    if (!existsSync(dir)) return { ok: false, error: 'Папка не найдена' }
    try {
      rmSync(dir, { recursive: true, force: true })
      const cfg = readConfig()
      if (cfg.javaPerServer?.[serverName]) delete cfg.javaPerServer[serverName]
      if (cfg.javaArgs?.[serverName]) delete cfg.javaArgs[serverName]
      writeConfig(cfg)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('server:rename', (_, { oldName, newName }) => {
    if (serverProcess) return { ok: false, error: 'Сначала останови сервер' }
    const oldDir = join(getServersDir(), oldName)
    const newDir = join(getServersDir(), newName)
    if (existsSync(newDir)) return { ok: false, error: `Сервер «${newName}» уже существует` }
    try {
      renameSync(oldDir, newDir)
      const cfg = readConfig()
      if (cfg.javaPerServer?.[oldName]) {
        cfg.javaPerServer[newName] = cfg.javaPerServer[oldName]
        delete cfg.javaPerServer[oldName]
      }
      if (cfg.javaArgs?.[oldName]) {
        cfg.javaArgs[newName] = cfg.javaArgs[oldName]
        delete cfg.javaArgs[oldName]
      }
      writeConfig(cfg)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('server:openFolder', (_, serverName) => {
    const { shell } = require('electron')
    shell.openPath(join(getServersDir(), serverName))
    return { ok: true }
  })

  // Backup world folder → backups/world-YYYY-MM-DD-HH-MM.zip
  ipcMain.handle('server:backup', async (_, serverName) => {
    const serverDir = join(getServersDir(), serverName)
    const worldDir = join(serverDir, 'world')
    if (!existsSync(worldDir)) return { ok: false, error: 'Папка world не найдена — запусти сервер хотя бы раз' }

    const backupsDir = join(serverDir, 'backups')
    mkdirSync(backupsDir, { recursive: true })

    const ts = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '-')
    const dest = join(backupsDir, `world-${ts}.zip`)

    try {
      await zipDir(worldDir, dest)
      return { ok: true, path: dest, filename: `world-${ts}.zip` }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // List backups for a server
  ipcMain.handle('server:listBackups', (_, serverName) => {
    const { readdirSync, statSync } = require('fs')
    const backupsDir = join(getServersDir(), serverName, 'backups')
    if (!existsSync(backupsDir)) return []
    try {
      return readdirSync(backupsDir)
        .filter(f => f.endsWith('.zip'))
        .map(f => {
          const full = join(backupsDir, f)
          const stat = statSync(full)
          return { filename: f, path: full, size: stat.size, createdAt: stat.mtime.toISOString() }
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    } catch { return [] }
  })

  // Open backups folder
  ipcMain.handle('server:openBackupsFolder', (_, serverName) => {
    const { shell } = require('electron')
    const backupsDir = join(getServersDir(), serverName, 'backups')
    mkdirSync(backupsDir, { recursive: true })
    shell.openPath(backupsDir)
    return { ok: true }
  })

  // Delete a backup file
  ipcMain.handle('server:deleteBackup', (_, { serverName, filename }) => {
    const { unlinkSync } = require('fs')
    const filePath = join(getServersDir(), serverName, 'backups', filename)
    try {
      unlinkSync(filePath)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // Crash reports
  ipcMain.handle('server:listCrashReports', (_, serverName) => {
    const dir = join(getServersDir(), serverName, 'crash-reports')
    if (!existsSync(dir)) return []
    try {
      const { statSync } = require('fs')
      return readdirSync(dir)
        .filter(f => f.endsWith('.txt'))
        .map(f => {
          const full = join(dir, f)
          const stat = statSync(full)
          return { filename: f, size: stat.size, createdAt: stat.mtime.toISOString() }
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    } catch { return [] }
  })

  ipcMain.handle('server:readCrashReport', (_, { serverName, filename }) => {
    const filePath = join(getServersDir(), serverName, 'crash-reports', filename)
    try { return { ok: true, content: readFileSync(filePath, 'utf-8') } }
    catch (e) { return { ok: false, error: e.message } }
  })

  // Worlds
  ipcMain.handle('server:listWorlds', (_, serverName) => {
    const serverDir = join(getServersDir(), serverName)
    try {
      const { statSync } = require('fs')
      return readdirSync(serverDir)
        .filter(name => {
          try {
            return statSync(join(serverDir, name)).isDirectory() &&
              existsSync(join(serverDir, name, 'level.dat'))
          } catch { return false }
        })
        .map(name => ({ name, size: getDirSize(join(serverDir, name)) }))
    } catch { return [] }
  })

  ipcMain.handle('server:deleteWorld', (_, { serverName, worldName }) => {
    if (serverProcess) return { ok: false, error: 'Сначала останови сервер' }
    const worldPath = join(getServersDir(), serverName, worldName)
    try { rmSync(worldPath, { recursive: true, force: true }); return { ok: true } }
    catch (e) { return { ok: false, error: e.message } }
  })

  // Export server as zip
  ipcMain.handle('server:export', async (_, serverName) => {
    const { dialog } = require('electron')
    const serverDir = join(getServersDir(), serverName)
    const result = await dialog.showSaveDialog({
      defaultPath: `${serverName}.zip`,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
    })
    if (result.canceled) return { ok: false, canceled: true }
    const dest = result.filePath
    try {
      await zipDir(serverDir, dest)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // Check for Paper updates
  ipcMain.handle('server:checkUpdate', async (_, serverName) => {
    const meta = readMeta(serverName)
    if (meta.core !== 'paper' || !meta.mcVersion) return { available: false, reason: 'not_paper' }
    try {
      const https = require('https')
      const data = await new Promise((resolve, reject) => {
        https.get(`https://api.papermc.io/v2/projects/paper/versions/${meta.mcVersion}`, { timeout: 5000 }, res => {
          let body = ''
          res.on('data', d => body += d)
          res.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error('parse')) } })
        }).on('error', reject).on('timeout', () => reject(new Error('timeout')))
      })
      const builds = data.builds
      if (!builds || builds.length === 0) return { available: false }
      const latestBuild = builds[builds.length - 1]
      const serverDir = join(getServersDir(), serverName)
      const jar = findServerJar(serverDir)
      const jarName = jar ? require('path').basename(jar) : ''
      const match = jarName.match(/paper-[\d.]+-(\d+)\.jar/)
      const currentBuild = match ? parseInt(match[1]) : null
      return {
        available: currentBuild !== null && latestBuild > currentBuild,
        current: currentBuild,
        latest: latestBuild,
        mcVersion: meta.mcVersion,
      }
    } catch { return { available: false } }
  })

  // Show folder picker dialog
  ipcMain.handle('server:showFolderDialog', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  // Import existing server folder
  ipcMain.handle('server:import', async (_, { sourcePath, serverName }) => {
    const dest = join(getServersDir(), serverName)
    if (existsSync(dest)) return { ok: false, error: `Сервер «${serverName}» уже существует` }
    try {
      cpSync(sourcePath, dest, { recursive: true })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })
}
