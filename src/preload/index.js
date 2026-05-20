import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Server lifecycle
  startServer: (opts) => ipcRenderer.invoke('server:start', opts),
  stopServer: () => ipcRenderer.invoke('server:stop'),
  killServer: () => ipcRenderer.invoke('server:kill'),
  sendCommand: (cmd) => ipcRenderer.invoke('server:command', cmd),
  getStatus: () => ipcRenderer.invoke('server:status'),
  listServers: () => ipcRenderer.invoke('server:list'),
  createServer: (opts) => ipcRenderer.invoke('server:create', opts),
  saveMeta: (serverName, meta) => ipcRenderer.invoke('server:saveMeta', { serverName, meta }),
  getServerDir: (name) => ipcRenderer.invoke('server:getDir', name),
  getLocalIp: () => ipcRenderer.invoke('server:getLocalIp'),
  deleteServer: (name) => ipcRenderer.invoke('server:delete', name),
  renameServer: (oldName, newName) => ipcRenderer.invoke('server:rename', { oldName, newName }),
  openServerFolder: (name) => ipcRenderer.invoke('server:openFolder', name),
  backupWorld: (name) => ipcRenderer.invoke('server:backup', name),
  listBackups: (name) => ipcRenderer.invoke('server:listBackups', name),
  openBackupsFolder: (name) => ipcRenderer.invoke('server:openBackupsFolder', name),
  deleteBackup: (serverName, filename) => ipcRenderer.invoke('server:deleteBackup', { serverName, filename }),
  showFolderDialog: () => ipcRenderer.invoke('server:showFolderDialog'),
  importServer: (opts) => ipcRenderer.invoke('server:import', opts),

  // Downloads
  getVanillaVersions: () => ipcRenderer.invoke('download:vanillaVersions'),
  getPaperVersions: () => ipcRenderer.invoke('download:paperVersions'),
  getFabricVersions: () => ipcRenderer.invoke('download:fabricVersions'),
  downloadVanilla: (opts) => ipcRenderer.invoke('download:vanilla', opts),
  downloadPaper: (opts) => ipcRenderer.invoke('download:paper', opts),
  downloadFabric: (opts) => ipcRenderer.invoke('download:fabric', opts),

  // Properties
  readProps: (name) => ipcRenderer.invoke('props:read', name),
  writeProps: (name, props) => ipcRenderer.invoke('props:write', { serverName: name, props }),

  // Java
  getJavaInstallations: () => ipcRenderer.invoke('java:scan'),
  detectRequiredJava: (jarPath) => ipcRenderer.invoke('java:detectRequired', jarPath),
  getInstallableJavaVersions: () => ipcRenderer.invoke('java:getInstallableVersions'),
  installJava: (opts) => ipcRenderer.invoke('java:install', opts),
  onJavaInstallProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('java:installProgress', handler)
    return () => ipcRenderer.removeListener('java:installProgress', handler)
  },
  getJavaForServer: (name) => ipcRenderer.invoke('java:getForServer', name),
  setJavaForServer: (name, path) => ipcRenderer.invoke('java:setForServer', { serverName: name, javaPath: path }),
  getJavaArgs: (name) => ipcRenderer.invoke('java:getArgs', name),
  setJavaArgs: (name, args) => ipcRenderer.invoke('java:setArgs', { serverName: name, args }),

  // Players
  getPlayers: (name) => ipcRenderer.invoke('players:getAll', name),
  addWhitelist: (serverName, playerName) => ipcRenderer.invoke('players:addWhitelist', { serverName, playerName }),
  removeWhitelist: (serverName, playerName) => ipcRenderer.invoke('players:removeWhitelist', { serverName, playerName }),
  removeOp: (serverName, playerName) => ipcRenderer.invoke('players:removeOp', { serverName, playerName }),
  removeBan: (serverName, playerName) => ipcRenderer.invoke('players:removeBan', { serverName, playerName }),
  removeBannedIp: (serverName, ip) => ipcRenderer.invoke('players:removeBannedIp', { serverName, ip }),

  // Plugin marketplace
  searchPlugins: (opts) => ipcRenderer.invoke('plugins:search', opts),
  getPluginVersions: (opts) => ipcRenderer.invoke('plugins:getVersions', opts),
  installPlugin: (opts) => ipcRenderer.invoke('plugins:install', opts),
  listInstalledPlugins: (name) => ipcRenderer.invoke('plugins:listInstalled', name),
  onPluginProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('plugins:progress', handler)
    return () => ipcRenderer.removeListener('plugins:progress', handler)
  },

  // Mods / Plugins
  listMods: (name) => ipcRenderer.invoke('mods:list', name),
  toggleMod: (serverName, filename) => ipcRenderer.invoke('mods:toggle', { serverName, filename }),
  deleteMod: (serverName, filename) => ipcRenderer.invoke('mods:delete', { serverName, filename }),
  openModsFolder: (name) => ipcRenderer.invoke('mods:openFolder', name),
  listConfigs: (name) => ipcRenderer.invoke('mods:listConfigs', name),
  readConfig: (filePath) => ipcRenderer.invoke('mods:readConfig', filePath),
  writeConfig: (filePath, content) => ipcRenderer.invoke('mods:writeConfig', { filePath, content }),
  openConfigFile: (filePath) => ipcRenderer.invoke('mods:openConfigFile', filePath),

  // Crash reports
  listCrashReports: (name) => ipcRenderer.invoke('server:listCrashReports', name),
  readCrashReport: (serverName, filename) => ipcRenderer.invoke('server:readCrashReport', { serverName, filename }),

  // Worlds
  listWorlds: (name) => ipcRenderer.invoke('server:listWorlds', name),
  deleteWorld: (serverName, worldName) => ipcRenderer.invoke('server:deleteWorld', { serverName, worldName }),

  // Export & update
  exportServer: (name) => ipcRenderer.invoke('server:export', name),
  checkServerUpdate: (name) => ipcRenderer.invoke('server:checkUpdate', name),

  // App-level
  getAppSettings: () => ipcRenderer.invoke('app:getSettings'),
  setAppSettings: (data) => ipcRenderer.invoke('app:setSettings', data),
  notify: (title, body) => ipcRenderer.invoke('app:notify', { title, body }),
  setRunningServer: (name) => ipcRenderer.invoke('app:setRunningServer', name),
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // Process stats
  getServerStats: () => ipcRenderer.invoke('server:getStats'),

  // Events
  onLog: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('server:log', handler)
    return () => ipcRenderer.removeListener('server:log', handler)
  },
  onStopped: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('server:stopped', handler)
    return () => ipcRenderer.removeListener('server:stopped', handler)
  },
  onDownloadProgress: (cb) => {
    const handler = (_, pct) => cb(pct)
    ipcRenderer.on('download:progress', handler)
    return () => ipcRenderer.removeListener('download:progress', handler)
  },
})
