import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync } from "node:fs";
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
import { aiStoryGenerator, type OutlineData, type StageDetail } from "./aiStoryGenerator.js";
import { assemblePackage } from "./packageAssembler.js";
import { resolveLinearPath, generateChapter, assembleMarkdown, type ExportConfig, type GenerateChapterInput } from "./storyExporter.js";

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

  // Upload media file for performance binding
  app.post("/api/editor/upload-media", (req, res) => {
    const state = getPackageState();
    if (!state) return res.status(400).json({ error: "未打开故事包" });

    const performanceId = req.query.performanceId as string;
    const type = req.query.type as string; // "image" | "audio" | "video"
    if (!performanceId || !type) return res.status(400).json({ error: "缺少 performanceId 或 type 参数" });

    const multer = require("multer");
    const upload = multer({
      storage: multer.diskStorage({
        destination: (_req: any, _file: any, cb: any) => {
          const dir = join(state.dir, "media", "performances", performanceId, type === "audio" ? "audio" : type === "video" ? "video" : "images");
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req: any, file: any, cb: any) => {
          cb(null, file.originalname);
        },
      }),
    }).single("file");

    upload(req, res, (err: any) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "未收到文件" });

      // Return relative path for manifest.json
      const relativePath = `assets/performances/${performanceId}/${type === "audio" ? "audio" : type === "video" ? "video" : "images"}/${req.file.originalname}`;
      res.json({ ok: true, path: relativePath, filename: req.file.originalname });
    });
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

  // ─── AI Story Generation ───

  // Get AI config (masked key)
  app.get("/api/editor/ai/config", (_req, res) => {
    res.json(aiStoryGenerator.getConfig());
  });

  // Save AI config
  app.post("/api/editor/ai/save-config", (req, res) => {
    try {
      const { apiKey, baseUrl, model } = req.body;
      const current = aiStoryGenerator.getConfig();
      
      // If no key provided and no existing key, error
      if (!apiKey?.trim() && !current.hasKey) {
        return res.status(400).json({ error: "请提供 API Key" });
      }

      // Use provided key, or keep existing (pass empty to saveConfig which will read from file)
      const finalKey = apiKey?.trim() || "";
      aiStoryGenerator.updateConfig(finalKey || undefined, baseUrl, model);
      res.json({ ok: true, ...aiStoryGenerator.getConfig() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Step 1: Generate outline from description
  app.post("/api/editor/ai/generate-outline", async (req, res) => {
    try {
      const { description, style, stageCount, branchCount, characters } = req.body;
      if (!description) return res.status(400).json({ error: "请提供故事描述" });

      const outline = await aiStoryGenerator.generateOutline({
        description, style, stageCount, branchCount, characters,
      });
      res.json({ ok: true, outline });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Step 2: Generate detail for a single stage
  app.post("/api/editor/ai/generate-stage-detail", async (req, res) => {
    try {
      const { outline, stageId, previousGuidance } = req.body;
      if (!outline || !stageId) return res.status(400).json({ error: "缺少 outline 或 stageId" });

      const detail = await aiStoryGenerator.generateStageDetail(outline, stageId, previousGuidance);
      res.json({ ok: true, detail });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Step 3: Assemble full package from outline + details
  app.post("/api/editor/ai/create-package", (req, res) => {
    try {
      const { outline, stageDetails, targetPath } = req.body;
      if (!outline) return res.status(400).json({ error: "缺少 outline" });

      // If targetPath provided, write into that existing directory
      const result = assemblePackage({ outline, stageDetails: stageDetails || {} }, targetPath);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Step 3b: Update a single stage's detail in an existing package
  app.post("/api/editor/ai/update-stage", (req, res) => {
    try {
      const { packagePath, stageId, guidance, directive } = req.body;
      if (!packagePath || !stageId) return res.status(400).json({ error: "缺少 packagePath 或 stageId" });

      // Update scenario.json
      const scenarioPath = join(packagePath, "scenario.json");
      if (!existsSync(scenarioPath)) return res.status(404).json({ error: "故事包不存在" });

      const scenario = JSON.parse(readFileSync(scenarioPath, "utf-8"));
      const stageDetail = scenario.stageDetails?.find((s: any) => s.id === stageId);
      if (stageDetail) {
        if (guidance !== undefined) stageDetail.guidance = guidance;
        if (directive !== undefined) stageDetail.directive = directive;
        writeFileSync(scenarioPath, JSON.stringify(scenario, null, 2), "utf-8");
      }

      // Update modules.json
      const modulesPath = join(packagePath, "modules.json");
      if (existsSync(modulesPath)) {
        const modules = JSON.parse(readFileSync(modulesPath, "utf-8"));
        const mod = modules.find((m: any) => m.sourceStage === stageId || m.id === `mod_${stageId}`);
        if (mod) {
          if (guidance !== undefined) mod.guidance = guidance;
          writeFileSync(modulesPath, JSON.stringify(modules, null, 2), "utf-8");
        }
      }

      res.json({ ok: true, stageId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ─── Story Export (Novel) ───

  app.post("/api/editor/export/generate-chapter", async (req, res) => {
    try {
      const input = req.body;
      if (!input.stageId) return res.status(400).json({ error: "缺少 stageId" });

      const result = await generateChapter(input);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Export AI rewrite task document — returns file content for download
  app.post("/api/editor/export-rewrite-task", async (_req, res) => {
    try {
      const state = getPackageState();
      if (!state) return res.status(400).json({ error: "未打开故事包" });

      const dir = state.dir;
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
      const title = pkg.title || "故事包";

      const { execSync } = await import("node:child_process");
      const scriptPath = resolve(__dirname, "../scripts/export_for_ai_rewrite.cjs");
      execSync(`node "${scriptPath}" "${dir}"`, { encoding: "utf-8" });

      const safeName = title.replace(/[\\/:*?"<>|]/g, "_");
      const outputFile = join(dir, `${safeName}-重写任务.md`);
      if (!existsSync(outputFile)) return res.status(500).json({ error: "导出文件未生成" });

      const content = readFileSync(outputFile, "utf-8");
      res.json({ ok: true, filename: `${safeName}-重写任务.md`, content });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Import modules.json — backup old one and replace
  app.post("/api/editor/import-modules", (req, res) => {
    try {
      const state = getPackageState();
      if (!state) return res.status(400).json({ error: "未打开故事包" });

      const { modules } = req.body;
      if (!Array.isArray(modules)) return res.status(400).json({ error: "无效的 modules 数据" });

      const dir = state.dir;
      const modulesPath = join(dir, "modules.json");

      // Backup existing
      if (existsSync(modulesPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const backupPath = join(dir, `modules_backup_${timestamp}.json`);
        copyFileSync(modulesPath, backupPath);
      }

      // Write new
      writeFileSync(modulesPath, JSON.stringify(modules, null, 2), "utf-8");
      res.json({ ok: true, count: modules.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
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
