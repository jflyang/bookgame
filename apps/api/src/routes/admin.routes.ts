import type { FastifyInstance } from "fastify";
import {
  createStoryPackageRequestSchema,
  updateLlmConfigRequestSchema,
  updateCharacterRequestSchema,
  updateStoryPackageRequestSchema
} from "@story-game/shared";
import { dialogueEngine, llmConfigService } from "../modules/container.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/characters", async (_request, reply) => {
    return reply.send(dialogueEngine.getCharacters());
  });

  app.put("/characters/:id", async (request, reply) => {
    const input = updateCharacterRequestSchema.parse(request.body);
    return reply.send(dialogueEngine.updateCharacter(input.id, input));
  });

  app.get("/story-packages", async (_request, reply) => {
    return reply.send(dialogueEngine.listStoryPackages());
  });

  app.post("/story-packages", async (request, reply) => {
    const input = createStoryPackageRequestSchema.parse(request.body);
    return reply.code(201).send(dialogueEngine.createStoryPackage(input.title, input.sourcePackageId));
  });

  app.put("/story-packages/:id", async (request, reply) => {
    const input = updateStoryPackageRequestSchema.parse(request.body);
    return reply.send(dialogueEngine.updateStoryPackage(input));
  });

  app.delete("/story-packages/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(dialogueEngine.deleteStoryPackage(id));
  });

  app.get("/llm-config", async (_request, reply) => {
    return reply.send({ llmConfig: llmConfigService.getView() });
  });

  app.put("/llm-config", async (request, reply) => {
    const input = updateLlmConfigRequestSchema.parse(request.body);
    return reply.send({ llmConfig: llmConfigService.update(input) });
  });
}
