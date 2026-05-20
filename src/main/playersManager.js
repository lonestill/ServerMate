import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

function getServerDir(name) {
  return join(app.getPath('userData'), 'servers', name)
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return [] }
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2))
}

export function setupPlayersHandlers(ipcMain) {
  ipcMain.handle('players:getAll', (_, serverName) => {
    const dir = getServerDir(serverName)
    return {
      whitelist: existsSync(join(dir, 'whitelist.json')) ? readJson(join(dir, 'whitelist.json')) : null,
      ops: existsSync(join(dir, 'ops.json')) ? readJson(join(dir, 'ops.json')) : null,
      banned: existsSync(join(dir, 'banned-players.json')) ? readJson(join(dir, 'banned-players.json')) : null,
      bannedIps: existsSync(join(dir, 'banned-ips.json')) ? readJson(join(dir, 'banned-ips.json')) : null,
    }
  })

  ipcMain.handle('players:addWhitelist', (_, { serverName, playerName }) => {
    const path = join(getServerDir(serverName), 'whitelist.json')
    const list = readJson(path)
    if (!list.find(p => p.name?.toLowerCase() === playerName.toLowerCase())) {
      list.push({ uuid: '', name: playerName })
      writeJson(path, list)
    }
    return { ok: true }
  })

  ipcMain.handle('players:removeWhitelist', (_, { serverName, playerName }) => {
    const path = join(getServerDir(serverName), 'whitelist.json')
    writeJson(path, readJson(path).filter(p => p.name !== playerName))
    return { ok: true }
  })

  ipcMain.handle('players:removeOp', (_, { serverName, playerName }) => {
    const path = join(getServerDir(serverName), 'ops.json')
    writeJson(path, readJson(path).filter(p => p.name !== playerName))
    return { ok: true }
  })

  ipcMain.handle('players:removeBan', (_, { serverName, playerName }) => {
    const path = join(getServerDir(serverName), 'banned-players.json')
    writeJson(path, readJson(path).filter(p => p.name !== playerName))
    return { ok: true }
  })

  ipcMain.handle('players:removeBannedIp', (_, { serverName, ip }) => {
    const path = join(getServerDir(serverName), 'banned-ips.json')
    writeJson(path, readJson(path).filter(p => p.ip !== ip))
    return { ok: true }
  })
}
