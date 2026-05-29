import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke("save-api-key", apiKey),
  getLogDir: () => ipcRenderer.invoke("get-log-dir"),
  openLogDir: () => ipcRenderer.invoke("open-log-dir"),
  getBackendPort: () => ipcRenderer.invoke("get-backend-port"),
});
