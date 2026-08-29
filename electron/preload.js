const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('superOptimizer', {
  isDesktop: true,
  setOverlay: enabled => ipcRenderer.invoke('overlay:set-enabled', Boolean(enabled)),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  getMetrics: () => ipcRenderer.invoke('metrics:get'),
  getMetricsDiagnostics: () => ipcRenderer.invoke('metrics:diagnostics'),
  getLogDirectory: () => ipcRenderer.invoke('system:log-directory'),
  getWindowsInfo: () => ipcRenderer.invoke('system:windows-info'),
  measurePing: () => ipcRenderer.invoke('network:measure-ping'),
  applyDns: payload => ipcRenderer.invoke('network:apply-dns', payload),
  getStartupEntries: () => ipcRenderer.invoke('system:startup'),
  getHealth: () => ipcRenderer.invoke('system:health'),
  getDrivers: () => ipcRenderer.invoke('system:drivers'),
  cleanMemory: () => ipcRenderer.invoke('memory:clean'),
  applyOptimizations: payload => ipcRenderer.invoke('optimization:apply', payload || {}),
  getOptimizationSessions: () => ipcRenderer.invoke('optimization:sessions'),
  revertOptimization: payload => ipcRenderer.invoke('optimization:revert', payload || {}),
  getRuntimeConfig: () => ipcRenderer.invoke('runtime:config'),
  openExternal: url => ipcRenderer.invoke('external:open', url),
  getRunningGames: () => ipcRenderer.invoke('system:games'),
  runSystemScan: () => ipcRenderer.invoke('system:scan'),
  onMetrics: callback => {
    ipcRenderer.on('metrics:update', (_event, metrics) => callback(metrics));
  }
});
