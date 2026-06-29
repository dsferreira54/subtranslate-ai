import { describe, expect, it } from "vitest";
import { listModels } from "../llmProviders/listModels.js";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

describe("listModels", () => {
  it.skipIf(!DEEPSEEK_API_KEY)("lists DeepSeek models with a valid API key", async () => {
    const models = await listModels("deepseek", DEEPSEEK_API_KEY!);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toBeTruthy();
  });
});
