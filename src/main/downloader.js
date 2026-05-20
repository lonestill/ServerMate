import { createWriteStream, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import https from 'https'
import http from 'http'

function getServersDir() {
  return join(app.getPath('userData'), 'servers')
}

// Manifest URLs
const VANILLA_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
const PAPER_API = 'https://api.papermc.io/v2/projects/paper'
const FABRIC_META = 'https://meta.fabricmc.net/v2/versions/loader'

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject)
      }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      const file = createWriteStream(dest)
      res.on('data', (chunk) => {
        received += chunk.length
        if (total > 0) onProgress(Math.round((received / total) * 100))
      })
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', reject)
    }).on('error', reject)
  })
}

export function setupDownloadHandlers(ipcMain, getWindow) {
  ipcMain.handle('download:vanillaVersions', async () => {
    const manifest = await fetchJson(VANILLA_MANIFEST)
    return manifest.versions
      .filter((v) => v.type === 'release' || v.type === 'snapshot')
      .map((v) => ({ id: v.id, url: v.url, type: v.type }))
  })

  ipcMain.handle('download:paperVersions', async () => {
    const data = await fetchJson(PAPER_API)
    return [...data.versions].reverse()
  })

  ipcMain.handle('download:fabricVersions', async () => {
    const data = await fetchJson(FABRIC_META)
    // API may return [{loader: {version, stable}}, ...] or [{version, stable}, ...]
    return data
      .filter((v) => v != null)
      .filter((v) => (v.loader ? v.loader.stable : v.stable))
      .slice(0, 15)
      .map((v) => (v.loader ? v.loader.version : v.version))
  })

  ipcMain.handle('download:vanilla', async (_, { serverName, version, versionUrl }) => {
    const win = getWindow()
    const versionMeta = await fetchJson(versionUrl)
    const jarUrl = versionMeta.downloads.server.url
    const serverDir = join(getServersDir(), serverName)
    mkdirSync(serverDir, { recursive: true })
    const dest = join(serverDir, 'server.jar')
    await downloadFile(jarUrl, dest, (pct) => win?.webContents.send('download:progress', pct))

    // Accept EULA automatically
    const { writeFileSync } = await import('fs')
    writeFileSync(join(serverDir, 'eula.txt'), 'eula=true\n')
    return { ok: true }
  })

  ipcMain.handle('download:paper', async (_, { serverName, version }) => {
    const win = getWindow()
    const buildsData = await fetchJson(`${PAPER_API}/versions/${version}/builds`)
    const latest = buildsData.builds.at(-1)
    const fileName = latest.downloads.application.name
    const jarUrl = `${PAPER_API}/versions/${version}/builds/${latest.build}/downloads/${fileName}`
    const serverDir = join(getServersDir(), serverName)
    mkdirSync(serverDir, { recursive: true })
    const dest = join(serverDir, 'server.jar')
    await downloadFile(jarUrl, dest, (pct) => win?.webContents.send('download:progress', pct))
    const { writeFileSync } = await import('fs')
    writeFileSync(join(serverDir, 'eula.txt'), 'eula=true\n')
    return { ok: true }
  })

  ipcMain.handle('download:fabric', async (_, { serverName, mcVersion, loaderVersion }) => {
    const win = getWindow()
    const installerData = await fetchJson('https://meta.fabricmc.net/v2/versions/installer')
    const installer = installerData[0].version
    const jarUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/${installer}/server/jar`
    const serverDir = join(getServersDir(), serverName)
    mkdirSync(serverDir, { recursive: true })
    const dest = join(serverDir, 'server.jar')
    await downloadFile(jarUrl, dest, (pct) => win?.webContents.send('download:progress', pct))
    const { writeFileSync } = await import('fs')
    writeFileSync(join(serverDir, 'eula.txt'), 'eula=true\n')
    return { ok: true }
  })
}
