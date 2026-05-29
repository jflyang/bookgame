import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { join, resolve } from "node:path";
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { fork, type ChildProcess } from "node:child_process";

// ===== Constants =====
const APP_NAME = "互动故事游戏";
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const BACKEND_START_TIMEOUT = 15_000;

// ===== Paths =====
function getAppDataDir(): string {
  const dir = join(app.getPath("userData"), "game-data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getResourcesDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath);
  }
  // Dev mode: point to the actual project directories
  return resolve(__dirname, "../../../..");
}

function getConfigPath(): string {
  return join(getAppDataDir(), "config.json");
}

function getLogDir(): string {
  const dir = join(getAppDataDir(), "logs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ===== Config =====
interface AppConfig {
  apiKey?: string;
  llmProvider?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  windowBounds?: { x: number; y: number; width: number; height: number };
}

function loadConfig(): AppConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(config: AppConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

// ===== Data Initialization =====
function initializeData(): void {
  const appDataDir = getAppDataDir();
  const taskPackagesDir = join(appDataDir, "task-packages");
  const savesDir = join(appDataDir, "saves");

  // Create saves directory
  if (!existsSync(savesDir)) mkdirSync(savesDir, { recursive: true });

  // Copy bundled story packages on first run (don't overwrite existing)
  if (!existsSync(taskPackagesDir)) {
    const resourcesDir = getResourcesDir();
    const bundledPackages = app.isPackaged
      ? join(resourcesDir, "data", "task-packages")
      : join(resourcesDir, "apps", "data", "task-packages");

    if (existsSync(bundledPackages)) {
      cpSync(bundledPackages, taskPackagesDir, { recursive: true });
      log("Copied bundled story packages to app data");
    } else {
      mkdirSync(taskPackagesDir, { recursive: true });
      log("Created empty task-packages directory");
    }
  }
}

// ===== Logging =====
function log(message: string, level: "info" | "error" | "warn" = "info"): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  console.log(line.trim());
  try {
    const logFile = join(getLogDir(), `app-${new Date().toISOString().slice(0, 10)}.log`);
    writeFileSync(logFile, line, { flag: "a" });
  } catch { /* ignore log write failures */ }
}

// ===== Backend Process =====
let backendProcess: ChildProcess | null = null;
let backendPort: number = 4000;

async function findAvailablePort(): Promise<number> {
  // Simple port finder: try ports starting from 4000
  const net = await import("node:net");
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 4000;
      server.close(() => resolve(port));
    });
    server.on("error", () => resolve(4000 + Math.floor(Math.random() * 1000)));
  });
}

async function startBackend(): Promise<number> {
  const port = await findAvailablePort();
  backendPort = port;

  const appDataDir = getAppDataDir();
  const config = loadConfig();

  // Set environment variables for the backend
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PORT: String(port),
    HOST: "127.0.0.1",
    LOG_LEVEL: "info",
    GAME_DATA_DIR: appDataDir,
    WEB_ORIGIN: `http://127.0.0.1:${port}`,
    NODE_ENV: "production",
  };

  // Write LLM config to data dir so backend picks it up
  const llmConfigPath = join(appDataDir, "llm-config.json");
  if (config.apiKey) {
    const llmConfig = {
      provider: config.llmProvider || "deepseek",
      baseUrl: config.llmBaseUrl || "https://api.deepseek.com",
      model: config.llmModel || "deepseek-chat",
      temperature: 0.8,
      maxTokens: 4000,
      apiKey: config.apiKey,
    };
    writeFileSync(llmConfigPath, JSON.stringify(llmConfig, null, 2), "utf-8");
  }

  // Determine backend entry point
  const resourcesDir = getResourcesDir();
  const backendEntry = app.isPackaged
    ? join(resourcesDir, "api", "server.js")
    : join(resourcesDir, "apps", "api", "dist", "server.js");

  if (!existsSync(backendEntry)) {
    throw new Error(`Backend entry not found: ${backendEntry}. Please run 'npm run build' first.`);
  }

  log(`Starting backend on port ${port}, entry: ${backendEntry}`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Backend failed to start within ${BACKEND_START_TIMEOUT}ms`));
    }, BACKEND_START_TIMEOUT);

    backendProcess = fork(backendEntry, [], {
      env,
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      cwd: app.isPackaged ? join(resourcesDir, "api") : join(resourcesDir, "apps", "api"),
    });

    backendProcess.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (text.includes("Server listening") || text.includes(`${port}`)) {
        clearTimeout(timeout);
        log(`Backend started on port ${port}`);
        resolve(port);
      }
    });

    backendProcess.stderr?.on("data", (data: Buffer) => {
      log(`Backend stderr: ${data.toString().trim()}`, "warn");
    });

    backendProcess.on("error", (err) => {
      clearTimeout(timeout);
      log(`Backend process error: ${err.message}`, "error");
      reject(err);
    });

    backendProcess.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        log(`Backend exited with code ${code}`, "error");
      }
      backendProcess = null;
    });

    // Fallback: check if port is responding after a delay
    setTimeout(async () => {
      try {
        const resp = await fetch(`http://127.0.0.1:${port}/health`);
        if (resp.ok) {
          clearTimeout(timeout);
          resolve(port);
        }
      } catch { /* not ready yet */ }
    }, 3000);
  });
}

function stopBackend(): void {
  if (backendProcess) {
    log("Stopping backend...");
    backendProcess.kill("SIGTERM");
    setTimeout(() => {
      if (backendProcess) {
        backendProcess.kill("SIGKILL");
        backendProcess = null;
      }
    }, 5000);
  }
}

// ===== Window =====
let mainWindow: BrowserWindow | null = null;

function createWindow(port: number): void {
  const config = loadConfig();
  const bounds = config.windowBounds ?? { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };

  mainWindow = new BrowserWindow({
    ...bounds,
    title: APP_NAME,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "../preload/index.js"),
    },
    show: false,
  });

  // Load frontend from backend (which serves static files in production)
  const url = `http://127.0.0.1:${port}`;
  mainWindow.loadURL(url);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Save window bounds on close
  mainWindow.on("close", () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      const config = loadConfig();
      config.windowBounds = bounds;
      saveConfig(config);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Block external navigation
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ===== IPC Handlers =====
function setupIPC(): void {
  ipcMain.handle("get-config", () => {
    const config = loadConfig();
    return { ...config, apiKey: config.apiKey ? "***configured***" : "" };
  });

  ipcMain.handle("save-api-key", (_event, apiKey: string) => {
    const config = loadConfig();
    config.apiKey = apiKey;
    saveConfig(config);
    return { ok: true };
  });

  ipcMain.handle("get-log-dir", () => getLogDir());

  ipcMain.handle("open-log-dir", () => {
    shell.openPath(getLogDir());
  });

  ipcMain.handle("get-backend-port", () => backendPort);
}

// ===== Single Instance =====
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ===== App Lifecycle =====
app.whenReady().then(async () => {
  log("Application starting...");

  setupIPC();
  initializeData();

  // Check if API key is configured
  const config = loadConfig();
  if (!config.apiKey) {
    log("No API key configured, will show settings prompt");
  }

  try {
    const port = await startBackend();
    createWindow(port);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Failed to start: ${message}`, "error");
    dialog.showErrorBox("启动失败", `后端服务启动失败：${message}\n\n请确保已正确构建项目。`);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  stopBackend();
  app.quit();
});

app.on("before-quit", () => {
  stopBackend();
});
