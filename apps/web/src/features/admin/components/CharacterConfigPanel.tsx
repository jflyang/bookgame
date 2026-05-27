import { useEffect, useMemo, useState } from "react";
import { Camera, FileUp, Plus, Save, Trash2, X } from "lucide-react";
import type { Character, CharacterId, KnowledgeDocument } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";

const AVATAR_COLORS: Record<string, string> = {
  qiaofeng: "linear-gradient(135deg, #d6c1a2, #475569)",
  xuzhu: "linear-gradient(135deg, #f1eee4, #9ca3af)",
  duanyu: "linear-gradient(135deg, #d7d6c8, #64748b)",
  dingchunqiu: "linear-gradient(135deg, #f8fafc, #94a3b8)",
};

function getAvatarChar(name: string) {
  return name.charAt(0);
}

function getAvatarBg(id: string) {
  return AVATAR_COLORS[id] ?? "linear-gradient(135deg, #cbd5e1, #64748b)";
}

function isImageAvatar(avatar: string) {
  return avatar.startsWith("data:image") || avatar.startsWith("http");
}

function readAvatarFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!file.type.startsWith("image/")) {
        resolve(dataUrl);
        return;
      }
      const image = document.createElement("img");
      image.onload = () => {
        const maxSize = 512;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        if (scale === 1 && file.size < 500 * 1024) {
          resolve(dataUrl);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(dataUrl);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      image.onerror = () => resolve(dataUrl);
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/* ─── RoleCard ─── */

function RoleCard({
  character,
  selected,
  onClick,
  onAvatarUpload,
}: {
  character: Character;
  selected: boolean;
  onClick: () => void;
  onAvatarUpload: (file: File) => void;
}) {
  const hasImage = isImageAvatar(character.avatar);
  return (
    <button
      className={`role-card ${selected ? "selected" : ""}`}
      onClick={onClick}
      type="button"
      aria-label={`编辑角色 ${character.name}`}
    >
      <div className="role-card-top">
        <span
          className="role-card-avatar"
          style={hasImage
            ? { backgroundImage: `url(${character.avatar})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: getAvatarBg(character.id) }}
        >
          {!hasImage && getAvatarChar(character.name)}
          <label
            className="avatar-upload-trigger"
            title="上传头像"
            onClick={(e) => e.stopPropagation()}
          >
            <Camera size={12} />
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAvatarUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </span>
        <div className="role-card-info">
          <span className="role-card-name">{character.name}</span>
        </div>
      </div>
    </button>
  );
}

/* ─── RoleCardList ─── */

function RoleCardList({
  characters,
  selectedId,
  onSelect,
  onAvatarUpload,
  onAddCharacter,
}: {
  characters: Character[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAvatarUpload: (characterId: string, file: File) => void;
  onAddCharacter: () => void;
}) {
  return (
    <aside className="role-card-list">
      <h3 className="role-card-list-title">角色列表</h3>
      {characters.map((ch) => (
        <RoleCard
          key={ch.id}
          character={ch}
          selected={selectedId === ch.id}
          onClick={() => onSelect(ch.id)}
          onAvatarUpload={(file) => onAvatarUpload(ch.id, file)}
        />
      ))}
      <button className="add-character-btn" onClick={onAddCharacter} type="button">
        <Plus size={18} /> 新增角色
      </button>
    </aside>
  );
}

/* ─── RoleEditorPanel ─── */

function RoleEditorPanel({
  draft,
  onChange,
  ownedDocs,
  initialState,
  onImport,
  onRemoveDoc,
  onSave,
  onAvatarUpload,
  onInitialStateChange,
  onDelete,
}: {
  draft: Character;
  onChange: (next: Character) => void;
  ownedDocs: KnowledgeDocument[];
  initialState: { hp: number; mp: number };
  onImport: (files: FileList | null) => void;
  onRemoveDoc: (id: string) => void;
  onSave: () => void;
  onAvatarUpload: (file: File) => void;
  onInitialStateChange: (field: "hp" | "mp", value: number) => void;
  onDelete: () => void;
}) {
  const hasImage = isImageAvatar(draft.avatar);
  return (
    <section className="role-editor-panel">
      <div className="role-editor-header">
        <span
          className="role-editor-avatar"
          style={hasImage
            ? { backgroundImage: `url(${draft.avatar})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: getAvatarBg(draft.id) }}
        >
          {!hasImage && getAvatarChar(draft.name)}
          <label className="avatar-upload-trigger editor-avatar-upload" title="上传头像">
            <Camera size={14} />
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAvatarUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </span>
        <div>
          <span className="role-editor-name">{draft.name}</span>
          <span className="role-editor-role">{draft.role}</span>
        </div>
        <span className="role-editor-badge">当前编辑</span>
      </div>

      {/* 基础信息 */}
      <div className="role-editor-section">
        <h4 className="role-section-title">基础信息</h4>
        <div className="role-basic-grid">
          <label className="role-field">
            <span>角色名称</span>
            <input
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="role-field">
            <span>角色定位</span>
            <input
              value={draft.role}
              onChange={(e) => onChange({ ...draft, role: e.target.value })}
            />
          </label>
          <label className="role-field">
            <span>初始气血</span>
            <input
              type="number"
              value={initialState.hp}
              onChange={(e) => onInitialStateChange("hp", Number(e.target.value) || 0)}
            />
          </label>
          <label className="role-field">
            <span>初始内力</span>
            <input
              type="number"
              value={initialState.mp}
              onChange={(e) => onInitialStateChange("mp", Number(e.target.value) || 0)}
            />
          </label>
        </div>
      </div>

      {/* 角色 Prompt */}
      <div className="role-editor-section">
        <h4 className="role-section-title">角色 Prompt</h4>
        <p className="role-section-desc">
          定义角色身份、性格、说话风格、行为边界和战斗策略。
        </p>
        <textarea
          className="role-prompt-textarea"
          value={draft.personaPrompt}
          onChange={(e) => onChange({ ...draft, personaPrompt: e.target.value })}
          placeholder="输入角色系统提示词..."
        />
      </div>

      {/* Markdown 知识库 */}
      <div className="role-editor-section">
        <h4 className="role-section-title">Markdown 知识库</h4>
        <p className="role-section-desc">
          用于配置角色技能、知识、招式和可引用内容。
        </p>
        <label className="knowledge-upload-zone">
          <FileUp size={20} />
          <span>上传知识库文件</span>
          <input
            type="file"
            multiple
            accept=".md,.txt,text/markdown,text/plain"
            style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
            onChange={(event) => {
              onImport(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {ownedDocs.length > 0 ? (
          <div className="knowledge-doc-list">
            {ownedDocs.map((doc) => (
              <article key={doc.id} className="knowledge-doc-row">
                <div className="knowledge-doc-info">
                  <strong>{doc.title}</strong>
                  <small>{doc.content.slice(0, 80)}{doc.content.length > 80 ? "..." : ""}</small>
                </div>
                <button
                  className="paper-icon"
                  onClick={() => onRemoveDoc(doc.id)}
                  aria-label={`删除 ${doc.title}`}
                  title={`删除 ${doc.title}`}
                >
                  <X size={16} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            还没有上传 Markdown 知识库。招数、背景、口吻样例都可以放在这里。
          </p>
        )}
      </div>

      {/* 操作区 */}
      <div className="editor-actions">
        <button className="admin-save-button" onClick={onSave}>
          <Save size={16} /> 保存角色
        </button>
        <button className="danger-button" onClick={onDelete}>
          <Trash2 size={16} /> 删除角色
        </button>
      </div>
    </section>
  );
}

/* ─── NewCharacterForm ─── */

const DEFAULT_NEW_FORM = {
  name: "",
  role: "",
  hp: 500,
  mp: 500,
  personaPrompt: "",
};

function NewCharacterForm({
  form,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: typeof DEFAULT_NEW_FORM;
  onChange: (next: typeof DEFAULT_NEW_FORM) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const valid = form.name.trim().length > 0;
  return (
    <section className="role-editor-panel">
      <div className="role-editor-header">
        <span className="role-editor-avatar" style={{ background: "linear-gradient(135deg, #f97316, #fb923c)" }}>
          <Plus size={24} />
        </span>
        <div>
          <span className="role-editor-name">新建角色</span>
          <span className="role-editor-role">填写角色基本信息</span>
        </div>
        <span className="role-editor-badge" style={{ background: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.25)", color: "#c2410c" }}>新建</span>
      </div>

      <div className="role-editor-section">
        <h4 className="role-section-title">基础信息</h4>
        <div className="role-basic-grid">
          <label className="role-field">
            <span>角色名称 *</span>
            <input
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="例如：扫地僧"
            />
          </label>
          <label className="role-field">
            <span>角色定位</span>
            <input
              value={form.role}
              onChange={(e) => onChange({ ...form, role: e.target.value })}
              placeholder="例如：隐藏高手"
            />
          </label>
          <label className="role-field">
            <span>初始气血</span>
            <input
              type="number"
              value={form.hp}
              onChange={(e) => onChange({ ...form, hp: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="role-field">
            <span>初始内力</span>
            <input
              type="number"
              value={form.mp}
              onChange={(e) => onChange({ ...form, mp: Number(e.target.value) || 0 })}
            />
          </label>
        </div>
      </div>

      <div className="role-editor-section">
        <h4 className="role-section-title">初始 Prompt（可选）</h4>
        <p className="role-section-desc">
          为新角色预设身份、性格和说话风格，后续可在编辑器中继续调整。
        </p>
        <textarea
          className="role-prompt-textarea"
          style={{ minHeight: 160 }}
          value={form.personaPrompt}
          onChange={(e) => onChange({ ...form, personaPrompt: e.target.value })}
          placeholder="定义角色的初始人设..."
        />
      </div>

      <div className="editor-actions" style={{ gap: 10 }}>
        <button className="ghost-button" onClick={onCancel} type="button">取消</button>
        <button className="btn-continue" onClick={onSubmit} disabled={!valid} type="button">
          <Plus size={16} /> 创建角色
        </button>
      </div>
    </section>
  );
}

export function CharacterConfigPanel() {
  const {
    characters,
    knowledgeDocuments,
    storyPackages,
    editingPackageId,
    saveCharacter,
    saveKnowledgeDocuments,
    saveStoryPackage,
  } = useGameStore();

  const storyPackage = useMemo(
    () => storyPackages.find((p) => p.id === editingPackageId) ?? null,
    [storyPackages, editingPackageId],
  );

  const initialStates = storyPackage?.scenario?.initialStates ?? [];

  const [selectedId, setSelectedId] = useState<string>("qiaofeng");
  const selected = useMemo(
    () => characters.find((c) => c.id === selectedId) ?? characters[0],
    [characters, selectedId],
  );
  const [draft, setDraft] = useState<Character | null>(selected ?? null);
  const [initialStateDraft, setInitialStateDraft] = useState<{ hp: number; mp: number }>({ hp: 0, mp: 0 });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newForm, setNewForm] = useState({ ...DEFAULT_NEW_FORM });

  useEffect(() => {
    setDraft(selected ?? null);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const initialState = initialStates.find((state) => state.characterId === selected.id);
    setInitialStateDraft({ hp: initialState?.hp ?? 0, mp: initialState?.mp ?? 0 });
  }, [selected?.id, storyPackage?.id]);

  useEffect(() => {
    if (characters.length > 0 && !characters.find((c) => c.id === selectedId)) {
      setSelectedId(characters[0].id);
    }
  }, [characters, selectedId]);

  if (!draft && !isAddingNew) return null;

  const ownedDocs = draft ? knowledgeDocuments.filter((d) => d.ownerId === draft.id) : [];
  async function handleAvatarUpload(characterId: string, file: File) {
    const dataUrl = await readAvatarFile(file);
    const target = characterId === draft?.id ? draft : characters.find((c) => c.id === characterId);
    if (!target || !storyPackage) return;
    const updated = { ...target, avatar: dataUrl };
    if (characterId === draft?.id) {
      setDraft(updated);
    }
    const nextCharacters = characters.map((c) => (c.id === characterId ? updated : c));
    await saveStoryPackage({
      ...storyPackage,
      characters: nextCharacters,
      knowledgeDocuments
    });
  }

  function updateInitialState(field: "hp" | "mp", value: number) {
    setInitialStateDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveRole() {
    if (!draft) return;
    if (!storyPackage) {
      await saveCharacter(draft);
      return;
    }
    const nextCharacters = characters.map((character) => (character.id === draft.id ? draft : character));
    const existing = storyPackage.scenario.initialStates.find((state) => state.characterId === draft.id);
    const nextInitialStates = existing
      ? storyPackage.scenario.initialStates.map((state) =>
          state.characterId === draft.id ? { ...state, ...initialStateDraft } : state
        )
      : [...storyPackage.scenario.initialStates, { characterId: draft.id as CharacterId, ...initialStateDraft }];

    await saveStoryPackage({
      ...storyPackage,
      characters: nextCharacters,
      knowledgeDocuments,
      scenario: {
        ...storyPackage.scenario,
        initialStates: nextInitialStates
      }
    });
    setDraft(draft);
  }

  function handleAddCharacter() {
    setIsAddingNew(true);
    setNewForm({ ...DEFAULT_NEW_FORM });
  }

  function handleCreateCharacter() {
    if (!newForm.name.trim()) return;
    const id = `char_${Date.now()}`;
    const newChar: Character = {
      id,
      name: newForm.name.trim(),
      role: newForm.role.trim(),
      avatar: "",
      personaPrompt: newForm.personaPrompt,
      rules: [],
      skillIds: [],
      knowledgeBaseIds: [],
    };
    const nextCharacters = [...characters, newChar];
    const pkg = storyPackages.find((p) => p.id === editingPackageId);
    if (pkg) {
      const nextScenario = {
        ...pkg.scenario,
        initialStates: [
          ...pkg.scenario.initialStates,
          { characterId: id, hp: newForm.hp, mp: newForm.mp },
        ],
      };
      useGameStore.getState().saveStoryPackage({
        ...pkg,
        characters: nextCharacters,
        scenario: nextScenario,
      });
    }
    setIsAddingNew(false);
    setSelectedId(id);
  }

  function handleCancelAdd() {
    setIsAddingNew(false);
    setNewForm({ ...DEFAULT_NEW_FORM });
  }

  async function handleDeleteCharacter(characterId: string) {
    if (characters.length <= 1) {
      window.alert("至少保留一个角色");
      return;
    }
    const target = characters.find((c) => c.id === characterId);
    if (!target) return;
    if (!window.confirm(`确定删除角色 ${target.name}？此操作不可撤销。`)) return;

    const pkg = storyPackages.find((p) => p.id === editingPackageId);
    if (!pkg) return;

    const nextCharacters = characters.filter((c) => c.id !== characterId);
    const nextInitialStates = pkg.scenario.initialStates.filter((s) => s.characterId !== characterId);
    const nextDocs = knowledgeDocuments.filter((d) => d.ownerId !== characterId);

    await saveStoryPackage({
      ...pkg,
      characters: nextCharacters,
      scenario: { ...pkg.scenario, initialStates: nextInitialStates },
      knowledgeDocuments: nextDocs,
    });

    if (selectedId === characterId) {
      setSelectedId(nextCharacters[0]?.id ?? "");
    }
  }

  async function importMarkdown(files: FileList | null) {
    if (!draft || !files?.length) return;
    const now = new Date().toISOString();
    const imported: KnowledgeDocument[] = await Promise.all(
      Array.from(files).map(async (file) => ({
        id: `kb_${draft.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: file.name.replace(/\.(md|txt)$/i, ""),
        ownerId: draft.id,
        content: await file.text(),
        sourceType: "markdown" as const,
        createdAt: now,
        updatedAt: now,
      })),
    );
    const nextDraft = {
      ...draft,
      knowledgeBaseIds: [...draft.knowledgeBaseIds, ...imported.map((d) => d.id)],
    };
    const nextCharacters = characters.map((c) =>
      c.id === nextDraft.id ? nextDraft : c,
    );
    await saveKnowledgeDocuments([...knowledgeDocuments, ...imported], nextCharacters);
    setDraft(nextDraft);
  }

  async function removeDocument(documentId: string) {
    if (!draft) return;
    const nextDocs = knowledgeDocuments.filter((d) => d.id !== documentId);
    const nextDraft = {
      ...draft,
      knowledgeBaseIds: draft.knowledgeBaseIds.filter((id) => id !== documentId),
    };
    const nextCharacters = characters.map((c) =>
      c.id === nextDraft.id
        ? nextDraft
        : {
            ...c,
            knowledgeBaseIds: c.knowledgeBaseIds.filter((id) => id !== documentId),
          },
    );
    await saveKnowledgeDocuments(nextDocs, nextCharacters);
    setDraft(nextDraft);
  }

  return (
    <div className="role-config-layout">
      <RoleCardList
        characters={characters}
        selectedId={isAddingNew ? "" : draft?.id ?? ""}
        onSelect={(id) => { setIsAddingNew(false); setSelectedId(id); }}
        onAvatarUpload={handleAvatarUpload}
        onAddCharacter={handleAddCharacter}
      />
      {isAddingNew ? (
        <NewCharacterForm
          form={newForm}
          onChange={setNewForm}
          onSubmit={handleCreateCharacter}
          onCancel={handleCancelAdd}
        />
      ) : draft ? (
        <RoleEditorPanel
          draft={draft}
          onChange={setDraft}
          ownedDocs={ownedDocs}
          initialState={initialStateDraft}
          onImport={importMarkdown}
          onRemoveDoc={removeDocument}
          onSave={() => void handleSaveRole()}
          onAvatarUpload={async (file) => {
            const dataUrl = await readAvatarFile(file);
            const updated = { ...draft, avatar: dataUrl };
            setDraft(updated);
            await handleAvatarUpload(draft.id, file);
          }}
          onInitialStateChange={updateInitialState}
          onDelete={() => { void handleDeleteCharacter(draft.id); }}
        />
      ) : null}
    </div>
  );
}
