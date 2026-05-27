import type { GameState, StoryPackage } from "@story-game/shared";
import { SessionRepository, type CharacterStateSnapshot, type SessionSummary } from "./sessionRepository.js";

export class SessionCollector {
  constructor(private readonly repo: SessionRepository) {}

  create(sessionId: string, storyPackage: StoryPackage, gameState: GameState): void {
    this.repo.upsert({
      id: sessionId,
      storyPackageId: storyPackage.id,
      storyPackageTitle: storyPackage.title,
      round: gameState.round,
      status: "idle",
      currentStage: gameState.scenario.currentStage,
      characterStates: snapshotCharacters(gameState),
      messageCount: 0,
    });
  }

  markActive(sessionId: string, gameState: GameState, messageCount: number): void {
    const existing = this.repo.getById(sessionId);
    if (!existing) return;
    this.repo.upsert({
      id: sessionId,
      storyPackageId: existing.storyPackageId,
      storyPackageTitle: existing.storyPackageTitle,
      round: gameState.round,
      status: gameState.status === "completed" ? "completed" : "active",
      currentStage: gameState.scenario.currentStage,
      characterStates: snapshotCharacters(gameState),
      messageCount,
    });
  }

  restore(sessionId: string, storyPackageId: string, storyPackageTitle: string, gameState: GameState, messageCount: number): void {
    this.repo.upsert({
      id: sessionId,
      storyPackageId,
      storyPackageTitle,
      round: gameState.round,
      status: gameState.status === "completed" ? "completed" : "active",
      currentStage: gameState.scenario.currentStage,
      characterStates: snapshotCharacters(gameState),
      messageCount,
    });
  }

  listAll(): SessionSummary[] {
    return this.repo.listAll();
  }

  getById(id: string): SessionSummary | null {
    return this.repo.getById(id);
  }

  deleteAll(): void {
    this.repo.deleteAll();
  }
}

function snapshotCharacters(gameState: GameState): CharacterStateSnapshot[] {
  return (gameState.characters ?? []).map((cs) => ({
    name: cs.characterId,
    hp: cs.hp,
    maxHp: gameState.scenario?.initialStates?.find(s => s.characterId === cs.characterId)?.hp ?? cs.hp,
    mp: cs.mp,
    maxMp: gameState.scenario?.initialStates?.find(s => s.characterId === cs.characterId)?.mp ?? cs.mp,
  }));
}
