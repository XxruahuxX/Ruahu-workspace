const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zona', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  term: {
    start: (cols, rows) => ipcRenderer.send('term:start', cols, rows),
    input: (data) => ipcRenderer.send('term:input', data),
    resize: (cols, rows) => ipcRenderer.send('term:resize', cols, rows),
    onData: (cb) => ipcRenderer.on('term:data', (_e, data) => cb(data))
  }
});
