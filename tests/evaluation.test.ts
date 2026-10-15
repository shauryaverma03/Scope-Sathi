import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluationCases } from "../eval/cases";
import { scoreCase, summarizeEvaluation } from "../eval/scoring";
test("evaluation splits hold out entire projects and reference only valid synthetic requirements", () => {
  assert.equal(evaluationCases.length, 32);
  assert.equal(new Set(evaluationCases.map((c) => c.id)).size, 32);
  const calibration = new Set(
    evaluationCases
      .filter((c) => c.split === "calibration")
      .map((c) => c.project),
  );
  for (const c of evaluationCases) {
    if (c.split === "validation")
      assert.equal(calibration.has(c.project), false);
    for (const e of c.expected)
      if (e.requirementId)
        assert.ok(Number(e.requirementId.slice(4)) <= c.requirements.length);
  }
});
test("provider failures produce no invented accuracy or latency results", () => {
  const summary = summarizeEvaluation([
    {
      id: "blocked",
      project: "events",
      split: "validation",
      variant: "scopesathi",
      durationMs: 100,
      projectUnchanged: true,
      error: "Billing blocked",
    },
  ])[0];
  assert.equal(summary.validatedResponses, 0);
  assert.equal(summary.errors, 1);
  assert.equal(summary.exactMatchRateAcrossAttempts, null);
  assert.equal(summary.p50DurationMs, null);
  assert.equal(summary.precisionOnValidatedResponses, null);
});
test("scoring rejects extra findings, wrong references and missing clarification questions", () => {
  const c = evaluationCases[0];
  const finding = {
    id: "1",
    kind: "addition" as const,
    requirementId: "",
    title: "New",
    currentQuote: "",
    requestQuote: c.request,
    proposedText: "Wish list",
    reason: "New work",
    questions: [],
    taskIds: [],
  };
  assert.equal(
    scoreCase(c, { summary: "Test", findings: [finding] })
      .exactLabelAndReferenceMatch,
    true,
  );
  assert.equal(
    scoreCase(c, {
      summary: "Test",
      findings: [finding, { ...finding, id: "2" }],
    }).exactLabelAndReferenceMatch,
    false,
  );
  assert.equal(
    scoreCase(c, {
      summary: "Test",
      findings: [{ ...finding, requirementId: "REQ-001" }],
    }).exactLabelAndReferenceMatch,
    false,
  );
});
