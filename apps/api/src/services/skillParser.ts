import type { Character, KnowledgeDocument } from "@story-game/shared";
import type { ParsedSkill } from "./skillIndex.js";

const SKILL_HEADER = /^## (.+)$/gm;
const MP_RE = /内力[：:]\s*(\d+|[全部]+)/;
const DAMAGE_RE = /伤害[：:]\s*(\d+)\\?[~～]\s*(\d+)/;
const EFFECT_RE = /效果[：:]\s*(.+)/;
const ATTACK_TARGET_RE = /可攻击目标[：:]\s*(.+)/;

// ─── Legacy: parse combat skills from knowledge docs ───

export function parseSkillsFromKnowledgeDocs(
  docs: KnowledgeDocument[],
): ParsedSkill[] {
  const skills: ParsedSkill[] = [];
  const seen = new Set<string>();

  for (const doc of docs) {
    const content = doc.content;
    const sections = splitSections(content);

    for (const section of sections) {
      const name = section.header.trim();
      const body = section.body;

      if (!isSkillSection(name, body)) continue;

      const mpRaw = body.match(MP_RE)?.[1] ?? "0";
      const mp = mpRaw === "全部" ? 999 : parseInt(mpRaw, 10) || 0;

      const dmgMatch = body.match(DAMAGE_RE);
      const damage = dmgMatch
        ? { min: parseInt(dmgMatch[1], 10), max: parseInt(dmgMatch[2], 10) }
        : undefined;

      const effect = body.match(EFFECT_RE)?.[1]?.trim();

      const id = name;
      if (seen.has(id)) continue;
      seen.add(id);

      skills.push({
        id,
        name,
        ownerId: doc.ownerId ?? "unknown",
        cost: { mp },
        damage,
        effect,
      });
    }
  }

  return skills;
}

// ─── v2: Parse narrative actions from knowledge docs ───

const ACTION_HEADER = /^##\s*行动[：:]\s*(.+)$/gm;
const ACTION_DESC = /描述[：:]\s*(.+)/;
const TARGET_HINT = /目标[：:]\s*(.+)/;

export interface ParsedAction {
  id: string;
  name: string;
  ownerId: string;
  description: string;
}

export function parseActionsFromKnowledgeDocs(
  docs: KnowledgeDocument[],
): ParsedAction[] {
  const actions: ParsedAction[] = [];
  const seen = new Set<string>();

  for (const doc of docs) {
    if (!doc.ownerId) continue;
    const content = doc.content;
    const sections = splitSectionsByHeader(content, ACTION_HEADER);

    for (const section of sections) {
      const name = section.header.trim();
      const body = section.body;

      const descMatch = body.match(ACTION_DESC);
      if (!descMatch) continue;

      const description = descMatch[1].trim();

      const id = `act_${doc.ownerId}_${name}`;
      if (seen.has(id)) continue;
      seen.add(id);

      actions.push({ id, name, ownerId: doc.ownerId, description });
    }
  }

  return actions;
}

// ─── v2: Parse passive reactions from knowledge docs ───

const REACTION_HEADER = /^##\s*被动[：:]\s*(.+)$/gm;
const REACTION_TRIGGER = /触发[：:]\s*(.+)/;
const REACTION_DESC = /描述[：:]\s*(.+)/;

export interface ParsedReaction {
  id: string;
  ownerId: string;
  name: string;
  trigger: string;
  description: string;
}

export function parseReactionsFromKnowledgeDocs(
  docs: KnowledgeDocument[],
): ParsedReaction[] {
  const reactions: ParsedReaction[] = [];
  const seen = new Set<string>();

  for (const doc of docs) {
    if (!doc.ownerId) continue;
    const content = doc.content;
    const sections = splitSectionsByHeader(content, REACTION_HEADER);

    for (const section of sections) {
      const name = section.header.trim();
      const body = section.body;

      const triggerMatch = body.match(REACTION_TRIGGER);
      const descMatch = body.match(REACTION_DESC);
      if (!triggerMatch || !descMatch) continue;

      const trigger = triggerMatch[1].trim();
      const description = descMatch[1].trim();

      const id = `react_${doc.ownerId}_${name}`;
      if (seen.has(id)) continue;
      seen.add(id);

      reactions.push({ id, ownerId: doc.ownerId, name, trigger, description });
    }
  }

  return reactions;
}

// ─── Shared section parser ───

interface Section {
  header: string;
  body: string;
}

function splitSections(content: string): Section[] {
  return splitSectionsByHeader(content, SKILL_HEADER);
}

function splitSectionsByHeader(content: string, headerRegex: RegExp): Section[] {
  const sections: Section[] = [];
  const regex = new RegExp(headerRegex);
  let match: RegExpExecArray | null;
  const starts: Array<{ index: number; header: string }> = [];

  while ((match = regex.exec(content)) !== null) {
    starts.push({ index: match.index, header: match[1] });
  }

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index;
    const end = i + 1 < starts.length ? starts[i + 1].index : content.length;
    sections.push({
      header: starts[i].header,
      body: content.slice(start, end),
    });
  }

  return sections;
}

// ─── Legacy helpers ───

const NON_SKILL_PATTERNS = [
  /^[六一二三四五六七八九十]、/,
  /知识库/,
  /角色定位/,
  /战斗判断/,
  /使用规则/,
  /^乔峰知识库/,
  /行动/,
  /被动/,
];

function isSkillSection(name: string, body: string): boolean {
  if (NON_SKILL_PATTERNS.some((p) => p.test(name))) return false;
  return MP_RE.test(body);
}

export function parseAttackTargetsFromKnowledgeDocs(
  docs: KnowledgeDocument[],
  characters: Character[],
): Map<string, string[]> {
  const nameToId = new Map(characters.map((c) => [c.name, c.id]));
  const result = new Map<string, string[]>();

  for (const doc of docs) {
    if (!doc.ownerId) continue;
    const match = doc.content.match(ATTACK_TARGET_RE);
    if (!match) continue;
    const targetNames = match[1].split(/[、，,]/).map((s) => s.trim()).filter(Boolean);
    const targetIds = targetNames.map((name) => nameToId.get(name)).filter((id): id is string => !!id);
    if (targetIds.length > 0) {
      result.set(doc.ownerId, targetIds);
    }
  }

  return result;
}
