import { nanoid } from "nanoid";
import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import AdmZip from "adm-zip";
import type { Character, KnowledgeDocument, Scenario, Skill, StoryPackage } from "@story-game/shared";
import { storyPackageSchema } from "@story-game/shared";
import { defaultPromptRules } from "../data/defaultPromptRules.js";
import { createModuleLogger } from "../utils/logger.js";
import { assertSafeId, resolveInside } from "../data/pathGuards.js";
import { normalizeMediaExtension, TaskPackageRepository, type TaskPackageRepositoryOptions } from "../data/taskPackageRepository.js";

const logger = createModuleLogger("storyPackage");
const maxZipBytes = 8 * 1024 * 1024;
const maxZipEntries = 64;
const maxEntryBytes = 2 * 1024 * 1024;
const maxJsonBytes = 512 * 1024;

interface SeedData {
  characters: Character[];
  skills: Skill[];
  scenarios: Scenario[];
  knowledgeDocuments: KnowledgeDocument[];
}

export class StoryPackageService {
  private readonly storyPackages: StoryPackage[] = [];
  private readonly repository: TaskPackageRepository;

  constructor(storage: string | TaskPackageRepository, seed?: SeedData, options: TaskPackageRepositoryOptions = {}) {
    this.repository = typeof storage === "string" ? new TaskPackageRepository(storage, options) : storage;
    const packages = this.repository.list();
    if (packages.length === 0 && seed) {
      logger.info("no story packages found, seeding default");
      const pkg = this.buildSeed(seed);
      this.storyPackages.push(pkg);
      this.saveToFile(pkg);
    } else {
      this.storyPackages.push(...packages);
    }
    logger.info({ count: this.storyPackages.length }, "story packages loaded");
  }

  list() {
    return this.storyPackages;
  }

  get(id: string) {
    assertSafeId(id);
    const storyPackage = this.storyPackages.find((item) => item.id === id);
    if (!storyPackage) throw new Error(`Story package not found: ${id}`);
    return storyPackage;
  }

  create(title: string, sourcePackageId?: string) {
    const source = this.get(sourcePackageId ?? this.storyPackages[0].id);
    const now = new Date().toISOString();
    const storyPackage: StoryPackage = {
      ...structuredClone(source),
      id: `story_${nanoid(10)}`,
      title,
      description: "新建故事包",
      storySettingPrompt: source.storySettingPrompt,
      scenario: {
        ...structuredClone(source.scenario),
        id: `scenario_${nanoid(8)}`,
        title
      },
      createdAt: now,
      updatedAt: now
    };
    this.storyPackages.unshift(storyPackage);
    this.saveToFile(storyPackage);
    logger.info({ id: storyPackage.id, title }, "story package created");
    return storyPackage;
  }

