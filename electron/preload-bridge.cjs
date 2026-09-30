'use strict';

/**
 * Plain CJS preload (not Vite-bundled).
 * Requires webPreferences.sandbox = true (Electron default) so require() works.
 */
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  openCsv: () => ipcRenderer.invoke('dialog:openCsv'),
  exportCsv: (content, defaultName) =>
    ipcRenderer.invoke('dialog:exportCsv', content, defaultName),
  readCsv: (filePath) => ipcRenderer.invoke('file:readCsv', filePath),
  saveProgress: (csvPath, data) =>
    ipcRenderer.invoke('progress:save', csvPath, data),
  saveCsv: (csvPath, content) =>
    ipcRenderer.invoke('file:saveCsv', csvPath, content),
  saveCsvSync: (csvPath, content) =>
    ipcRenderer.sendSync('file:saveCsvSync', csvPath, content),
  saveProgressSync: (csvPath, data) =>
    ipcRenderer.sendSync('progress:saveSync', csvPath, data),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  getRecent: () => ipcRenderer.invoke('app:getRecent'),
  addRecent: (filePath) => ipcRenderer.invoke('app:addRecent', filePath),
  onMenuOpen: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('menu:open', handler);
    return () => ipcRenderer.removeListener('menu:open', handler);
  },
  onMenuExport: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('menu:export', handler);
    return () => ipcRenderer.removeListener('menu:export', handler);
  },
  onFlushSave: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:flush-save', handler);
    return () => ipcRenderer.removeListener('app:flush-save', handler);
  },
};

try {
  contextBridge.exposeInMainWorld('maplead', api);
  contextBridge.exposeInMainWorld('mapleadPreloadOk', true);
} catch (err) {
  console.error('[preload] exposeInMainWorld failed', err);
}
