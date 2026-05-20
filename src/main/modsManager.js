import { readdirSync, existsSync, renameSync, unlinkSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, shell } from 'electron'

function getServerDir(name) {
  return join(app.getPath('userData'), 'servers', name)
}

function getModsDir(serverName) {
  const serverDir = getServerDir(serverName)
  const pluginsDir = join(serverDir, 'plugins')
  const modsDir = join(serverDir, 'mods')
  if (existsSync(pluginsDir)) return { dir: pluginsDir, type: 'plugins' }
  if (existsSync(modsDir)) return { dir: modsDir, type: 'mods' }
  return null
}

export function setupModsHandlers(ipcMain) {
  ipcMain.handle('mods:list', (_, serverName) => {
    const info = getModsDir(serverName)
    if (!info) return { type: null, mods: [], dir: null }
    try {
      const files = readdirSync(info.dir)
      const mods = files
        .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
        .map(f => ({
          filename: f,
          name: f.replace(/\.jar(\.disabled)?$/, '').replace(/[-_](\d[\d.]*(-[a-zA-Z0-9]+)?)$/, ' $1').trim(),
          rawName: f.replace(/\.jar(\.disabled)?$/, ''),
          enabled: !f.endsWith('.disabled'),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return { type: info.type, mods, dir: info.dir }
    } catch {
      return { type: info.type, mods: [], dir: info.dir }
    }
  })

  ipcMain.handle('mods:toggle', (_, { serverName, filename }) => {
    const info = getModsDir(serverName)
    if (!info) return { ok: false, error: 'Папка плагинов не найдена' }
    const src = join(info.dir, filename)
    const dst = filename.endsWith('.disabled')
      ? join(info.dir, filename.replace(/\.disabled$/, ''))
      : join(info.dir, filename + '.disabled')
    try { renameSync(src, dst); return { ok: true, newFilename: require('path').basename(dst) } }
    catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('mods:delete', (_, { serverName, filename }) => {
    const info = getModsDir(serverName)
    if (!info) return { ok: false }
    try { unlinkSync(join(info.dir, filename)); return { ok: true } }
    catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('mods:openFolder', (_, serverName) => {
    const info = getModsDir(serverName)
    shell.openPath(info ? info.dir : getServerDir(serverName))
    return { ok: true }
  })

  // List plugin config files
  ipcMain.handle('mods:listConfigs', (_, serverName) => {
    const serverDir = getServerDir(serverName)
    const configs = []

    // Paper/Bukkit plugins: plugins/<PluginName>/config.yml
    const pluginsDir = join(serverDir, 'plugins')
    if (existsSync(pluginsDir)) {
      try {
        for (const dir of readdirSync(pluginsDir)) {
          const pluginDir = join(pluginsDir, dir)
          try {
            const pluginFiles = readdirSync(pluginDir)
            for (const file of pluginFiles) {
              if (file.endsWith('.yml') || file.endsWith('.yaml') || file.endsWith('.toml') || file.endsWith('.json') || file.endsWith('.conf')) {
                configs.push({ plugin: dir, file, path: join(pluginDir, file) })
              }
            }
          } catch {}
        }
      } catch {}
    }

    // Fabric: config/ folder
    const configDir = join(serverDir, 'config')
    if (existsSync(configDir)) {
      try {
        for (const file of readdirSync(configDir)) {
          if (file.endsWith('.yml') || file.endsWith('.yaml') || file.endsWith('.toml') || file.endsWith('.json') || file.endsWith('.conf') || file.endsWith('.properties')) {
            configs.push({ plugin: 'config', file, path: join(configDir, file) })
          }
        }
      } catch {}
    }

    return configs
  })

  ipcMain.handle('mods:readConfig', (_, filePath) => {
    try { return { ok: true, content: readFileSync(filePath, 'utf-8') } }
    catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('mods:writeConfig', (_, { filePath, content }) => {
    try { writeFileSync(filePath, content); return { ok: true } }
    catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('mods:openConfigFile', (_, filePath) => {
    shell.openPath(filePath)
    return { ok: true }
  })
}
