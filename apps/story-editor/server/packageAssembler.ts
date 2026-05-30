/**
 * Package Assembler — 将 AI 生成的大纲 + 阶段详情组装为完整故事包文件
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import type { OutlineData, OutlineStage, StageDetail } from "./aiStoryGenerator.js";

const TASK_PACKAGES_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../data/task-packages");

interface AssembleInput {
  outline: OutlineData;
  stageDetails: Record<string, StageDetail>;
}

export function assemblePackage(input: AssembleInput, targetPath?: string): { packagePath: string; packageId: string } {
  const { outline, stageDetails } = input;

  // Generate package ID
  const safeName = outline.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "").slice(0, 10);
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const packageId = `story_${safeName}_${randomSuffix}`;

  let packagePath: string;
  if (targetPath) {
    packagePath = targetPath;
  } else {
    const dirName = outline.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 30);
    packagePath = join(TASK_PACKAGES_DIR, dirName);
  }

  // Create directory
  if (!existsSync(packagePath)) {
    mkdirSync(packagePath, { recursive: true });
  }

  // ─── package.json ───
  writeJSON(packagePath, "package.json", {
    schemaVersion: "3",
    id: packageId,
    title: outline.title,
    description: outline.premise,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // ─── manifest.json ───
  writeJSON(packagePath, "manifest.json", {
    title: outline.title,
    description: outline.premise,
    version: "2.0.0",
    performances: {},
  });

  // ─── characters.json ───
  const characters = outline.characters.map(c => ({
    id: c.id,
    name: c.name,
    role: c.role,
    avatar: "",
    voiceId: "",
    knowledgeBaseIds: [],
    attackableTargetIds: [],
  }));
  writeJSON(packagePath, "characters.json", characters);

  // ─── scenario.json ───
  const stageIds = outline.stages.map(s => s.id);
  const stageDetailsArr = outline.stages.map((s, i) => {
    const detail: any = {
      id: s.id,
      title: s.title,
      description: s.description,
      enterWhen: s.enterWhen,
      guidance: stageDetails[s.id]?.guidance || "",
      directive: stageDetails[s.id]?.directive || "",
      sortKey: i,
      stageType: s.stageType,
    };
    if (s.isChoicePoint) {
      detail.isChoicePoint = true;
      // Convert branches to game schema format (needs targetStage)
      if (s.branches && outline.flow.branches) {
        const branchKeys = Object.keys(outline.flow.branches);
        detail.branches = s.branches.map((b, bi) => ({
          targetStage: outline.flow.branches![branchKeys[bi]]?.[0] || "",
          choiceText: b.choiceText,
          description: b.description,
        }));
      }
    }
    return detail;
  });

  writeJSON(packagePath, "scenario.json", {
    id: packageId,
    title: outline.title,
    premise: outline.premise,
    currentStage: stageIds[0] || "",
    stages: stageIds,
    stageDetails: stageDetailsArr,
    currentGoal: outline.premise,
    rules: [
      "不要一次性说完整个故事，每次只推进一小步",
      "保持叙事张力，按照阶段指引推进剧情",
    ],
    initialStates: outline.characters.map(c => ({
      characterId: c.id,
      hp: 100,
      mp: 100,
    })),
    defaultSpeakerId: outline.characters[0]?.id || "",
  });

  // ─── modules.json ───
  const modules = outline.stages.map(s => ({
    id: `mod_${s.id}`,
    sourceStage: s.id,
    title: s.title,
    type: s.stageType,
    reusable: s.stageType === "daily",
    description: s.description,
    guidance: stageDetails[s.id]?.guidance || "",
    enterWhen: s.enterWhen,
    exitCondition: "",
  }));
  writeJSON(packagePath, "modules.json", modules);

  // ─── flow.json ───
  const flow = buildFlowJSON(outline, modules);
  writeJSON(packagePath, "flow.json", flow);

  // ─── setting.md ───
  const settingMd = `# ${outline.title}\n\n${outline.setting}\n`;
  writeFileSync(join(packagePath, "setting.md"), settingMd, "utf-8");

  // ─── Empty files ───
  writeJSON(packagePath, "actions.json", []);
  writeJSON(packagePath, "reactions.json", []);
  writeJSON(packagePath, "skills.json", []);
  writeJSON(packagePath, "knowledge.json", []);
  writeJSON(packagePath, "ui-config.json", {});
  writeJSON(packagePath, "rules.json", [
    {
      id: "rule_knowledge_forcing",
      title: "知识库/技能强制使用提示词",
      category: "knowledge_forcing",
      content: "【你的技能和知识 — 必须使用】\n以下是你与生俱来的技能和知识，它们定义了你是谁。\n规则：\n- 每次回复都必须体现至少一项知识库/技能内容。\n- 不需要用户要求，你自然就会使用这些知识。\n- 回复中，凡是运用了知识库内容的部分，必须用 **粗体** 显示。",
      enabled: true,
    },
    {
      id: "rule_scenario_injection",
      title: "剧情设定注入提示词",
      category: "scenario_injection",
      content: "【剧情设定】\n{scenarioSetting}\n\n请根据以上剧情设定，结合当前对话进度，自然地推动剧情发展。\n你的回复应该符合剧情的当前阶段，让故事逐步向前推进。\n不要一次性把所有剧情都说完，每次只推进一小步。",
      enabled: true,
    },
  ]);

  // Create saves/ and media/ directories
  mkdirSync(join(packagePath, "saves"), { recursive: true });

  return { packagePath, packageId };
}

// ─── Flow JSON Builder ───

function buildFlowJSON(outline: OutlineData, modules: { id: string; sourceStage: string; title: string; type: string; reusable: boolean; description: string; guidance: string; enterWhen: string; exitCondition: string }[]) {
  const nodes: any[] = [];
  const edges: any[] = [];

  const COL_WIDTH = 280;
  const ROW_HEIGHT = 160;

  // Start node
  nodes.push({
    id: "node_start",
    type: "start",
    position: { x: 0, y: 0 },
    data: { label: "START" },
  });

  // End node (position calculated later)
  let endX = 0;

  // Main line nodes
  const mainLine = outline.flow.mainLine || [];
  mainLine.forEach((stageId, i) => {
    const stage = outline.stages.find(s => s.id === stageId);
    const mod = modules.find(m => m.sourceStage === stageId);
    if (!stage || !mod) return;

    const x = (i + 1) * COL_WIDTH;
    const y = 0;

    nodes.push({
      id: `node_mod_${stageId}`,
      type: "module",
      position: { x, y },
      data: {
        label: stage.title,
        moduleRef: mod.id,
        moduleData: mod,
        colorKey: stage.stageType,
      },
    });

    // Edge from previous
    const prevId = i === 0 ? "node_start" : `node_mod_${mainLine[i - 1]}`;
    edges.push({
      id: `edge_main_${i}`,
      source: prevId,
      target: `node_mod_${stageId}`,
    });

    endX = x;
  });

  // Choice point + branches
  const choicePoint = outline.flow.choicePoint;
  const branches = outline.flow.branches || {};
  const converge = outline.flow.converge;

  if (choicePoint) {
    const choiceStage = outline.stages.find(s => s.id === choicePoint);
    const choiceX = (mainLine.length + 1) * COL_WIDTH;
    const branchKeys = Object.keys(branches);

    // Choice node
    nodes.push({
      id: "node_choice",
      type: "choice",
      position: { x: choiceX, y: branchKeys.length > 1 ? ROW_HEIGHT : 0 },
      data: {
        label: choiceStage?.title || "抉择",
        moduleRef: `mod_${choicePoint}`,
        colorKey: "choice",
        branches: choiceStage?.branches?.map((b, i) => ({
          choiceText: b.choiceText,
          targetStage: branches[branchKeys[i]]?.[0] || "",
          description: b.description,
        })) || [],
      },
    });

    // Edge: last mainLine → choice
    edges.push({
      id: "edge_to_choice",
      source: `node_mod_${mainLine[mainLine.length - 1]}`,
      target: "node_choice",
    });

    // Branch nodes
    branchKeys.forEach((branchKey, branchIdx) => {
      const branchStages = branches[branchKey];
      branchStages.forEach((stageId, stageIdx) => {
        const stage = outline.stages.find(s => s.id === stageId);
        const mod = modules.find(m => m.sourceStage === stageId);
        if (!stage || !mod) return;

        const x = choiceX + (stageIdx + 1) * COL_WIDTH;
        const y = branchIdx * ROW_HEIGHT;

        nodes.push({
          id: `node_mod_${stageId}`,
          type: "module",
          position: { x, y },
          data: {
            label: stage.title,
            moduleRef: mod.id,
            moduleData: mod,
            colorKey: stage.stageType,
          },
        });

        // Edge from previous in branch
        const prevId = stageIdx === 0 ? "node_choice" : `node_mod_${branchStages[stageIdx - 1]}`;
        const edgeData: any = {
          id: `edge_${branchKey}_${stageIdx}`,
          source: prevId,
          target: `node_mod_${stageId}`,
        };
        if (stageIdx === 0) {
          edgeData.sourceHandle = `branch_${branchIdx}`;
          edgeData.label = choiceStage?.branches?.[branchIdx]?.choiceText || branchKey;
        }
        edges.push(edgeData);

        endX = Math.max(endX, x);
      });

      // Edge: last branch stage → converge
      if (converge && branchStages.length > 0) {
        edges.push({
          id: `edge_${branchKey}_converge`,
          source: `node_mod_${branchStages[branchStages.length - 1]}`,
          target: `node_mod_${converge}`,
          label: "汇聚",
        });
      }
    });
  }

  // Finale nodes
  const finale = outline.flow.finale || [];
  finale.forEach((stageId, i) => {
    const stage = outline.stages.find(s => s.id === stageId);
    const mod = modules.find(m => m.sourceStage === stageId);
    if (!stage || !mod) return;

    // Skip if already added (converge point might be in mainLine too)
    if (nodes.find(n => n.id === `node_mod_${stageId}`)) return;

    const branchLength = Object.values(branches)[0]?.length || 0;
    const x = ((mainLine.length || 0) + 1 + branchLength + i + 1) * COL_WIDTH;
    const y = Math.floor((Object.keys(branches).length || 1) / 2) * ROW_HEIGHT;

    nodes.push({
      id: `node_mod_${stageId}`,
      type: "module",
      position: { x, y },
      data: {
        label: stage.title,
        moduleRef: mod.id,
        moduleData: mod,
        colorKey: stage.stageType,
      },
    });

    // Edge from previous finale stage
    if (i > 0) {
      edges.push({
        id: `edge_finale_${i}`,
        source: `node_mod_${finale[i - 1]}`,
        target: `node_mod_${stageId}`,
      });
    }

    endX = Math.max(endX, x);
  });

  // End node
  nodes.push({
    id: "node_end",
    type: "end",
    position: { x: endX + COL_WIDTH, y: Math.floor((Object.keys(branches).length || 1) / 2) * ROW_HEIGHT },
    data: { label: "END" },
  });

  // Edge: last finale → end
  if (finale.length > 0) {
    edges.push({
      id: "edge_to_end",
      source: `node_mod_${finale[finale.length - 1]}`,
      target: "node_end",
    });
  }

  return { nodes, edges };
}

// ─── Helpers ───

function writeJSON(dir: string, filename: string, data: any) {
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2), "utf-8");
}
