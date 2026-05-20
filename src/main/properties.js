import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

function getServerPropsPath(serverName) {
  return join(app.getPath('userData'), 'servers', serverName, 'server.properties')
}

function parseProperties(text) {
  const result = {}
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.includes('=')) continue
    const [key, ...rest] = line.split('=')
    result[key.trim()] = rest.join('=').trim()
  }
  return result
}

function serializeProperties(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n'
}

export function setupPropertiesHandlers(ipcMain) {
  ipcMain.handle('props:read', (_, serverName) => {
    const path = getServerPropsPath(serverName)
    if (!existsSync(path)) return null
    return parseProperties(readFileSync(path, 'utf-8'))
  })

  ipcMain.handle('props:write', (_, { serverName, props }) => {
    const path = getServerPropsPath(serverName)
    writeFileSync(path, serializeProperties(props))
    return { ok: true }
  })
}