  upsert(storyPackage: StoryPackage) {
    const parsed = storyPackageSchema.parse(storyPackage);
    assertSafeId(parsed.id);
    const next = { ...parsed, updatedAt: new Date().toISOString() };
    const index = this.storyPackages.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      this.storyPackages[index] = next;
    } else {
      this.storyPackages.unshift(next);
    }
    this.saveToFile(next);
    logger.debug({ id: next.id }, "story package saved");
    return next;
  }

  delete(id: string) {
    assertSafeId(id);
    if (this.storyPackages.length <= 1) throw new Error("At least one story package is required");
    const index = this.storyPackages.findIndex((item) => item.id === id);
    if (index < 0) throw new Error(`Story package not found: ${id}`);
    const [removed] = this.storyPackages.splice(index, 1);
    this.removePackageDir(id);
    logger.info({ id, title: removed.title }, "story package deleted");
    return removed;
  }

  getFilePath(id: string) {
    return this.filePath(id);
  }

  /** Create a ZIP buffer containing the story package JSON and all media files */
  createExportZip(id: string): Buffer {
    assertSafeId(id);
    const pkg = this.get(id);
    const zip = new AdmZip();
    for (const file of this.repository.contentFiles(pkg.id)) {
      zip.addLocalFile(file.absolutePath, file.zipPath.split("/").slice(0, -1).join("/"));
    }
    zip.addFile("story-package.json", Buffer.from(JSON.stringify(pkg, null, 2), "utf-8"));

    return zip.toBuffer();
  }

  /** Import a story package from a ZIP buffer. Returns the imported package. */
  importZip(zipBuffer: Buffer, title?: string) {
    if (zipBuffer.byteLength > maxZipBytes) throw new Error("ZIP 文件过大");
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    if (entries.length > maxZipEntries) throw new Error("ZIP 文件条目过多");
    for (const entry of entries) {
      this.validateZipEntry(entry);
    }

    // Find and parse the JSON
    let jsonEntry = entries.find((e) => e.entryName === "task-package.json" || e.entryName === "story-package.json" || e.entryName.endsWith(".story-package.json"));
    if (!jsonEntry) throw new Error("ZIP 中未找到 task-package.json 或 story-package.json");
    if (jsonEntry.header.size > maxJsonBytes) throw new Error("任务包 JSON 过大");

    const raw = jsonEntry.getData().toString("utf-8");
    const parsed = storyPackageSchema.parse(JSON.parse(raw));

    // Assign new ID and title if importing as a new package
    const now = new Date().toISOString();
    const pkg: StoryPackage = {
      ...parsed,
      id: `story_${nanoid(10)}`,
      title: title || parsed.title,
      createdAt: now,
      updatedAt: now,
    };

    // Save the JSON
    this.upsert(pkg);

    // Extract media files
    const packageMediaDir = this.repository.mediaDir(pkg.id);
    for (const entry of entries) {
      if (entry.entryName.startsWith("media/") && !entry.isDirectory) {
        const filename = basename(entry.entryName);
        const ext = normalizeMediaExtension(filename);
        const newName = filename.startsWith("thumbnail.") ? `thumbnail${ext}` : `${pkg.id}${ext}`;
        writeFileSync(resolveInside(packageMediaDir, newName), entry.getData());
        // Update thumbnail reference in the package
        if (pkg.thumbnail && pkg.thumbnail.includes(filename.split(".")[0])) {
          pkg.thumbnail = `/api/admin/media/${pkg.id}`;
          this.upsert(pkg);
        }
      }
    }

    logger.info({ id: pkg.id, title: pkg.title }, "story package imported from zip");
    return pkg;
  }

  private filePath(id: string) {
    return this.repository.taskFile(id);
  }

  private saveToFile(pkg: StoryPackage) {
    this.repository.save(pkg);
  }

  private removePackageDir(id: string) {
    this.repository.remove(id);
  }

  private validateZipEntry(entry: AdmZip.IZipEntry) {
    const name = entry.entryName.replaceAll("\\", "/");
    if (name.startsWith("/") || name.includes("../") || name.includes("..\\")) throw new Error(`ZIP 条目路径非法: ${entry.entryName}`);
    if (entry.header.size > maxEntryBytes) throw new Error(`ZIP 条目过大: ${entry.entryName}`);
    if (entry.isDirectory) return;
    const allowed = [
      name === "manifest.json",
      name === "task-package.json",
      name === "story-package.json",
      name.endsWith(".story-package.json"),
      name === "scenario.json",
      name === "characters.json",
      name === "skills.json",
      name === "knowledge/documents.json",
      name.startsWith("knowledge/") && name.endsWith(".md"),
      name === "prompts/story-setting.md",
      name === "prompts/rules.json",
      name === "ui/config.json",
      name.startsWith("media/") && /\.(png|jpe?g|gif|webp)$/i.test(name)
    ].some(Boolean);
    if (!allowed) throw new Error(`ZIP 条目不被允许: ${entry.entryName}`);
  }

  private buildSeed(seed: SeedData): StoryPackage {
    const now = new Date().toISOString();
    return {
      id: "xuzhu_vs_dingchunqiu",
      title: "虚竹除害星宿老怪",
      description: "固定四角色的武侠回合制互动故事 MVP。",
      storySettingPrompt: [
        "# 故事设定：虚竹除害星宿老怪",
        "",
        "虚竹得知丁春秋原是逍遥派叛逆，欺师灭祖，另立星宿派，又以毒功残害江湖中人。",
        "虚竹虽然性情仁厚，不愿轻易伤人，但想到丁春秋多年败坏逍遥派门风，又害死无数无辜，终于决定出手，为门派清理门户。",
        "乔峰与段誉同行。乔峰在一旁为虚竹压阵；段誉退在远处观察战局。",
        "三人在山道旁遇见丁春秋和星宿派弟子，冲突从毒雾开始逐步升级。",
        "",
        "## 本故事包特殊内容",
        "- 初始状态：虚竹 气血:360 内力:2000；乔峰 气血:700 内力:800；段誉 气血:180 内力:260；丁春秋 气血:400 内力:180。",
        "- 每次对话最后应展示统一状态行。",
        "- 状态格式：[状态] 乔峰 气血:XX 内力:XX | 虚竹 气血:XX 内力:XX | 段誉 气血:XX 内力:XX | 丁春秋 气血:XX 内力:XX",
        "- 不要一次性说完整个故事，每次只推进一小步。"
      ].join("\n"),
      scenario: structuredClone(seed.scenarios[0]),
      characters: structuredClone(seed.characters),
      skills: structuredClone(seed.skills),
      knowledgeDocuments: structuredClone(seed.knowledgeDocuments),
      promptRules: structuredClone(defaultPromptRules),
      debugConfig: {
        showPromptLayers: true,
        showRawOutput: false,
        showValidation: true
      },
      uiConfig: {
        layout: { showCharacterPanel: true, showQuickActions: true, showDiceButton: true, showAutoPlay: true },
        theme: { primaryColor: "#1f5b51", accentColor: "#2b987a", backgroundColor: "#f7f1e7", surfaceColor: "#fffaf2", textColor: "#2f3133", headingFont: "STKaiti", bodyFont: "Inter", navBackground: "#0a1728" },
        scene: { heading: "山道暮色 · 枯松岭", introNarration: "暮色低垂，枯松岭上寒风凛冽。毒雾从谷底翻涌而上，令人心神俱颤。", emptyTitle: "山道毒雾初起", emptyHint: '点击"继续"让角色轮流推动剧情，也可以点选头像或输入 @角色 指定发言。' },
        labels: {
          hp: "气血", mp: "内力", characters: "登场角色", lastSpeaker: "上轮发言", continue: "继续",
          autoPlay: "自动继续", send: "发送", manageCharacters: "角色管理", rules: "故事规则",
          scenarioRules: "剧情规则", promptRules: "提示词规则", currentStatus: "当前状态",
          round: "回合", currentStage: "当前阶段", statusActive: "进行中", statusCompleted: "已结束",
          interactiveStory: "互动故事", storyManagement: "故事管理", viewRules: "查看规则"
        },
        avatar: { style: "gradient" as const }
      },
      createdAt: now,
      updatedAt: now
    };
  }
}
