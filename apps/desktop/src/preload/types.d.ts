export interface ElectronAPI {
  getConfig: () => Promise<{ apiKey?: string; windowBounds?: object }>;
  saveApiKey: (apiKey: string) => Promise<{ ok: boolean }>;
  getLogDir: () => Promise<string>;
  openLogDir: () => Promise<void>;
  getBackendPort: () => Promise<number>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
