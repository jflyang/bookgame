# AI Guide for This Codebase

This file is written for coding agents. Read it before opening many files. It is a compact map for locating the right module quickly and spending fewer tokens.

## What This App Is

An LLM-powered interactive story game with a React/Vite frontend, Fastify API backend, and shared Zod schemas.

- Frontend: `apps/web`
- Backend: `apps/api`
- Shared contracts: `packages/shared`
- Story packages and media: `apps/data/task-packages`

Default local ports:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

Run commands:

```bash
npm run dev
npm run dev:api
npm run dev:web
npm run typecheck
```

## Fast Module Map

| Task | Start Here | Then Check |
| --- | --- | --- |
| Understand app routing | `apps/web/src/App.tsx` | `apps/web/src/features/play/PlayApp.tsx`, `apps/web/src/features/admin/AdminApp.tsx` |
| Play screen UI | `apps/web/src/features/play/PlayApp.tsx` | `components/MessageList.tsx`, `components/CharacterRail.tsx`, `components/Composer.tsx` |
| Admin/story editing UI | `apps/web/src/features/admin/AdminApp.tsx` | `components/StoryEditor.tsx`, `StoryLibrary.tsx`, `StorySettingPanel.tsx`, `CharacterConfigPanel.tsx` |
| Frontend state/actions | `apps/web/src/store/gameStore.ts` | `apps/web/src/lib/gameApi.ts`, `apps/web/src/lib/adminApi.ts` |
| API routes | `apps/api/src/routes/index.ts` | `game.routes.ts`, `admin.routes.ts`, `storyAssets.routes.ts` |
| Backend dependency wiring | `apps/api/src/modules/container.ts` | application services and domain services below |
| Session gameplay flow | `apps/api/src/application/gameApplicationService.ts` | `services/dialogueEngine.ts`, `services/turnProcessor.ts` |
| Prompt construction | `apps/api/src/services/promptService.ts` | `agentService.ts`, `ruleChecker.ts` |
| Speaker selection | `apps/api/src/services/speakerSelector.ts` | `turnProcessor.ts` |
| State updates and damage | `apps/api/src/services/gameStateService.ts` | `skillService.ts`, `scenarioService.ts` |
| LLM providers | `apps/api/src/resources/llm/configurableLlmProvider.ts` | `mockLlmProvider.ts`, `deepSeekLlmProvider.ts`, `llmConfigService.ts` |
| TTS providers | `apps/api/src/resources/tts/configurableTtsProvider.ts` | `cosyVoiceTtsProvider.ts`, `mockTtsProvider.ts`, `ttsConfigService.ts`, `voiceRegistry.ts` |
| TTS Python service | `services/tts/main.py` | `start.py`, `download_model.py`, `Dockerfile` |
| Story package persistence | `apps/api/src/services/storyPackageService.ts` | `data/taskPackageRepository.ts`, `data/pluginPackageIndex.ts` |
| Story package assets | `apps/api/src/routes/storyAssets.routes.ts` | `apps/web/src/features/play/contexts/StoryAssetsContext.tsx` |
| Performance/animation events | `apps/web/src/features/play/performances/StoryPerformanceRuntime.tsx` | `StoryPerformanceOverlay.tsx`, story package `manifest.json` |
| Shared types and schemas | `packages/shared/src/index.ts` | tests in `packages/shared/src` |
| Runtime/audit dashboards | `apps/api/src/modules/runtime-stats` | `apps/web/src/features/admin/components/RuntimeDashboard.tsx`, `AuditLogPage.tsx` |
| Saves/session inspection | `apps/api/src/modules/sessions` | `apps/web/src/features/admin/components/SessionList.tsx` |

## Main Runtime Flow

The normal "continue story" path is:

