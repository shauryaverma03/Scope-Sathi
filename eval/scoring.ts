import type { Analysis } from "../shared/model";
import type { EvalCase } from "./cases";
export type EvaluationResult = {
  id: string;
  project: string;
  split: string;
  variant: string;
  durationMs: number;
  evidenceValidated?: boolean;
  projectUnchanged: boolean;
  error?: string;
  score?: ReturnType<typeof scoreCase>;
  analysis?: Analysis;
};
export function summarizeEvaluation(results: EvaluationResult[]) {
  return [...new Set(results.map((r) => r.variant))].map((variant) => {
    const attempted = results.filter((r) => r.variant === variant);
    const valid = attempted.filter((r) => r.score && !r.error);
    const durations = valid.map((r) => r.durationMs).sort((a, b) => a - b);
    const tp = valid.reduce((n, r) => n + r.score!.truePositive, 0);
    const fp = valid.reduce((n, r) => n + r.score!.falsePositive, 0);
    const fn = valid.reduce((n, r) => n + r.score!.falseNegative, 0);
    const exact = valid.filter(
      (r) => r.score!.exactLabelAndReferenceMatch,
    ).length;
    return {
      variant,
      attempted: attempted.length,
      validatedResponses: valid.length,
      errors: attempted.filter((r) => r.error).length,
      exactLabelMatches: exact,
      exactMatchRateAcrossAttempts: valid.length
        ? exact / attempted.length
        : null,
      precisionOnValidatedResponses: tp + fp ? tp / (tp + fp) : null,
      recallOnValidatedResponses: tp + fn ? tp / (tp + fn) : null,
      p50DurationMs: durations.length
        ? durations[Math.ceil(durations.length * 0.5) - 1]
        : null,
      p95DurationMs: durations.length
        ? durations[Math.ceil(durations.length * 0.95) - 1]
        : null,
      inputTokensReported: valid.reduce(
        (n, r) => n + (r.analysis?.run?.inputTokens || 0),
        0,
      ),
      outputTokensReported: valid.reduce(
        (n, r) => n + (r.analysis?.run?.outputTokens || 0),
        0,
      ),
      responsesWithReportedUsage: valid.filter(
        (r) =>
          r.analysis?.run?.inputTokens !== undefined &&
          r.analysis?.run?.outputTokens !== undefined,
      ).length,
      unchangedProjects: attempted.filter((r) => r.projectUnchanged).length,
    };
  });
}
export function scoreCase(c: EvalCase, analysis: Analysis) {
  const expected = new Set(
    c.expected.map((e) => e.kind + ":" + e.requirementId),
  );
  const actual = analysis.findings.map((f) => f.kind + ":" + f.requirementId);
  const actualSet = new Set(actual);
  const correct = [...expected].filter((key) => actualSet.has(key)).length;
  const questionPass =
    !c.needsQuestion || analysis.findings.some((f) => f.questions.length > 0);
  return {
    expected: [...expected],
    actual,
    exactLabelAndReferenceMatch:
      questionPass &&
      correct === expected.size &&
      actual.length === expected.size,
    questionPass,
    truePositive: correct,
    falsePositive: actual.length - correct,
    falseNegative: expected.size - correct,
  };
}
