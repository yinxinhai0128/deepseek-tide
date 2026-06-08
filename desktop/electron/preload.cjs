const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("whale", {
  chooseWorkspace: () => ipcRenderer.invoke("workspace:choose"),
  setWorkspace: (workspace) => ipcRenderer.invoke("workspace:set", workspace),
  getWorkspace: () => ipcRenderer.invoke("workspace:get"),
  chooseAttachments: () => ipcRenderer.invoke("attachments:choose"),
  importAttachments: (sources) => ipcRenderer.invoke("attachments:import", sources),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getStatus: () => ipcRenderer.invoke("runtime:status"),
  getPerformance: (model) => ipcRenderer.invoke("runtime:performance", model),
  checkForUpdates: () => ipcRenderer.invoke("runtime:update-check"),
  applyRuntimeUpdate: () => ipcRenderer.invoke("runtime:update-apply"),
  saveApiKey: (apiKey) => ipcRenderer.invoke("auth:save", apiKey),
  clearApiKey: () => ipcRenderer.invoke("auth:clear"),
  listFiles: (workspace) => ipcRenderer.invoke("workspace:files", workspace),
  gitStatus: (workspace) => ipcRenderer.invoke("git:status", workspace),
  gitDiff: (workspace) => ipcRenderer.invoke("git:diff", workspace),
  startTurn: (payload) => ipcRenderer.invoke("agent:start", payload),
  stopTurn: () => ipcRenderer.invoke("agent:stop"),
  onAgentEvent: (listener) => {
    const wrapped = (_event, value) => listener(value);
    ipcRenderer.on("agent:event", wrapped);
    return () => ipcRenderer.removeListener("agent:event", wrapped);
  },
  platform: process.platform
});
