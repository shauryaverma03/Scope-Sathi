import type { ModelRun } from "../shared/model.js";
import type { ZodType } from "zod";
export const PROMPT_VERSION = "2026-10-16.1";
export function validatedModelOutput<T>(
  schema: ZodType<T>,
  text: string,
  run: ModelRun,
): T & { run: ModelRun } {
  const parsed = schema.parse(JSON.parse(text));
  return Object.assign(parsed as object, { run }) as T & { run: ModelRun };
}
export function modelRun(
  started: number,
  usage:
    { promptTokenCount?: number; candidatesTokenCount?: number } | undefined,
  completed = Date.now(),
): ModelRun {
  const count = (n: number | undefined) =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : undefined;
  return {
    provider: process.env.APP_MODE === "google" ? "vertex" : "developer-api",
    model: process.env.GEMINI_MODEL || "unknown",
    promptVersion: PROMPT_VERSION,
    schemaVersion: "1",
    completedAt: new Date(completed).toISOString(),
    durationMs: Math.max(0, completed - started),
    ...(count(usage?.promptTokenCount) !== undefined
      ? { inputTokens: count(usage?.promptTokenCount) }
      : {}),
    ...(count(usage?.candidatesTokenCount) !== undefined
      ? { outputTokens: count(usage?.candidatesTokenCount) }
      : {}),
  };
}
