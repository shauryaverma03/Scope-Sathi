import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createProject,
  approveBaseline,
  decide,
  saveProposal,
} from "../server/domain";
import { proposeAmendment, draftTasks } from "../server/workspace";
import { nextAction, reviewContext, wordDiff } from "../shared/review";
import { roundScope } from "../shared/model";
import {
  ChangeReport,
  FindingImpact,
  Traceability,
} from "../src/ReviewInsights";
import { ExampleWalkthrough } from "../src/ExampleWalkthrough";
import { modelRun, validatedModelOutput } from "../server/ai-observability";
import { AnalysisSchema } from "../shared/model";
import { aiFailure } from "../server/ai-errors";
const owner = { uid: "owner", email: "owner@example.com", name: "Owner" };
function fixture() {
  const p = createProject(owner, "Client <script>alert(1)</script>", "", "");
  approveBaseline(p, owner, "Customers must sign in before checkout.", [
    {
      id: "REQ-1",
      text: "Customers must sign in before checkout.",
      quote: "Customers must sign in before checkout.",
    },
  ]);
  draftTasks(p, owner, [{ requirementId: "REQ-1", title: "Checkout flow" }]);
  proposeAmendment(p, owner, {
    requirementId: "REQ-1",
    kind: "modification",
    proposedText: "Customers may sign in or use guest checkout.",
    message: "Please allow guest checkout alongside sign-in.",
    category: "new_scope",
  });
  p.requests[0].analysis.findings[0].taskIds = [];
  return p;
}
test("reports use the original version after approval and include deterministic task impact", () => {
  const p = fixture(),
    r = p.requests[0],
    f = r.analysis.findings[0];
  decide(p, owner, r.id, "approved", "Confidential internal discussion");
  assert.equal(r.resultVersion, 2);
  const c = reviewContext(p, r, f);
  assert.equal(c.requirement?.text, "Customers must sign in before checkout.");
  assert.equal(c.tasks[0].title, "Checkout flow");
  assert.equal(c.baselineEvidence, true);
  const html = renderToStaticMarkup(<ChangeReport p={p} r={r} />);
  assert.match(html, /APPROVED/);
  assert.match(html, /Checkout flow/);
  assert.doesNotMatch(html, /Confidential internal discussion|<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(
    renderToStaticMarkup(<ChangeReport p={p} r={r} includeNote />),
    /Confidential internal discussion/,
  );
  assert.match(
    renderToStaticMarkup(<Traceability p={p} open={() => {}} />),
    /REQ-1|approved/,
  );
});
test("diff reconstruction preserves both texts, including whitespace and bounded long passages", () => {
  for (const [before, after] of [
    ["Customers must sign in.", "Customers may sign in or use guests."],
    ["a\nb", "a b"],
    ["", "new"],
    ["old", ""],
    ["same", "same"],
    ["long ".repeat(500), "changed ".repeat(500)],
  ]) {
    const parts = wordDiff(before, after);
    assert.equal(
      parts
        .filter((p) => p.kind !== "added")
        .map((p) => p.text)
        .join(""),
      before,
    );
    assert.equal(
      parts
        .filter((p) => p.kind !== "removed")
        .map((p) => p.text)
        .join(""),
      after,
    );
  }
});
test("missing historical evidence is surfaced rather than replaced by current scope", () => {
  const p = fixture(),
    r = p.requests[0],
    f = r.analysis.findings[0];
  r.baselineVersion = 99;
  f.taskIds = ["deleted-task"];
  const c = reviewContext(p, r, f);
  assert.equal(c.baselineEvidence, false);
  assert.deepEqual(c.missingTaskIds, ["deleted-task"]);
  assert.match(
    renderToStaticMarkup(<FindingImpact p={p} r={r} f={f} />),
    /Historical baseline unavailable|reference needs review/,
  );
});
test("next action prioritizes stale analysis and questions over ordinary pending decisions", () => {
  const p = fixture(),
    r = p.requests[0];
  assert.equal(nextAction(p).requestId, r.id);
  r.analysis.findings[0].questions = ["How do tracking links expire?"];
  assert.match(nextAction(p).title, /question/);
  r.baselineVersion = 0;
  assert.match(nextAction(p).title, /stale/);
});
test("model metadata excludes invalid token counts, survives proposal edits, and cannot assert accuracy", () => {
  const run = modelRun(
    1000,
    { promptTokenCount: 25, candidatesTokenCount: -1 },
    1400,
  );
  assert.equal(run.durationMs, 400);
  assert.equal(run.inputTokens, 25);
  assert.equal(run.outputTokens, undefined);
  assert.equal("confidence" in run, false);
  const p = fixture(),
    r = p.requests[0];
  r.analysis.run = run;
  const output = validatedModelOutput(
    AnalysisSchema,
    JSON.stringify({
      ...r.analysis,
      run: { model: "forged", confidence: 100 },
    }),
    run,
  );
  assert.equal(output.run.model, run.model);
  assert.equal("confidence" in output.run, false);
  assert.throws(() =>
    validatedModelOutput(AnalysisSchema, JSON.stringify({ findings: [] }), run),
  );
  saveProposal(p, owner, r.id, r.analysis.findings);
  assert.deepEqual(r.analysis.run, run);
});
test("worked example is explicitly illustrative and never presents a live model result", () => {
  const html = renderToStaticMarkup(<ExampleWalkthrough close={() => {}} />);
  assert.match(html, /NO AI CALLS|NO DATA SAVED/);
  assert.match(html, /Establish the agreement/);
});
test("client report labels stale round consent and excludes private operational details", () => {
  const p = fixture(),
    r = p.requests[0];
  p.quotes = [
    {
      id: "Q1",
      roundId: r.roundId!,
      currency: "INR",
      amountMinor: 50000,
      clientEmail: "private-client@example.com",
      scope: roundScope(p, r.roundId!),
      requestIds: [r.id],
      state: "accepted",
      createdAt: "2026-10-16T00:00:00Z",
      createdBy: owner.email,
      invoiceReference: "PRIVATE-INVOICE",
    },
  ];
  let html = renderToStaticMarkup(<ChangeReport p={p} r={r} />);
  assert.match(html, /matches current round scope/);
  assert.doesNotMatch(html, /PRIVATE-INVOICE|private-client@example.com/);
  r.analysis.findings[0].proposedText += " Include confirmation.";
  html = renderToStaticMarkup(<ChangeReport p={p} r={r} />);
  assert.match(html, /not current consent/);
  r.status = "pending";
  assert.match(html, /PENDING|not approved commitments/);
});
test("billing, permission, quota and timeout failures have distinct safe recovery messages", () => {
  for (const status of [402, 403, 429, 504]) {
    const error = aiFailure(status);
    assert.match(error.message, /No decision has been applied/);
    assert.doesNotMatch(error.message, /AIza|private_key|Authorization/);
  }
  assert.match(aiFailure(402).message, /billing or payment/);
  assert.match(aiFailure(403).message, /access was denied/);
  assert.match(aiFailure(429).message, /quota/);
  assert.match(aiFailure(504).message, /timed out/);
});