1. User clicks continue or sends text in `apps/web/src/features/play/PlayApp.tsx`.
2. `apps/web/src/store/gameStore.ts` calls `sendStream`.
3. `apps/web/src/lib/gameApi.ts` posts to `/api/game/sessions/:sessionId/messages/stream`.
4. `apps/api/src/routes/game.routes.ts` delegates to `GameApplicationService`.
5. `GameApplicationService` delegates to `DialogueEngine`.
6. `DialogueEngine` uses `TurnProcessor`.
7. `TurnProcessor` selects speaker, builds prompt, calls LLM, validates output, applies state, appends memory.
8. Frontend receives stream events and appends the final assistant `Message`.
9. `MessageList` renders the message.
10. `StoryPerformanceRuntime` may trigger a configured performance from the story package manifest.

Useful files for this path:

```txt
apps/web/src/store/gameStore.ts
apps/web/src/lib/gameApi.ts
apps/api/src/routes/game.routes.ts
apps/api/src/application/gameApplicationService.ts
apps/api/src/services/dialogueEngine.ts
apps/api/src/services/turnProcessor.ts
apps/api/src/services/promptService.ts
apps/api/src/services/gameStateService.ts
```

## Story Packages

Story packages live under:

```txt
apps/data/task-packages/<package-id>/
```

Important package files:

```txt
manifest.json        Package metadata and plugin capabilities
story.json           Aggregate story package content for v2 packages
task-package.json    Legacy/compat aggregate package
scenario.json        Scenario stages, rules, initial state
characters.json      Character definitions
skills.json          Skill definitions
knowledge/           Knowledge documents
prompts/             Story setting and prompt rules
ui/config.json       Theme/layout/labels/avatar config
media/               Thumbnail and basic media
assets/              Plugin assets, including performances
saves/               Saved sessions; usually avoid editing manually
```

The default package is:

```txt
apps/data/task-packages/xuzhu_vs_dingchunqiu
```

## Performance Packs

Interactive performances are configured in a story package `manifest.json` under `performances`.

Runtime code:

```txt
apps/web/src/features/play/performances/StoryPerformanceRuntime.tsx
apps/web/src/features/play/performances/StoryPerformanceOverlay.tsx
apps/web/src/styles.css
```

Asset serving path:

```txt
apps/api/src/routes/storyAssets.routes.ts
apps/api/src/data/pluginPackageIndex.ts
apps/api/src/services/storyPackageService.ts
apps/web/src/features/play/contexts/StoryAssetsContext.tsx
```

Supported renderers:

| Renderer | Use For |
| --- | --- |
| `video` | MP4/WebM finished animation clips |
| `layeredCss` | PNG/JPG layers animated with CSS |
| `audio` | Sound-only events |
| `image` | Static poster/illustration events |
| `none` | Disabled or bookkeeping-only event |

Supported triggers:

| Trigger | Meaning |
| --- | --- |
| `firstAppearance` | First assistant message from a character |
| `skillUse` | Message has a matching `usedSkills` id |
| `stageEnter` | Scenario stage changes to a configured stage id |
| `messageEvent` | Lightweight future hook; currently matched through `usedSkills` |

Example currently configured in `xuzhu_vs_dingchunqiu`:

- `qiaofeng_heroic_entrance`: `firstAppearance` for `qiaofeng`, rendered as `video`.
- `qiao_feng_kang_long_you_hui`: `skillUse` for `xianglong_kanglongyouhui`, rendered as `layeredCss`.

## API Route Prefixes

Defined in `apps/api/src/routes/index.ts`:

```txt
/api/game          Gameplay/session routes
/api/admin         Admin package/config/session/audit routes
/api/tts           TTS speech synthesis routes
/api/story-assets  Story package asset files
```

Frontend API wrappers:

```txt
apps/web/src/lib/gameApi.ts
apps/web/src/lib/adminApi.ts
apps/web/src/lib/sessionApi.ts
apps/web/src/lib/runtimeStatsApi.ts
apps/web/src/lib/ttsApi.ts
```

## Shared Contracts

Start with:

```txt
packages/shared/src/index.ts
```

This file contains Zod schemas and inferred TypeScript types for:

