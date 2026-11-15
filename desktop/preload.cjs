// The bridge between the setup and splash pages and the main process. No Node in the pages.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('terra', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (c) => ipcRenderer.invoke('config:save', c),
  runChecks: (c) => ipcRenderer.send('checks:run', c),
  onCheckLine: (cb) => ipcRenderer.on('checks:line', (_e, row) => cb(row)),
  start: (c) => ipcRenderer.send('demo:start', c),
  reset: () => ipcRenderer.send('demo:reset'),
  showGame: () => ipcRenderer.send('game:show'),
  onState: (cb) => ipcRenderer.on('setup:state', (_e, s) => cb(s)),
  quit: () => ipcRenderer.send('app:quit'),
  // splash
  onSplash: (cb) => ipcRenderer.on('splash', (_e, m) => cb(m)),
  setLogsOpen: (open) => ipcRenderer.send('splash:logs', open),
  logHistory: () => ipcRenderer.invoke('splash:history'),
  backToSetup: () => ipcRenderer.send('splash:back'),
});
