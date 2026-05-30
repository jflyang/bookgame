import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import type { StoryPackage } from "@story-game/shared";
import {
  openDirectory, openZip, saveStoryPackage, saveManifest,
  saveStorySetting, saveFlowAndModules, exportZip, uploadToServer, getPackageState,
  getMediaPath, type PackageState
} from "./storyPackageIO.js";
import { aiAssistant } from "./aiAssistant.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "100mb" }));

  // ==================== Editor API ====================

  app.get("/api/editor/state", (_req, res) => {
    const state = getPackageState();
    if (!state) return res.json({ loaded: false });
    const { storyPackage, ...rest } = state;
    res.json({
      loaded: true,
      id: storyPackage.id,
      title: storyPackage.title,
      ...rest,
      storyPackage,
    });
  });

  app.post("/api/editor/open", async (req, res) => {
    try {
      const { path: inputPath } = req.body;
      if (!inputPath) return res.status(400).json({ error: "请提供故事包目录或 ZIP 文件路径" });

      let state: PackageState;
      if (inputPath.endsWith(".zip")) {
        state = await openZip(inputPath);
      } else {
        state = openDirectory(inputPath);
      }

      const { storyPackage, ...rest } = state;
      res.json({ loaded: true, id: storyPackage.id, title: storyPackage.title, ...rest, storyPackage });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put("/api/editor/story", (req, res) => {
    try {
      const pkg = req.body as StoryPackage;
      saveStoryPackage(pkg);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put("/api/editor/flow", (req, res) => {
    try {
      const { flow, modules, nodes, edges } = req.body;
      // If nodes+edges provided, write ReactFlow format to flow.json
      // Otherwise write FlowDefinition format
      const flowData = (nodes && edges) ? { nodes, edges } : flow;
      saveFlowAndModules(flowData, modules);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put("/api/editor/manifest", (req, res) => {
    try {
      saveManifest(req.body);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put("/api/editor/story-setting", (req, res) => {
    try {
      saveStorySetting(req.body.content || "");
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post("/api/editor/export", async (_req, res) => {
    try {
      const { buffer, filename } = await exportZip();
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post("/api/editor/upload", async (req, res) => {
    try {
      const { serverUrl } = req.body;
      if (!serverUrl) return res.status(400).json({ error: "请提供服务器地址" });
      const result = await uploadToServer(serverUrl);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get("/api/editor/media", (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "缺少文件路径" });
    const absPath = getMediaPath(filePath);
    if (!absPath) return res.status(404).json({ error: "文件不存在" });
    res.sendFile(absPath);
  });

  app.post("/api/editor/ai/suggest", async (req, res) => {
    try {
      const { context, instruction, currentData, dataType } = req.body;
      const result = await aiAssistant.suggest({ context, instruction, currentData, dataType });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post("/api/editor/ai/config", (req, res) => {
    try {
      const { apiKey, baseUrl, model } = req.body;
      aiAssistant.setConfig(apiKey, baseUrl, model);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // List available story packages in task-packages directory
  app.get("/api/editor/packages", (_req, res) => {
    try {
      const taskPackagesDir = resolve(__dirname, "../../data/task-packages");
      const packages: { id: string; title: string; description: string; path: string; updatedAt: string }[] = [];
      if (existsSync(taskPackagesDir)) {
        for (const entry of readdirSync(taskPackagesDir, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name.includes("_backup")) continue;
          const dir = join(taskPackagesDir, entry.name);
          // V3: only include dirs that have package.json
          if (!existsSync(join(dir, "package.json"))) continue;
          const manifestPath = join(dir, "manifest.json");
          if (existsSync(manifestPath)) {
            try {
              const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
              packages.push({
                id: entry.name,
                title: manifest.title || entry.name,
                description: manifest.description || "",
                path: dir,
                updatedAt: manifest.updatedAt || "",
              });
            } catch {
              packages.push({ id: entry.name, title: entry.name, description: "", path: dir, updatedAt: "" });
            }
          } else {
            packages.push({ id: entry.name, title: entry.name, description: "", path: dir, updatedAt: "" });
          }
        }
      }
      packages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      res.json({ packages });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // In dev mode, mount Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: resolve(__dirname, ".."),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built files
    const distPath = resolve(__dirname, "../dist");
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(join(distPath, "index.html"));
    });
  }

  return app;
}

// Direct start
const PORT = parseInt(process.env.PORT || "4001", 10);
const app = await createApp();
const server = createServer(app);
server.listen(PORT, () => {
  console.log(`\n📦 Story Editor → http://localhost:${PORT}\n`);
});
