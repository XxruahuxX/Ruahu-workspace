const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zona', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  on: (channel, cb) => {
    if (['web:open-link', 'ask-claude', 'shortcut'].includes(channel)) ipcRenderer.on(channel, (_e, v) => cb(v));
  },
  fs: {
    pickFolder: () => ipcRenderer.invoke('fs:pick-folder'),
    readDir: (dir) => ipcRenderer.invoke('fs:read-dir', dir),
    readFile: (file) => ipcRenderer.invoke('fs:read-file', file),
    writeFile: (file, text) => ipcRenderer.invoke('fs:write-file', file, text),
    create: (target, isDir) => ipcRenderer.invoke('fs:create', target, isDir)
  },
  term: {
    start: (cols, rows, cwd) => ipcRenderer.send('term:start', cols, rows, cwd),
    input: (data) => ipcRenderer.send('term:input', data),
    resize: (cols, rows) => ipcRenderer.send('term:resize', cols, rows),
    onData: (cb) => ipcRenderer.on('term:data', (_e, data) => cb(data))
  }
});