- Characters, skills, knowledge documents
- Scenario/stages
- UI config
- Story package and plugin manifest
- Game state, state deltas, messages
- LLM output/action schema
- Admin/game request payloads
- Runtime stats

When changing request/response shapes, update shared schema first, then API code, then frontend callers.

## Common Change Recipes

### Add a New Skill

1. Update `skills.json` in the target story package.
2. Ensure the owning character has the skill id in `characters.json`.
3. If code-level defaults matter, check `apps/api/src/data/skills.ts`.
4. Tests usually live near `skillService`, `turnProcessor`, and shared schemas.

### Add a New Story Performance

1. Put assets under `apps/data/task-packages/<id>/assets/performances/<event-id>/`.
2. Add the performance to package `manifest.json`.
3. Use an existing renderer where possible.
4. If adding a new renderer, modify `StoryPerformanceOverlay.tsx` and CSS.
5. If adding a new trigger, modify `StoryPerformanceRuntime.tsx` and shared schema.
6. Verify the asset route works through `/api/story-assets/<package-id>/<relative-path>`.

### Change LLM Behavior

1. Prompt composition: `apps/api/src/services/promptService.ts`.
2. Output validation: `apps/api/src/services/ruleChecker.ts`.
3. Turn orchestration: `apps/api/src/services/turnProcessor.ts`.
4. Provider transport: `apps/api/src/resources/llm`.
5. Config UI: `apps/web/src/features/admin/components/LlmConfigPanel.tsx`.

### Change Frontend Play UI

1. Page shell: `PlayApp.tsx`.
2. Message rendering: `components/MessageList.tsx`.
3. Character panel: `components/CharacterRail.tsx`.
4. Input: `components/Composer.tsx`.
5. State transitions: `store/gameStore.ts`.
6. Styles: `apps/web/src/styles.css`.

### Change Admin UI

1. Route selection: `AdminApp.tsx`.
2. Story package library: `StoryLibrary.tsx`.
3. Story workflow editor: `StoryEditor.tsx`.
4. Scenario: `StorySettingPanel.tsx`.
5. Characters/skills/knowledge: `CharacterConfigPanel.tsx`.
6. Prompt rules: `PromptRulesPanel.tsx`.
7. UI theme/layout: `UiConfigPanel.tsx`.

## Tests and Checks

Useful targeted commands:

```bash
npm run typecheck -w @story-game/web
npm test -w @story-game/web
npm test -w @story-game/shared -- --run
npm test -w @story-game/api -- src/data/__tests__/pluginPackageIndex.test.ts
npm test -w @story-game/api -- src/services/__tests__/storyPackageService.test.ts
```

Full command:

```bash
npm run typecheck
```

Note: if full typecheck fails, inspect whether failures are from pre-existing test fixtures before changing unrelated files.

## Files to Avoid Reading First

These are often large, generated, runtime, or low-signal for most tasks:

```txt
node_modules/
apps/api/data/*.db*
*.log
apps/data/task-packages/*/saves/
apps/data/task-packages/*/assets/
qiaofeng_*_pack/
package-lock.json
```

Read assets only when working on media, rendering, imports, or story package export/import.

## Search Shortcuts

Use these before broad exploration:

```bash
rg -n "createSession|sendMessageStream|continueStory" apps packages
rg -n "StoryPerformance|performances|story-assets" apps packages
rg -n "storyPackage|pluginManifest|manifest" apps packages
rg -n "buildPrompt|validateOutput|applyAssistantTurn" apps/api/src
rg -n "currentStage|stageSuggestion|usedSkills" apps packages
```

## GitNexus Notes

This repo is indexed as `bookgame`. Follow `AGENTS.md`:

- Use GitNexus impact analysis before editing functions/classes/methods.
- Use GitNexus query/context for unfamiliar code paths when the index is healthy.
- Run `npx gitnexus analyze` if the index is stale.
- Run GitNexus detect changes before committing.

For documentation-only edits, no runtime symbol should be affected, but still be careful in a dirty worktree.
