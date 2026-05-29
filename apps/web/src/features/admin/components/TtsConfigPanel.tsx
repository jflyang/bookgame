import { useEffect, useState, useCallback } from "react";
import { Check, Mic, Play, Save, Square, Zap } from "lucide-react";
import type { TtsConfigView } from "@story-game/shared";
import * as ttsApi from "../../../lib/ttsApi.js";

type ServiceStatus = "stopped" | "starting" | "running" | "error";

export function TtsConfigPanel() {
  const [config, setConfig] = useState<TtsConfigView | null>(null);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "fail">("idle");
  const [testResult, setTestResult] = useState("");
  const [voices, setVoices] = useState<Array<{ id: string; name: string; characterId?: string }>>([]);

  // Service process state
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("stopped");
  const [servicePid, setServicePid] = useState<number | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceLogs, setServiceLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [pythonPath, setPythonPath] = useState("");

  const pollStatus = useCallback(async () => {
    try {
      const status = await ttsApi.getServiceStatus();
      setServiceStatus(status.status);
      setServicePid(status.pid);
      setServiceError(status.lastError);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadVoices();
    void pollStatus();
  }, [pollStatus]);

  // Poll service status while starting/running
  useEffect(() => {
    if (serviceStatus === "starting" || serviceStatus === "running") {
      const timer = setInterval(pollStatus, 3000);
      return () => clearInterval(timer);
    }
  }, [serviceStatus, pollStatus]);

  async function loadConfig() {
    try {
      const cfg = await ttsApi.getTtsConfig();
      setConfig(cfg);
    } catch (err) {
      console.error("Failed to load TTS config:", err);
    }
  }

  async function loadVoices() {
    try {
      const result = await ttsApi.listVoices();
      setVoices(result.voices);
    } catch {
      // Voices may not be available if service is down
    }
  }

  async function handleSave() {
    if (!config) return;
    try {
      const updated = await ttsApi.updateTtsConfig(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save TTS config:", err);
    }
  }

  async function handleTest() {
    setTestStatus("testing");
    setTestResult("");
    try {
      const health = await ttsApi.checkHealth();
      if (health.status === "ok") {
        setTestStatus("success");
        setTestResult(`服务正常 (${health.provider})`);
      } else {
        setTestStatus("fail");
        setTestResult(`服务状态: ${health.status}`);
      }
    } catch (err) {
      setTestStatus("fail");
      setTestResult(err instanceof Error ? err.message : "连接失败");
    }
  }

  async function handleStartService() {
    setServiceLoading(true);
    setServiceError(null);
    try {
      const result = await ttsApi.startService({
        pythonPath: pythonPath.trim() || undefined,
      });
      if (result.ok) {
        setServiceStatus("starting");
        // Reload config after start (it auto-enables)
        setTimeout(() => void loadConfig(), 2000);
      } else {
        setServiceError(result.error || "启动失败");
        setServiceStatus("error");
      }
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : "启动失败");
      setServiceStatus("error");
    } finally {
      setServiceLoading(false);
    }
  }

  async function handleStopService() {
    setServiceLoading(true);
    try {
      await ttsApi.stopService();
      setServiceStatus("stopped");
      setServicePid(null);
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : "停止失败");
    } finally {
      setServiceLoading(false);
    }
  }

  async function handleLoadLogs() {
    try {
      const result = await ttsApi.getServiceLogs(50);
      setServiceLogs(result.logs);
      setShowLogs(true);
    } catch {
      setServiceLogs(["无法获取日志"]);
    }
  }

  if (!config) return <p>加载中...</p>;

  const statusLabels: Record<ServiceStatus, string> = {
    stopped: "⏹ 已停止",
    starting: "⏳ 启动中...",
    running: "✅ 运行中",
    error: "❌ 错误",
  };

  const statusColors: Record<ServiceStatus, string> = {
    stopped: "#64748b",
    starting: "#d97706",
    running: "#16a34a",
    error: "#dc2626",
  };

  return (
    <section className="panel llm-config">
      <h2><Mic size={16} /> 语音合成 (TTS) 配置</h2>

      {/* ===== Service Control Section ===== */}
      <div style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 16,
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <strong style={{ fontSize: "0.95rem" }}>CosyVoice 语音服务</strong>
            <span style={{
              marginLeft: 10,
              fontSize: "0.82rem",
              fontWeight: 700,
              color: statusColors[serviceStatus],
            }}>
              {statusLabels[serviceStatus]}
            </span>
            {servicePid && (
              <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "#94a3b8" }}>PID: {servicePid}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {serviceStatus === "stopped" || serviceStatus === "error" ? (
              <button
                onClick={handleStartService}
                disabled={serviceLoading}
                style={{
                  background: "#0f766e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: serviceLoading ? "wait" : "pointer",
                  opacity: serviceLoading ? 0.6 : 1,
                }}
              >
                <Play size={14} style={{ marginRight: 4 }} />
                {serviceLoading ? "启动中..." : "启动服务"}
              </button>
            ) : (
              <button
                onClick={handleStopService}
                disabled={serviceLoading}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: serviceLoading ? "wait" : "pointer",
                  opacity: serviceLoading ? 0.6 : 1,
                }}
              >
                <Square size={14} style={{ marginRight: 4 }} />
                {serviceLoading ? "停止中..." : "停止服务"}
              </button>
            )}
            <button
              onClick={handleLoadLogs}
              style={{
                background: "#fff",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              查看日志
            </button>
          </div>
        </div>

        {serviceError && (
          <p style={{ color: "#dc2626", fontSize: "0.82rem", margin: "8px 0 0", fontWeight: 600 }}>
            错误: {serviceError}
          </p>
        )}

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
            Python 路径（可选，默认使用系统 python）
          </label>
          <input
            value={pythonPath}
            onChange={(e) => setPythonPath(e.target.value)}
            placeholder="python 或 conda 环境路径，如 C:\miniconda3\envs\cosyvoice\python.exe"
            style={{ fontSize: "0.82rem", padding: "6px 10px", width: "100%" }}
          />
        </div>

        {showLogs && serviceLogs.length > 0 && (
          <div style={{
            marginTop: 12,
            background: "#1e293b",
            color: "#e2e8f0",
            borderRadius: 6,
            padding: 12,
            maxHeight: 200,
            overflow: "auto",
            fontSize: "0.72rem",
            fontFamily: "monospace",
            lineHeight: 1.6,
          }}>
            {serviceLogs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Config Section ===== */}
      <label>
        启用状态
        <select
          value={config.enabled ? "true" : "false"}
          onChange={(e) => setConfig({ ...config, enabled: e.target.value === "true" })}
        >
          <option value="true">启用</option>
          <option value="false">禁用</option>
        </select>
      </label>

      <label>
        Provider
        <select
          value={config.provider}
          onChange={(e) => setConfig({ ...config, provider: e.target.value as TtsConfigView["provider"] })}
        >
          <option value="disabled">禁用</option>
          <option value="mock">Mock 模拟</option>
          <option value="cosyvoice">CosyVoice</option>
        </select>
      </label>

      <label>
        服务地址
        <input
          value={config.serviceUrl}
          onChange={(e) => setConfig({ ...config, serviceUrl: e.target.value })}
          placeholder="http://localhost:50001"
        />
      </label>

      <div className="inline-fields">
        <label>
          最大文本长度
          <input
            type="number"
            min={50}
            max={5000}
            value={config.maxTextLength}
            onChange={(e) => setConfig({ ...config, maxTextLength: Number(e.target.value) })}
          />
        </label>
        <label>
          采样率
          <input
            type="number"
            min={8000}
            max={48000}
            step={1000}
            value={config.sampleRate}
            onChange={(e) => setConfig({ ...config, sampleRate: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="inline-fields">
        <label>
          输出格式
          <select
            value={config.defaultFormat}
            onChange={(e) => setConfig({ ...config, defaultFormat: e.target.value as "mp3" | "ogg" | "wav" })}
          >
            <option value="mp3">MP3</option>
            <option value="ogg">OGG</option>
            <option value="wav">WAV</option>
          </select>
        </label>
        <label>
          自动合成
          <select
            value={config.autoSynthesize ? "true" : "false"}
            onChange={(e) => setConfig({ ...config, autoSynthesize: e.target.value === "true" })}
          >
            <option value="false">关闭（按需播放）</option>
            <option value="true">开启（自动合成）</option>
          </select>
        </label>
      </div>

      <label>
        默认语音指令
        <input
          value={config.defaultInstruct}
          onChange={(e) => setConfig({ ...config, defaultInstruct: e.target.value })}
          placeholder="例如：用自然流畅的中文朗读"
        />
      </label>

      <p className="muted">
        服务状态：{config.serviceAvailable ? "✅ 在线" : "❌ 离线"}
        {config.provider === "cosyvoice" && " · CosyVoice 服务需要 GPU 支持"}
      </p>

      {voices.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", marginBottom: 8 }}>
            已注册音色 ({voices.length})
          </summary>
          <div style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            {voices.map((v) => (
              <div key={v.id} style={{ padding: "4px 8px", background: "#f8fafc", borderRadius: 4 }}>
                <strong>{v.name}</strong> <span style={{ color: "#64748b" }}>({v.id})</span>
                {v.characterId && <span style={{ color: "#0f766e", marginLeft: 8 }}>→ {v.characterId}</span>}
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="inline-actions">
        <button onClick={handleTest} disabled={testStatus === "testing"}>
          <Zap size={16} /> {testStatus === "testing" ? "测试中..." : "测试连接"}
        </button>
        <button onClick={handleSave}>
          <Save size={16} /> 保存 TTS 配置
        </button>
      </div>

      {saved && (
        <p className="feedback-toast"><Check size={16} /> 配置已保存</p>
      )}
      {testResult && (
        <p className={`test-result ${testStatus === "success" ? "success" : "error"}`}>{testResult}</p>
      )}
    </section>
  );
}
