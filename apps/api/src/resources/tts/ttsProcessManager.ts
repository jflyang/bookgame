import { spawn, type ChildProcess } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { createModuleLogger } from "../../utils/logger.js";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const logger = createModuleLogger("tts:process");

export type TtsServiceStatus = "stopped" | "starting" | "running" | "error";

interface ProcessState {
  status: TtsServiceStatus;
  pid: number | null;
  startedAt: string | null;
  lastError: string | null;
  logs: string[];
}

/**
 * Manages the CosyVoice TTS Python service process lifecycle.
 * Allows starting/stopping the service from the admin panel.
 */
export class TtsProcessManager {
  private process: ChildProcess | null = null;
  private state: ProcessState = {
    status: "stopped",
    pid: null,
    startedAt: null,
    lastError: null,
    logs: [],
  };
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private readonly maxLogs = 200;

  private get serviceDir(): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // apps/api/src/resources/tts -> project root -> services/tts
    return resolve(__dirname, "../../../../..", "services/tts");
  }

  getStatus(): ProcessState & { serviceDir: string; serviceDirExists: boolean } {
    return {
      ...this.state,
      serviceDir: this.serviceDir,
      serviceDirExists: existsSync(this.serviceDir),
    };
  }

  async start(options?: { port?: number; pythonPath?: string }): Promise<{ ok: boolean; error?: string }> {
    if (this.state.status === "running" || this.state.status === "starting") {
      return { ok: false, error: "服务已在运行中" };
    }

    const serviceDir = this.serviceDir;
    if (!existsSync(serviceDir)) {
      const err = `TTS 服务目录不存在: ${serviceDir}`;
      this.state.lastError = err;
      return { ok: false, error: err };
    }

    const mainPy = join(serviceDir, "main.py");
    if (!existsSync(mainPy)) {
      const err = `main.py 不存在: ${mainPy}`;
      this.state.lastError = err;
      return { ok: false, error: err };
    }

    const port = options?.port || 50001;
    const pythonPath = options?.pythonPath || process.env.TTS_PYTHON_PATH || "python";

    this.state = {
      status: "starting",
      pid: null,
      startedAt: null,
      lastError: null,
      logs: [],
    };

    try {
      const env = {
        ...process.env,
        PORT: String(port),
        PYTHONUNBUFFERED: "1",
      };

      const args = ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", String(port), "--log-level", "info"];

      this.process = spawn(pythonPath, args, {
        cwd: serviceDir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        detached: false,
      });

      const pid = this.process.pid;
      this.state.pid = pid ?? null;
      logger.info({ pid, port, serviceDir }, "TTS service process spawned");

      // Capture stdout
      this.process.stdout?.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          this.appendLog(line);
          // Detect successful startup
          if (line.includes("Uvicorn running") || line.includes("Application startup complete")) {
            this.state.status = "running";
            this.state.startedAt = new Date().toISOString();
            logger.info({ pid }, "TTS service is running");
          }
        }
      });

      // Capture stderr
      this.process.stderr?.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          this.appendLog(`[stderr] ${line}`);
          // Uvicorn logs to stderr by default
          if (line.includes("Uvicorn running") || line.includes("Application startup complete")) {
            this.state.status = "running";
            this.state.startedAt = new Date().toISOString();
            logger.info({ pid }, "TTS service is running");
          }
        }
      });

      // Handle process exit
      this.process.on("exit", (code, signal) => {
        logger.info({ pid, code, signal }, "TTS service process exited");
        this.state.status = "stopped";
        this.state.pid = null;
        if (code !== 0 && code !== null) {
          this.state.lastError = `进程退出，代码: ${code}`;
          this.state.status = "error";
        }
        this.process = null;
        this.stopHealthCheck();
      });

      this.process.on("error", (err) => {
        logger.error({ err }, "TTS service process error");
        this.state.status = "error";
        this.state.lastError = err.message;
        this.process = null;
        this.stopHealthCheck();
      });

      // Start health check polling after a brief delay
      setTimeout(() => this.startHealthCheck(port), 3000);

      // Wait a moment to see if it crashes immediately
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (this.state.status === "error") {
        return { ok: false, error: this.state.lastError || "启动失败" };
      }

      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "启动失败";
      this.state.status = "error";
      this.state.lastError = message;
      logger.error({ err }, "Failed to start TTS service");
      return { ok: false, error: message };
    }
  }

  stop(): { ok: boolean; error?: string } {
    if (!this.process) {
      this.state.status = "stopped";
      return { ok: true };
    }

    try {
      const pid = this.process.pid;
      // Windows doesn't support SIGTERM well, use taskkill
      if (process.platform === "win32" && pid) {
        spawn("taskkill", ["/pid", String(pid), "/f", "/t"], { stdio: "ignore" });
      } else {
        this.process.kill("SIGTERM");
      }
      logger.info({ pid }, "Sent kill signal to TTS service");

      // Force kill after 5 seconds if still alive
      const forceKillTimer = setTimeout(() => {
        if (this.process && this.process.pid) {
          if (process.platform === "win32") {
            spawn("taskkill", ["/pid", String(this.process.pid), "/f", "/t"], { stdio: "ignore" });
          } else {
            this.process.kill("SIGKILL");
          }
          logger.warn({ pid }, "Force killed TTS service");
        }
      }, 5000);

      this.process.on("exit", () => {
        clearTimeout(forceKillTimer);
      });

      this.state.status = "stopped";
      this.state.pid = null;
      this.stopHealthCheck();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "停止失败";
      logger.error({ err }, "Failed to stop TTS service");
      return { ok: false, error: message };
    }
  }

  getLogs(lines?: number): string[] {
    if (lines) return this.state.logs.slice(-lines);
    return [...this.state.logs];
  }

  private appendLog(line: string) {
    this.state.logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
    if (this.state.logs.length > this.maxLogs) {
      this.state.logs = this.state.logs.slice(-this.maxLogs);
    }
  }

  private startHealthCheck(port: number) {
    this.stopHealthCheck();
    this.healthCheckTimer = setInterval(async () => {
      if (this.state.status !== "running" && this.state.status !== "starting") {
        this.stopHealthCheck();
        return;
      }
      try {
        const res = await fetch(`http://localhost:${port}/v1/tts/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok && this.state.status === "starting") {
          this.state.status = "running";
          this.state.startedAt = new Date().toISOString();
        }
      } catch {
        // Service not ready yet or crashed
        if (this.state.status === "running") {
          this.state.status = "error";
          this.state.lastError = "健康检查失败，服务可能已崩溃";
        }
      }
    }, 5000);
  }

  private stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}
