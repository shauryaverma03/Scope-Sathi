import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluationCases } from "../eval/cases";
import {
  scoreCase,
  summarizeEvaluation,
  type EvaluationResult,
} from "../eval/scoring";
import { analyse, generate } from "../server/ai";
import {
  AppError,
  decide,
  validateAnalysis,
  createProject,
  approveBaseline,
} from "../server/domain";
import { proposeAmendment } from "../server/workspace";
import { AnalysisSchema, type Analysis } from "../shared/model";
const args = process.argv.slice(2);
const value = (flag: string, fallback: string) =>
  args.includes(flag) ? args[args.indexOf(flag) + 1] || fallback : fallback;
const split = value("--split", "validation"),
  provider = value("--provider", "developer-api");
const limit = Number(value("--limit", "16"));
if (
  !["calibration", "validation", "all"].includes(split) ||
  !["developer-api", "vertex"].includes(provider) ||
  !Number.isInteger(limit) ||
  limit < 1 ||
  limit > 32
)
  throw new Error(
    "Use --split validation|calibration|all, --provider developer-api|vertex, --limit 1..32",
  );
const cases = evaluationCases
  .filter((c) => split === "all" || c.split === split)
  .slice(0, limit);
const baseline = args.includes("--baseline");
if (!args.includes("--live")) {
  console.log(
    JSON.stringify(
      {
        live: false,
        provider,
        split,
        cases: cases.map((c) => c.id),
        maximumGenerationCalls: cases.length * (baseline ? 2 : 1),
        maximumTransportAttempts: cases.length * (baseline ? 2 : 1) * 2,
        message:
          "Add --live to send this synthetic dataset to the model. No project or email will be created.",
      },
      null,
      2,
    ),
  );
} else {
  process.env.APP_MODE = provider === "vertex" ? "google" : "firebase";
  if (
    !process.env.GEMINI_MODEL ||
    (provider === "developer-api" && !process.env.GEMINI_API_KEY) ||
    (provider === "vertex" && !process.env.GOOGLE_CLOUD_PROJECT)
  )
    throw new Error(
      "Configure model and provider credentials privately first.",
    );
  const startedAt = new Date().toISOString();
  const results: EvaluationResult[] = [];
  let failures = 0;
  let stoppedReason: string | undefined;
  casesLoop: for (const c of cases) {
    const actor = {
      uid: "eval",
      email: "eval@scopesathi.invalid",
      name: "Synthetic evaluator",
    };
    const p = createProject(actor, "Synthetic " + c.project, "", "");
    const brief = c.requirements.join("\n");
    approveBaseline(
      p,
      actor,
      brief,
      c.requirements.map((text, i) => ({
        id: `REQ-${String(i + 1).padStart(3, "0")}`,
        text,
        quote: text,
      })),
    );
    if (c.originalBrief) {
      // Reconstruct a reviewed amendment so original context differs legitimately.
      p.brief = c.originalBrief;
      p.requirements[0].text = "Appointments last 30 minutes.";
      p.requirements[0].quote = p.requirements[0].text;
      p.versions[0].requirements = structuredClone(p.requirements);
      proposeAmendment(p, actor, {
        requirementId: "REQ-001",
        kind: "modification",
        proposedText: c.requirements[0],
        message: "Change appointments to 45 minutes.",
        category: "new_scope",
      });
      decide(
        p,
        actor,
        p.requests[0].id,
        "approved",
        "Confirmed 45-minute appointment length",
      );
    }
    for (const variant of baseline
      ? ["scopesathi", "simple-prompt"]
      : ["scopesathi"]) {
      const before = JSON.stringify(p),
        started = Date.now();
      try {
        const analysis: Analysis =
          variant === "scopesathi"
            ? await analyse(p, c.request, true, false)
            : await generate(
                AnalysisSchema,
                JSON.stringify({
                  task: "Compare this client request with the current requirements. Classify additions, modifications, removals, no change and ambiguity. Return the requested JSON with exact evidence and questions where necessary.",
                  requirements: p.requirements,
                  request: c.request,
                }),
              );
        validateAnalysis(p, c.request, analysis);
        if (JSON.stringify(p) !== before)
          throw new Error("Mutation during analysis");
        const score = scoreCase(c, analysis);
        if (!score.exactLabelAndReferenceMatch) failures++;
        results.push({
          id: c.id,
          project: c.project,
          split: c.split,
          variant,
          durationMs: Date.now() - started,
          evidenceValidated: true,
          projectUnchanged: true,
          score,
          analysis,
        });
        console.log(
          `${c.id} / ${variant}: ${score.exactLabelAndReferenceMatch ? "LABEL MATCH" : "REVIEW MISMATCH"}`,
        );
      } catch (error) {
        failures++;
        results.push({
          id: c.id,
          project: c.project,
          split: c.split,
          variant,
          durationMs: Date.now() - started,
          error:
            error instanceof AppError
              ? error.message
              : "Model, schema or evidence validation failed. No raw service error or credential logged.",
          projectUnchanged: JSON.stringify(p) === before,
        });
        console.log(`${c.id} / ${variant}: FAILED`);
        if (
          error instanceof AppError &&
          /billing|payment|access was denied|quota|endpoint is unavailable/i.test(
            error.message,
          )
        ) {
          stoppedReason =
            "Provider setup, quota or billing failure. Remaining cases were not attempted.";
          break casesLoop;
        }
      }
    }
  }
  const report = {
    startedAt,
    completedAt: new Date().toISOString(),
    provider,
    model: process.env.GEMINI_MODEL,
    split,
    plannedCases: cases.length,
    calls: results.length,
    stoppedReason,
    failuresOrMismatches: failures,
    summary: summarizeEvaluation(results),
    limitation:
      "Automatic label/reference agreement against synthetic labels; not human semantic accuracy, real-user impact, or proof of the Cloud Run runtime identity. Baseline shares the schema and safety instruction. No projects persisted and no email sent.",
    results,
  };
  const output = resolve(value("--out", ".data/ai-evaluation.json"));
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      output,
      cases: cases.length,
      calls: results.length,
      failuresOrMismatches: failures,
    }),
  );
  if (failures) process.exitCode = 1;
}
