import { useEffect, useState, useCallback } from "react";
import { Check, Mic, Play, Save, Square, Zap } from "lucide-react";
import type { TtsConfigView } from "@story-game/shared";
import * as ttsApi from "../../../lib/ttsApi.js";

type ServiceStatus = "stopped" | "starting" | "running" | "error";

export function TtsConfigPanel() {
  const [config, setConfig] = useState<TtsConfigView | null>(null);
  const [saved, setSaved] = useState(false);
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
      if (status.lastError && status.status === "error") {
        setServiceError(status.lastError);
      } else {
        setServiceError(null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadVoices();
    void pollStatus();
  }, [pollStatus]);

  // Poll service status while starting
  useEffect(() => {
    if (serviceStatus === "starting") {
      const timer = setInterval(pollStatus, 2000);
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
      // ignore
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

  async function handleStartService() {
    setServiceLoading(true);
    setServiceError(null);
    try {
      const result = await ttsApi.startService({
        pythonPath: pythonPath.trim() || undefined,
      });
      if (result.ok) {
        setServiceStatus("starting");
        setTimeout(() => void loadConfig(), 3000);
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
      setServiceError(null);
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
      setShowLogs(!showLogs);
    } catch {
      setServiceLogs(["无法获取日志"]);
    }
  }

  if (!config) return <p>加载中...</p>;

  // Determine the real online status
  const isOnline = config.provider === "elevenlabs"
    ? (config as any).hasElevenLabsKey === true
    : config.serviceAvailable === true;
  const providerLabel = config.provider === "cosyvoice" ? "CosyVoice" : config.provider === "elevenlabs" ? "ElevenLabs" : config.provider;

  return (
    <section className="panel llm-config" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2><Mic size={16} /> 语音合成 (TTS)</h2>

      {/* ===== Provider Selection ===== */}
      <div className="inline-fields">
        <label>
          Provider
          <select
            value={config.provider}
            onChange={(e) => setConfig({ ...config, provider: e.target.value as TtsConfigView["provider"] })}
          >
            <option value="disabled">禁用</option>
            <option value="mock">Mock 模拟</option>
            <option value="cosyvoice">CosyVoice (本地 GPU)</option>
            <option value="elevenlabs">ElevenLabs (云端)</option>
          </select>
        </label>
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
      </div>

      {/* ===== Status Bar ===== */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: isOnline ? "#ecfdf5" : "#fef2f2",
        border: `1px solid ${isOnline ? "#a7f3d0" : "#fecaca"}`,
        borderRadius: 8,
        fontSize: "0.85rem",
        fontWeight: 600,
      }}>
        <span style={{ fontSize: "1.1rem" }}>{isOnline ? "✅" : "❌"}</span>
        <span style={{ color: isOnline ? "#065f46" : "#991b1b" }}>
          {isOnline ? `${providerLabel} 服务在线` : `${providerLabel} 服务离线`}
        </span>
        {servicePid && serviceStatus === "running" && (
          <span style={{ color: "#6b7280", fontSize: "0.78rem", marginLeft: "auto" }}>PID {servicePid}</span>
        )}
      </div>

      {/* ===== CosyVoice Local Service Control ===== */}
      {config.provider === "cosyvoice" && (
        <details style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px" }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.88rem", color: "#334155" }}>
            本地服务管理 (CosyVoice)
          </summary>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {serviceStatus === "stopped" || serviceStatus === "error" ? (
                <button
                  onClick={handleStartService}
                  disabled={serviceLoading}
                  style={{ background: "#0f766e", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontWeight: 700, fontSize: "0.82rem", cursor: serviceLoading ? "wait" : "pointer", opacity: serviceLoading ? 0.6 : 1 }}
                >
                  <Play size={13} style={{ marginRight: 4 }} />
                  {serviceLoading ? "启动中..." : "启动服务"}
                </button>
              ) : (
                <button
                  onClick={handleStopService}
                  disabled={serviceLoading}
                  style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontWeight: 700, fontSize: "0.82rem", cursor: serviceLoading ? "wait" : "pointer", opacity: serviceLoading ? 0.6 : 1 }}
                >
                  <Square size={13} style={{ marginRight: 4 }} />
                  {serviceLoading ? "停止中..." : "停止服务"}
                </button>
              )}
              <button
                onClick={handleLoadLogs}
                style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, padding: "7px 10px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
              >
                {showLogs ? "隐藏日志" : "查看日志"}
              </button>
              {serviceStatus === "starting" && <span style={{ color: "#d97706", fontSize: "0.78rem" }}>⏳ 启动中...</span>}
            </div>

            {serviceError && (
              <p style={{ color: "#dc2626", fontSize: "0.8rem", margin: 0, fontWeight: 600 }}>
                错误: {serviceError}
              </p>
            )}

            <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>
              Python 路径
              <input
                value={pythonPath}
                onChange={(e) => setPythonPath(e.target.value)}
                placeholder="默认 python，或填 conda 环境完整路径"
                style={{ fontSize: "0.8rem", padding: "5px 8px", marginTop: 4 }}
              />
            </label>

            <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>
              服务地址
              <input
                value={config.serviceUrl}
                onChange={(e) => setConfig({ ...config, serviceUrl: e.target.value })}
                placeholder="http://localhost:50001"
                style={{ fontSize: "0.8rem", padding: "5px 8px", marginTop: 4 }}
              />
            </label>

            {showLogs && serviceLogs.length > 0 && (
              <div style={{ background: "#1e293b", color: "#e2e8f0", borderRadius: 6, padding: 10, maxHeight: 180, overflow: "auto", fontSize: "0.7rem", fontFamily: "monospace", lineHeight: 1.6 }}>
                {serviceLogs.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            )}
          </div>
        </details>
      )}

      {/* ===== ElevenLabs Config ===== */}
      {config.provider === "elevenlabs" && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <strong style={{ fontSize: "0.88rem", color: "#334155" }}>ElevenLabs 配置</strong>
          <label>
            API Key
            <input
              type="password"
              value={(config as any).elevenLabsApiKey || ""}
              onChange={(e) => setConfig({ ...config, elevenLabsApiKey: e.target.value } as any)}
              placeholder={(config as any).hasElevenLabsKey ? "已配置，留空则不修改" : "xi-..."}
            />
          </label>
          <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
            密钥状态：{(config as any).hasElevenLabsKey ? "✅ 已配置" : "❌ 未配置"}。密钥保存在服务端，不会回显。
          </p>
          <label>
            Model
            <select
              value={(config as any).elevenLabsModel || "eleven_multilingual_v2"}
              onChange={(e) => setConfig({ ...config, elevenLabsModel: e.target.value } as any)}
            >
              <option value="eleven_multilingual_v2">Multilingual v2 (推荐，支持中文)</option>
              <option value="eleven_turbo_v2_5">Turbo v2.5 (低延迟)</option>
              <option value="eleven_turbo_v2">Turbo v2</option>
              <option value="eleven_monolingual_v1">Monolingual v1 (仅英文)</option>
            </select>
          </label>
          <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
            云端服务，无需本地 GPU。在 <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">elevenlabs.io</a> 获取 API Key。角色 voiceId 需设为 ElevenLabs Voice ID。
          </p>
        </div>
      )}

      {/* ===== Common Settings ===== */}
      <details open={config.provider !== "disabled"}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.88rem", color: "#334155", marginBottom: 8 }}>
          合成参数
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="inline-fields">
            <label>
              最大文本长度
              <input type="number" min={50} max={5000} value={config.maxTextLength} onChange={(e) => setConfig({ ...config, maxTextLength: Number(e.target.value) })} />
            </label>
            <label>
              采样率
              <input type="number" min={8000} max={48000} step={1000} value={config.sampleRate} onChange={(e) => setConfig({ ...config, sampleRate: Number(e.target.value) })} />
            </label>
          </div>
          <div className="inline-fields">
            <label>
              输出格式
              <select value={config.defaultFormat} onChange={(e) => setConfig({ ...config, defaultFormat: e.target.value as "mp3" | "ogg" | "wav" })}>
                <option value="mp3">MP3</option>
                <option value="ogg">OGG</option>
                <option value="wav">WAV</option>
              </select>
            </label>
            <label>
              自动合成
              <select value={config.autoSynthesize ? "true" : "false"} onChange={(e) => setConfig({ ...config, autoSynthesize: e.target.value === "true" })}>
                <option value="false">关闭（按需播放）</option>
                <option value="true">开启（自动合成）</option>
              </select>
            </label>
          </div>
          <label>
            默认语音指令
            <input value={config.defaultInstruct} onChange={(e) => setConfig({ ...config, defaultInstruct: e.target.value })} placeholder="例如：用自然流畅的中文朗读" />
          </label>
        </div>
      </details>

      {/* ===== Voices ===== */}
      {voices.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.88rem", color: "#334155" }}>
            已注册音色 ({voices.length})
          </summary>
          <div style={{ display: "grid", gap: 4, fontSize: "0.82rem", marginTop: 8 }}>
            {voices.map((v) => (
              <div key={v.id} style={{ padding: "4px 8px", background: "#f8fafc", borderRadius: 4 }}>
                <strong>{v.name}</strong> <span style={{ color: "#64748b" }}>({v.id})</span>
                {v.characterId && <span style={{ color: "#0f766e", marginLeft: 8 }}>→ {v.characterId}</span>}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ===== Actions ===== */}
      <div className="inline-actions">
        <button onClick={handleSave}>
          <Save size={16} /> 保存配置
        </button>
      </div>

      {saved && <p className="feedback-toast"><Check size={16} /> 配置已保存</p>}
    </section>
  );
}
