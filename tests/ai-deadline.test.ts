import { test } from "node:test";
import assert from "node:assert/strict";
import { withAIDeadline } from "../server/ai-deadline";

test("AI deadline releases a stalled request even if transport ignores cancellation", async () => {
  let signal: AbortSignal | undefined;
  await assert.rejects(
    withAIDeadline((s) => {
      signal = s;
      return new Promise(() => {});
    }, 15),
    /Gemini took too long/,
  );
  assert.equal(signal?.aborted, true);
});
test("AI deadline preserves successful results and service errors", async () => {
  assert.equal(
    await withAIDeadline(async () => "six requirements", 100),
    "six requirements",
  );
  await assert.rejects(
    withAIDeadline(async () => {
      throw new Error("quota reached");
    }, 100),
    /quota reached/,
  );
});
