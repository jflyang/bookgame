import type { Scenario } from "@story-game/shared";

export class ScenarioService {
  constructor(private readonly scenarios: Scenario[]) {}

  get(id: string) {
    const scenario = this.scenarios.find((item) => item.id === id);
    if (!scenario) throw new Error(`Scenario not found: ${id}`);
    return structuredClone(scenario);
  }

  list() {
    return this.scenarios;
  }

  replaceAll(next: Scenario[]) {
    this.scenarios.splice(0, this.scenarios.length, ...next);
  }
}
