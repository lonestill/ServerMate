import https from 'https'
import http from 'http'
import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const UA = 'ServerMate/1.0 (github.com/servermate)'

function getServerDir(name) {
  return join(app.getPath('userData'), 'servers', name)
}

function fetchJson(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      timeout: 20000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        return fetchJson(res.headers.location, retries).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
    req.on('error', (e) => {
      if (retries > 0 && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'].includes(e.code)) {
        setTimeout(() => fetchJson(url, retries - 1).then(resolve).catch(reject), 800)
      } else {
        reject(e)
      }
    })
  })
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { headers: { 'User-Agent': UA }, timeout: 60000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      const file = createWriteStream(dest)
      res.on('data', chunk => {
        received += chunk.length
        if (total > 0) onProgress(Math.round(received / total * 100))
      })
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', (e) => { file.close(); reject(e) })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')) })
    req.on('error', reject)
  })
}

// ─── Modrinth ───────────────────────────────────────────────────────────────

async function searchModrinth(query, projectType, mcVersion) {
  const facets = [[`project_type:${projectType}`]]
  if (mcVersion) facets.push([`versions:${mcVersion}`])
  const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=${encodeURIComponent(JSON.stringify(facets))}&limit=20&index=relevance`
  const data = await fetchJson(url)
  return (data.hits || []).map(h => ({
    id: h.project_id,
    slug: h.slug,
    name: h.title,
    description: h.description,
    icon: h.icon_url || null,
    downloads: h.downloads || 0,
    follows: h.follows || 0,
    updated: h.date_modified,
    source: 'modrinth',
    projectType: h.project_type,
    categories: h.categories || [],
    mcVersions: h.versions || [],
    color: h.color || null,
  }))
}

async function getModrinthVersions(projectId, loaders, mcVersion) {
  const params = new URLSearchParams()
  if (loaders?.length) params.set('loaders', JSON.stringify(loaders))
  if (mcVersion) params.set('game_versions', JSON.stringify([mcVersion]))
  const url = `https://api.modrinth.com/v2/project/${projectId}/version?${params}`
  const versions = await fetchJson(url)
  return versions.slice(0, 15).map(v => ({
    id: v.id,
    name: v.name,
    versionNumber: v.version_number,
    mcVersions: v.game_versions || [],
    loaders: v.loaders || [],
    downloads: v.downloads || 0,
    published: v.date_published,
    downloadUrl: v.files?.[0]?.url || null,
    filename: v.files?.[0]?.filename || `${projectId}.jar`,
    changelog: v.changelog || '',
  }))
}

// ─── Hangar ─────────────────────────────────────────────────────────────────

async function searchHangar(query) {
  const url = `https://hangar.papermc.io/api/v1/projects?query=${encodeURIComponent(query)}&limit=20&offset=0`
  const data = await fetchJson(url)
  return (data.result || []).map(p => ({
    id: String(p.id ?? p.namespace?.slug ?? p.name),
    slug: p.namespace?.slug || p.name?.toLowerCase().replace(/\s+/g, '-'),
    author: p.namespace?.owner || p.name,
    name: p.name,
    description: p.description,
    icon: p.avatarUrl || null,
    downloads: p.stats?.downloads || 0,
    follows: p.stats?.stars || 0,
    updated: p.lastUpdated,
    source: 'hangar',
    projectType: 'plugin',
    categories: p.category ? [p.category] : [],
    mcVersions: [],
    color: null,
  }))
}

