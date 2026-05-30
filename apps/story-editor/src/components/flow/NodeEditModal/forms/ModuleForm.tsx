import type { FormProps } from "../types.js";
import { F, TagSelect } from "../shared.js";
import { PerformanceSection } from "./PerformanceSection.js";

export function ModuleForm({ draft, setDraft, modules: allModules, groupNodes, charOptions, skillOptions, stageOptions }: FormProps) {
  // Determine the stage ID for performance binding
  const stageId = (draft.moduleData as any)?.sourceStage || draft.moduleRef?.replace("mod_", "") || undefined;

  return (
    <>
      <div className="form-grid cols-2">
        <F label="模块名称" hint="在节点上显示的标题">
          <input className="input" value={draft.label || ""}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="如：① 落网之凤" />
        </F>
        <F label="模块类型" hint="决定引擎如何处理此阶段">
          <select className="input" value={(draft.colorKey as string) || "training"}
            onChange={(e) => setDraft({ ...draft, colorKey: e.target.value })}>
            <option value="training">训练 (training)</option>
            <option value="serving">侍寝 (serving)</option>
            <option value="punishment">惩戒 (punishment)</option>
            <option value="daily">日常 (daily)</option>
            <option value="finale">终章 (finale)</option>
          </select>
        </F>
      </div>
      <F label="父容器" hint="将此模块放入循环或阶段容器内（拖放到容器内会自动设置）">
        <select className="input" value={(draft.parentId as string) || ""}
          onChange={(e) => setDraft({ ...draft, parentId: e.target.value || undefined })}>
          <option value="">无（顶层节点）</option>
          {groupNodes.map((g) => <option key={g.id} value={g.id}>{g.label} ({g.type})</option>)}
        </select>
      </F>
      <F label="或绑定已有模块" hint="选择 modules.json 中已定义的模块，留空则为独立节点">
        <select className="input" value={(draft.moduleRef as string) || ""}
          onChange={(e) => {
            const ref = e.target.value || undefined;
            const mod = allModules.find((m) => m.id === ref);
            setDraft({ ...draft, moduleRef: ref, label: mod?.title || draft.label, moduleData: mod as any });
          }}>
          <option value="">独立节点（手动填写）</option>
          {allModules.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.id})</option>)}
        </select>
      </F>
      {!draft.moduleRef && (
        <>
          <F label="来源阶段" hint="对应 scenario.json 中的 stage ID">
            <select className="input" value={(draft.moduleData as any)?.sourceStage || ""}
              onChange={(e) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), sourceStage: e.target.value || undefined } })}>
              <option value="">无</option>
              {stageOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </F>
          <F label="需要角色" hint="此模块涉及的角色">
            <TagSelect label="角色" options={charOptions}
              selected={(draft.moduleData as any)?.requiredCharacters || []}
              onAdd={(id) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), requiredCharacters: [...((draft.moduleData as any)?.requiredCharacters || []), id] } })}
              onRemove={(id) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), requiredCharacters: ((draft.moduleData as any)?.requiredCharacters || []).filter((c: string) => c !== id) } })}
            />
          </F>
          <F label="消耗技能" hint="此模块触发时消耗的技能">
            <TagSelect label="技能" options={skillOptions}
              selected={(draft.moduleData as any)?.consumesSkills || []}
              onAdd={(id) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), consumesSkills: [...((draft.moduleData as any)?.consumesSkills || []), id] } })}
              onRemove={(id) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), consumesSkills: ((draft.moduleData as any)?.consumesSkills || []).filter((s: string) => s !== id) } })}
            />
          </F>
          <F label="模块描述" hint="LLM 看到此阶段时的背景说明">
            <textarea className="input" rows={3} value={(draft.moduleData as any)?.description || ""}
              onChange={(e) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), description: e.target.value } })} />
          </F>
          <F label="AI 引导语 (guidance)" hint="具体剧情走向、角色行为、氛围、推进条件">
            <textarea className="input mono" rows={6}
              value={(draft.moduleData as any)?.guidance || ""}
              onChange={(e) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), guidance: e.target.value } })}
              placeholder={"氛围：阴冷潮湿的地牢中...\n\n角色A：**动作**（描述）\n→ 推进条件：角色A完成训练目标"} />
          </F>
          <div className="form-grid cols-2">
            <F label="进入条件" hint="此模块被触发的叙事条件">
              <input className="input" value={(draft.moduleData as any)?.enterWhen || ""}
                onChange={(e) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), enterWhen: e.target.value } })} />
            </F>
            <F label="退出条件" hint="此模块可以结束的叙事条件">
              <input className="input" value={(draft.moduleData as any)?.exitCondition || ""}
                onChange={(e) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), exitCondition: e.target.value } })} />
            </F>
          </div>
        </>
      )}

      {/* 演出绑定 */}
      <PerformanceSection stageId={stageId} moduleLabel={draft.label || ""} />
    </>
  );
}
