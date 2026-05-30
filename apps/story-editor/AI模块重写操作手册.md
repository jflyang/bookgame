# AI 模块重写操作手册

## 场景

你在流程编辑器中重排了模块顺序（比如把"边缘交付"移到"真实口侍"之前），标题和主干流程是对的，但模块内部的 `guidance`（AI 引导语）、`description`、`enterWhen`、`exitCondition` 等细节不再匹配新的上下文关系。

需要让 AI 根据新顺序重写这些内容。

---

## 操作步骤

### 第一步：在编辑器中完成重排

1. 在流程画布中，拖拽边端点或使用右键菜单移动模块
2. 点击 **"自动布局"** 整理布局
3. 点击 **"💾 统一保存"** 保存到磁盘

### 第二步：导出重写任务文档

打开终端，运行：

```powershell
cd C:\Users\Administrator\Documents\GitHub\game\apps\story-editor
node scripts/export_for_ai_rewrite.cjs ../../data/task-packages/story_sSw0IetszN
```

这会在故事包目录下生成 `<故事名>-重写任务.md`（如 `小薇的身体-重写任务.md`）。

### 第三步：喂给 Claude Code

在 Claude Code 中，发送以下指令：

```
请阅读 apps/data/task-packages/story_sSw0IetszN/小薇的身体-重写任务.md，按照里面的指令执行。
```

Claude Code 会：
1. 自动备份当前 `modules.json` → `modules_backup.json`
2. 重写所有模块的 guidance/description/enterWhen/exitCondition
3. 直接写入 `modules.json`

### 第四步：验证

1. 在编辑器中点击 **"刷新"** 按钮重新加载
2. 双击各模块检查 guidance 是否合理
3. 如果不满意，把 `modules_backup.json` 改名回 `modules.json` 即可回滚

---

## 高级用法：只重写部分模块

如果只需要重写被移动的模块及其前后邻居，可以在指令中指定：

```
只重写以下模块的 guidance 和 enterWhen/exitCondition：
- mod_xxx（被移动的模块）
- mod_yyy（它的新前驱）
- mod_zzz（它的新后继）
- mod_www（它原来位置的前后模块，需要重新衔接）

其他模块保持不变。
```

---

## 导出脚本参数

```
node scripts/export_for_ai_rewrite.cjs <故事包目录> [输出文件路径]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| 故事包目录 | 必填，故事包的路径 | — |
| 输出文件路径 | 可选，输出 md 文件位置 | `<故事包目录>/ai-rewrite-task.md` |

---

## 文件说明

| 文件 | 作用 |
|------|------|
| `scripts/export_for_ai_rewrite.cjs` | 导出脚本，读取 flow.json + modules.json 生成任务文档 |
| `ai-rewrite-task.md` | 生成的任务文档，包含模块顺序 + 现有内容 + 重写指令 |
| `modules.json` | 模块数据文件，AI 重写后更新此文件 |
