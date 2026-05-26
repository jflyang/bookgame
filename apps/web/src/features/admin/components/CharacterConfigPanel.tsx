import { useEffect, useMemo, useState } from "react";
import { BookOpen, FileUp, Save, X } from "lucide-react";
import type { Character, KnowledgeDocument } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";

export function CharacterConfigPanel() {
  const { characters, knowledgeDocuments, saveCharacter, saveKnowledgeDocuments } = useGameStore();
  const [selectedId, setSelectedId] = useState<string>("qiaofeng");
  const selected = useMemo(() => characters.find((item) => item.id === selectedId) ?? characters[0], [characters, selectedId]);
  const [draft, setDraft] = useState<Character | null>(selected ?? null);

  useEffect(() => {
    setDraft(selected ?? null);
  }, [selected]);

  if (!draft) return null;

  const ownedDocs = knowledgeDocuments.filter((document) => document.ownerId === draft.id);

  async function importMarkdown(files: FileList | null) {
    if (!draft || !files?.length) return;
    const now = new Date().toISOString();
    const imported: KnowledgeDocument[] = await Promise.all(Array.from(files).map(async (file) => ({
      id: `kb_${draft.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: file.name.replace(/\.md$/i, ""),
      ownerId: draft.id,
      content: await file.text(),
      sourceType: "markdown" as const,
      createdAt: now,
      updatedAt: now
    })));
    const nextDraft = {
      ...draft,
      knowledgeBaseIds: [...draft.knowledgeBaseIds, ...imported.map((document) => document.id)]
    };
    const nextCharacters = characters.map((character) => (character.id === nextDraft.id ? nextDraft : character));
    await saveKnowledgeDocuments([...knowledgeDocuments, ...imported], nextCharacters);
    setDraft(nextDraft);
  }

  async function removeDocument(documentId: string) {
    if (!draft) return;
    const nextDocs = knowledgeDocuments.filter((document) => document.id !== documentId);
    const nextDraft = {
      ...draft,
      knowledgeBaseIds: draft.knowledgeBaseIds.filter((id) => id !== documentId)
    };
    const nextCharacters = characters.map((character) => (
      character.id === nextDraft.id
        ? nextDraft
        : { ...character, knowledgeBaseIds: character.knowledgeBaseIds.filter((id) => id !== documentId) }
    ));
    await saveKnowledgeDocuments(nextDocs, nextCharacters);
    setDraft(nextDraft);
  }

  return (
    <section className="panel character-config">
      <h2><BookOpen size={16} /> 角色 Agent</h2>
      <label>
        角色
        <select value={draft.id} onChange={(event) => setSelectedId(event.target.value)}>
          {characters.map((character) => (
            <option key={character.id} value={character.id}>{character.name}</option>
          ))}
        </select>
      </label>
      <label>
        主提示词
        <textarea
          className="prompt-editor"
          value={draft.personaPrompt}
          onChange={(event) => setDraft({ ...draft, personaPrompt: event.target.value })}
        />
      </label>
      <div className="knowledge-list" aria-label="Markdown 知识库">
        <span className="field-title">Markdown 知识库</span>
        <label className="import-drop">
          <FileUp size={16} /> 上传知识库文件
          <input
            type="file"
            multiple
            accept=".md,text/markdown,text/plain"
            hidden
            onChange={(event) => {
              void importMarkdown(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {ownedDocs.map((document) => (
          <article key={document.id} className="document-row">
            <div>
              <strong>{document.title}</strong>
              <small>{document.content.slice(0, 100)}</small>
            </div>
            <button className="icon-button" onClick={() => void removeDocument(document.id)} aria-label={`删除 ${document.title}`} title="删除知识库">
              <X size={16} />
            </button>
          </article>
        ))}
        {ownedDocs.length === 0 ? <p className="muted">还没有上传 Markdown 知识库。招数、背景、口吻样例都可以放在这里。</p> : null}
      </div>
      <button onClick={() => void saveCharacter(draft)}><Save size={16} /> 保存角色</button>
    </section>
  );
}
