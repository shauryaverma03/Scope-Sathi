import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  approveBaseline,
  addRequest,
  decide,
  saveIntake,
  setRevisionPolicy,
  saveProposal,
} from "../server/domain";
import {
  emptyIntake,
  normalizeProject,
  revisionSummary,
  type Project,
  type ChangeRequest,
  type Finding,
} from "../shared/model";
import { fingerprint } from "../server/migration";
const owner = { uid: "owner", email: "owner@example.com", name: "Owner" };
const editor = { uid: "editor", email: "editor@example.com", name: "Editor" };
function fixture() {
  const p = createProject(owner, "Revision test", "", "");
  approveBaseline(p, owner, "Users can search the product catalogue.", [
    {
      id: "REQ-001",
      text: "Users can search the product catalogue.",
      quote: "Users can search the product catalogue.",
    },
  ]);
  p.tasks = [
    { id: "T1", title: "Search", status: "done", requirementIds: ["REQ-001"] },
  ];
  p.members[editor.email] = "editor";
  return p;
}
function request(
  p: Project,
  id: string,
  round: string,
  kind: Finding["kind"] = "modification",
  category: "new_scope" | "correction" = "new_scope",
) {
  const text = "Please update the product search behaviour.";
  const r: ChangeRequest = {
    id,
    title: id,
    source: "Client",
    text,
    createdAt: new Date().toISOString(),
    createdBy: owner.email,
    baselineVersion: p.versions.length,
    engine: "Manual",
    status: "pending",
    roundId: round,
    category,
    analysis: {
      summary: "Manual proposal",
      findings: [
        {
          id: "F1",
          kind,
          title: "Search update",
          requirementId:
            kind === "modification" || kind === "no_change" ? "REQ-001" : "",
          currentQuote:
            kind === "modification" || kind === "no_change"
              ? p.requirements[0].text
              : "",
          requestQuote: text,
          proposedText:
            kind === "modification"
              ? "Users can search and sort the catalogue."
              : "",
          reason: "Confirmed client request",
          questions:
            kind === "clarification" ? ["Confirm intended requirement"] : [],
          taskIds: [],
        },
      ],
    },
  };
  addRequest(p, owner, r);
  return r;
}
test("structured intake persists separately and is frozen after initial baseline approval", () => {
  const p = createProject(owner, "Intake", "", "");
  p.members[editor.email] = "editor";
  const intake = {
    ...emptyIntake(),
    goal: "Online store",
    features: "Product search",
    excluded: "Native mobile app",
  };
  saveIntake(p, editor, intake);
  assert.equal(p.intake.excluded, "Native mobile app");
  approveBaseline(p, owner, "Product search is required.", [
    {
      id: "REQ-001",
      text: "Product search is required.",
      quote: "Product search is required.",
    },
  ]);
  assert.throws(() => saveIntake(p, owner, emptyIntake()), /preserved/);
});
test("two approved related requests consume one round and retain baseline history", () => {
  const p = fixture();
  setRevisionPolicy(
    p,
    owner,
    1,
    "Related requests reviewed together count as one round.",
  );
  request(p, "r1", "round1");
  decide(p, owner, "r1", "approved", "First change approved");
  request(p, "r2", "round1");
  decide(p, owner, "r2", "approved", "Related request approved");
  assert.equal(revisionSummary(p).used, 1);
  assert.equal(revisionSummary(p).approvedChanges, 2);
  assert.equal(p.versions.length, 3);
  assert.equal(p.tasks[0].status, "needs_review");
  assert.match(p.versions[0].requirements[0].text, /can search the product/);
});
test("exhausted allowance requires a separate agreement and records it", () => {
  const p = fixture();
  setRevisionPolicy(
    p,
    owner,
    0,
    "Every new scope round needs a separate agreement.",
  );
  request(p, "r1", "round1");
  assert.throws(
    () => decide(p, owner, "r1", "approved", "Approved after review"),
    /allowance is exhausted/,
  );
  assert.equal(p.versions.length, 1);
  assert.equal(p.requests[0].status, "pending");
  decide(
    p,
    owner,
    "r1",
    "approved",
    "Client agreement recorded",
    undefined,
    "Client agreed to this additional round on the project call.",
  );
  assert.equal(
    p.requests[0].separateAgreement,
    "Client agreed to this additional round on the project call.",
  );
  assert.equal(revisionSummary(p).beyond, 1);
});
test("corrections, rejection, clarification and no-change decisions do not consume rounds", () => {
  const p = fixture();
  setRevisionPolicy(
    p,
    owner,
    0,
    "Only approved new-scope changes consume the allowance.",
  );
  request(p, "fix", "fixround", "modification", "correction");
  decide(p, owner, "fix", "approved", "Correction to meet original agreement");
  request(p, "reject", "rejectround");
  decide(p, owner, "reject", "rejected", "Not part of the project");
  request(p, "clarify", "clarifyround", "clarification");
  decide(
    p,
    owner,
    "clarify",
    "clarification",
    "Please confirm the requested behaviour",
  );
  request(p, "same", "sameround", "no_change");
  decide(p, owner, "same", "approved", "Existing scope already covers this");
  const s = revisionSummary(p);
  assert.equal(s.used, 0);
  assert.equal(s.submitted, 4);
  assert.equal(s.rejected, 1);
  assert.equal(s.clarification, 1);
  assert.equal(p.versions.length, 2);
});
test("owner alone controls allowance and editors cannot approve or edit proposals", () => {
  const p = fixture();
  assert.throws(
    () => setRevisionPolicy(p, editor, 3, "Three included revision rounds."),
    /owner/,
  );
  const r = request(p, "r1", "round1");
  assert.throws(
    () => decide(p, editor, r.id, "approved", "Editor attempted approval"),
    /role/,
  );
  assert.throws(
    () => saveProposal(p, editor, r.id, r.analysis.findings),
    /role/,
  );
});
test("multiple requirement findings approve together; ambiguous and fabricated matches are blocked", () => {
  const p = fixture();
  p.requirements.push({
    id: "REQ-002",
    text: "The admin updates prices.",
    quote: "The admin updates prices.",
  });
  p.versions[0].requirements = structuredClone(p.requirements);
  const r = request(p, "r1", "round1");
  r.analysis.findings.push({
    ...r.analysis.findings[0],
    id: "F2",
    requirementId: "REQ-002",
    currentQuote: "The admin updates prices.",
    proposedText: "The admin updates prices in bulk.",
  });
  r.analysis.findings[0].questions = ["Confirm match"];
  assert.throws(
    () => decide(p, owner, r.id, "approved", "Approve both"),
    /Resolve/,
  );
  r.analysis.findings[0].questions = [];
  const bad = structuredClone(r.analysis.findings);
  bad[1].currentQuote = "Invented requirement";
  assert.throws(() => saveProposal(p, owner, r.id, bad), /verified/);
  decide(p, owner, r.id, "approved", "Both requirements confirmed");
  assert.equal(p.versions.length, 2);
  assert.match(p.requirements[1].text, /in bulk/);
});
test("legacy projects gain defaults without losing requests, IDs or history; migration hashes detect changes", () => {
  const p = fixture();
  request(p, "r1", "round1");
  decide(p, owner, "r1", "approved", "Approved existing request");
  const old = structuredClone(p) as any;
  delete old.intake;
  delete old.revisionPolicy;
  delete old.rounds;
  delete old.requests[0].category;
  delete old.requests[0].roundId;
  const normalized = normalizeProject(old);
  assert.equal(normalized.requests[0].id, "r1");
  assert.equal(normalized.versions.length, 2);
  assert.equal(revisionSummary(normalized).used, 1);
  assert.equal(
    fingerprint(normalized),
    fingerprint(structuredClone(normalized)),
  );
  const changed = structuredClone(normalized);
  changed.name = "Other";
  assert.notEqual(fingerprint(normalized), fingerprint(changed));
});

test("migration fingerprints ignore Firestore map ordering", () => {
  const p = fixture();
  const reordered = Object.fromEntries(Object.entries(p).reverse()) as Project;
  assert.equal(fingerprint(p), fingerprint(reordered));
});
