const fs = require("fs");
const path = require("path");

const dir = __dirname;

// Read all individual files
const scenario = JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf-8"));
const characters = JSON.parse(fs.readFileSync(path.join(dir, "characters.json"), "utf-8"));
const skills = JSON.parse(fs.readFileSync(path.join(dir, "skills.json"), "utf-8"));
const knowledgeDocuments = JSON.parse(fs.readFileSync(path.join(dir, "knowledge", "documents.json"), "utf-8"));
const promptRules = JSON.parse(fs.readFileSync(path.join(dir, "prompts", "rules.json"), "utf-8"));
const storySettingPrompt = fs.readFileSync(path.join(dir, "prompts", "story-setting.md"), "utf-8");

let modules = null;
const modulesPath = path.join(dir, "modules.json");
if (fs.existsSync(modulesPath)) {
  modules = JSON.parse(fs.readFileSync(modulesPath, "utf-8"));
}

let flow = null;
const flowPath = path.join(dir, "flow.json");
if (fs.existsSync(flowPath)) {
  flow = JSON.parse(fs.readFileSync(flowPath, "utf-8"));
}

let uiConfig = {};
const uiConfigPath = path.join(dir, "ui", "config.json");
if (fs.existsSync(uiConfigPath)) {
  uiConfig = JSON.parse(fs.readFileSync(uiConfigPath, "utf-8"));
}

let pluginManifest = null;
const manifestPath = path.join(dir, "manifest.json");
if (fs.existsSync(manifestPath)) {
  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (raw.schemaVersion === "2") {
    pluginManifest = raw;
  }
}

// Read existing task-package.json for top-level metadata
const existing = JSON.parse(fs.readFileSync(path.join(dir, "task-package.json"), "utf-8"));

const bundle = {
  id: existing.id,
  title: existing.title,
  description: existing.description,
  thumbnail: existing.thumbnail,
  hidden: existing.hidden ?? false,
  storySettingPrompt,
  scenario,
  characters,
  skills,
  knowledgeDocuments,
  promptRules,
  debugConfig: existing.debugConfig,
  uiConfig,
  pluginManifest,
  createdAt: existing.createdAt,
  updatedAt: new Date().toISOString(),
};

// Attach v2 fields if present
if (modules) bundle.modules = modules;
if (flow) bundle.flow = flow;

fs.writeFileSync(path.join(dir, "task-package.json"), JSON.stringify(bundle, null, 2), "utf-8");

console.log(`✅ task-package.json rebuilt (${(JSON.stringify(bundle).length / 1024).toFixed(0)} KB)`);
if (modules) console.log(`   modules: ${modules.length} modules`);
if (flow) console.log(`   flow: ${flow.id}`);