async function getHangarVersions(author, slug, mcVersion) {
  const url = `https://hangar.papermc.io/api/v1/projects/${author}/${slug}/versions?limit=25&offset=0`
  const data = await fetchJson(url)
  let versions = data.result || []
  if (mcVersion) {
    const filtered = versions.filter(v => (v.platformDependencies?.PAPER || []).includes(mcVersion))
    if (filtered.length > 0) versions = filtered
  }
  return versions.slice(0, 15).map(v => ({
    id: v.name,
    name: v.name,
    versionNumber: v.name,
    mcVersions: v.platformDependencies?.PAPER || [],
    loaders: ['paper'],
    downloads: v.stats?.totalDownloads || 0,
    published: v.createdAt,
    downloadUrl: null,
    filename: `${slug}-${v.name}.jar`,
    changelog: v.description || '',
    _author: author,
    _slug: slug,
  }))
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

export function setupPluginSearchHandlers(ipcMain, getWindow) {
  ipcMain.handle('plugins:search', async (_, { query, source, projectType, mcVersion }) => {
    if (!query?.trim()) return { results: [], errors: [] }
    const results = []
    const errors = []
    const tasks = []

    if (source === 'all' || source === 'modrinth') {
      tasks.push(
        searchModrinth(query.trim(), projectType === 'mod' ? 'mod' : 'plugin', mcVersion)
          .then(r => results.push(...r))
          .catch(e => errors.push('Modrinth: ' + e.message))
      )
    }
    if ((source === 'all' || source === 'hangar') && projectType !== 'mod') {
      tasks.push(
        searchHangar(query.trim())
          .then(r => results.push(...r))
          .catch(e => errors.push('Hangar: ' + e.message))
      )
    }

    await Promise.all(tasks)

    // Deduplicate by name (case-insensitive), prefer Hangar for Paper plugins
    const seen = new Set()
    const deduped = []
    for (const r of results.sort((a, b) => (b.downloads || 0) - (a.downloads || 0))) {
      const key = r.name.toLowerCase().replace(/\s+/g, '')
      if (!seen.has(key)) { seen.add(key); deduped.push(r) }
    }

    return { results: deduped, errors }
  })

  ipcMain.handle('plugins:getVersions', async (_, { source, projectId, slug, author, loaders, mcVersion }) => {
    try {
      if (source === 'modrinth') return await getModrinthVersions(projectId, loaders, mcVersion)
      if (source === 'hangar') return await getHangarVersions(author, slug, mcVersion)
    } catch (e) {
      return []
    }
    return []
  })

  ipcMain.handle('plugins:install', async (_, { serverName, downloadUrl, filename, source, author, slug, versionId }) => {
    const win = getWindow()
    const serverDir = getServerDir(serverName)

    // Detect correct install dir (plugins/ or mods/)
    const modsDir = join(serverDir, 'mods')
    const pluginsDir = join(serverDir, 'plugins')
    const installDir = existsSync(modsDir) && !existsSync(pluginsDir) ? modsDir : pluginsDir
    mkdirSync(installDir, { recursive: true })

    // Resolve Hangar download URL
    let finalUrl = downloadUrl
    if (source === 'hangar' && !finalUrl) {
      finalUrl = `https://hangar.papermc.io/api/v1/projects/${author}/${slug}/versions/${encodeURIComponent(versionId)}/PAPER/download`
    }

    const safeFilename = (filename || `${slug || 'plugin'}.jar`).replace(/[^\w.\-]/g, '_')
    const dest = join(installDir, safeFilename)

    try {
      win?.webContents.send('plugins:progress', { pct: 0, filename: safeFilename })
      await downloadFile(finalUrl, dest, (pct) => {
        win?.webContents.send('plugins:progress', { pct, filename: safeFilename })
      })
      win?.webContents.send('plugins:progress', { pct: 100, filename: safeFilename })
      return { ok: true, filename: safeFilename }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // Check which plugins are installed (by filename match in plugins/ dir)
  ipcMain.handle('plugins:listInstalled', (_, serverName) => {
    const serverDir = getServerDir(serverName)
    const dirs = [join(serverDir, 'plugins'), join(serverDir, 'mods')]
    const files = new Set()
    for (const dir of dirs) {
      if (!existsSync(dir)) continue
      try {
        const { readdirSync } = require('fs')
        for (const f of readdirSync(dir)) {
          if (f.endsWith('.jar') || f.endsWith('.jar.disabled')) files.add(f.toLowerCase())
        }
      } catch {}
    }
    return [...files]
  })
}
