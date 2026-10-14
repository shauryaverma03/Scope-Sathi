import { test } from "node:test";
import assert from "node:assert/strict";
import {
  proposeRoundQuote,
  respondRoundQuote,
  recordInvoice,
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
  roundScope,
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

const client = { uid: "client", email: "client@example.com", name: "Client" };
function priced() {
  const p = fixture();
  p.members[client.email] = "viewer";
  setRevisionPolicy(
    p,
    owner,
    0,
    "One related group counts as a revision round.",
    { currency: "INR", rateMinor: 50000, clientEmail: client.email },
  );
  return p;
}
test("priced approval requires client consent; accepted price survives policy edits; invoice requires approval", () => {
  const p = priced();
  request(p, "paid", "paid-round");
  assert.throws(
    () =>
      decide(
        p,
        owner,
        "paid",
        "approved",
        "Approve paid scope",
        undefined,
        "Verbal agreement recorded",
      ),
    /client must accept/,
  );
  proposeRoundQuote(p, owner, "paid-round");
  const q = p.quotes![0];
  assert.equal(q.amountMinor, 50000);
  assert.throws(
    () => respondRoundQuote(p, owner, q.id, true),
    /designated client/,
  );
  assert.throws(
    () => respondRoundQuote(p, editor, q.id, true),
    /designated client/,
  );
  respondRoundQuote(p, client, q.id, true);
  assert.throws(() => recordInvoice(p, owner, q.id, "INV-1"), /Requires/);
  setRevisionPolicy(
    p,
    owner,
    0,
    "One related group counts as a revision round.",
    { currency: "USD", rateMinor: 90000, clientEmail: client.email },
  );
  assert.equal(q.currency, "INR");
  assert.equal(q.amountMinor, 50000);
  decide(p, owner, "paid", "approved", "Scope and estimate accepted");
  recordInvoice(p, owner, q.id, "INV-001");
  assert.equal(q.invoiceReference, "INV-001");
  assert.throws(() => recordInvoice(p, owner, q.id, "INV-002"), /Requires/);
  assert.equal(revisionSummary(p).used, 1);
});
test("changed scope invalidates consent; related additions keep accepted rate and count once", () => {
  const p = priced();
  request(p, "first", "group");
  proposeRoundQuote(p, owner, "group");
  respondRoundQuote(p, client, p.quotes![0].id, true);
  request(p, "second", "group");
  assert.throws(
    () => decide(p, owner, "first", "approved", "Approve changed group"),
    /client must accept/,
  );
  setRevisionPolicy(
    p,
    owner,
    0,
    "One related group counts as a revision round.",
    { rateMinor: 80000 },
  );
  proposeRoundQuote(p, owner, "group");
  const q = p.quotes![1];
  assert.equal(q.amountMinor, 50000);
  respondRoundQuote(p, client, q.id, true);
  decide(p, owner, "first", "approved", "First related change");
  const second = p.requests.find((r) => r.id === "second")!;
  second.baselineVersion = p.versions.length;
  second.analysis.findings[0].currentQuote = p.requirements[0].text;
  assert.throws(
    () =>
      decide(
        p,
        owner,
        "second",
        "approved",
        "Changed comparison needs consent",
      ),
    /client must accept/,
  );
  proposeRoundQuote(p, owner, "group");
  respondRoundQuote(p, client, p.quotes![2].id, true);
  decide(p, owner, "second", "approved", "Second related change");
  assert.equal(revisionSummary(p).used, 1);
  assert.equal(p.quotes!.filter((q) => q.state === "accepted").length, 1);
});
test("decline blocks approval; free rounds and corrections cannot be quoted", () => {
  const p = priced();
  request(p, "paid", "paid-round");
  proposeRoundQuote(p, owner, "paid-round");
  respondRoundQuote(p, client, p.quotes![0].id, false);
  assert.throws(
    () => decide(p, owner, "paid", "approved", "Declined scope"),
    /client must accept/,
  );
  request(p, "fix", "fix-round", "modification", "correction");
  assert.throws(() => proposeRoundQuote(p, owner, "fix-round"), /No pending/);
  decide(p, owner, "fix", "approved", "Original agreement correction");
  const free = priced();
  setRevisionPolicy(
    free,
    owner,
    5,
    "Five included rounds before additional charges.",
  );
  request(free, "free", "free-round");
  assert.throws(() => proposeRoundQuote(free, owner, "free-round"), /included/);
  decide(free, owner, "free", "approved", "Included round");
  assert.equal(revisionSummary(free).remaining, 4);
});
test("only reviewers quote, client must be a member, stale consent and duplicate replies rejected", () => {
  const p = priced();
  request(p, "paid", "group");
  assert.throws(() => proposeRoundQuote(p, editor, "group"), /role/);
  assert.throws(
    () =>
      setRevisionPolicy(p, owner, 5, "Five rounds are included.", {
        clientEmail: "stranger@example.com",
      }),
    /project access/,
  );
  proposeRoundQuote(p, owner, "group");
  p.requests[0].analysis.findings[0].proposedText = "Updated scope wording";
  assert.throws(
    () => respondRoundQuote(p, client, p.quotes![0].id, true),
    /outdated/,
  );
  proposeRoundQuote(p, owner, "group");
  const q = p.quotes![1];
  respondRoundQuote(p, client, q.id, true);
  assert.throws(
    () => respondRoundQuote(p, client, q.id, true),
    /no longer pending/,
  );
});

test("quote scope survives Firestore map ordering and request/finding ordering", () => {
  const p = priced();
  request(p, "paid", "group");
  proposeRoundQuote(p, owner, "group");
  const quote = p.quotes![0];
  const r = p.requests[0];
  r.analysis.findings = r.analysis.findings.map(
    (f) => Object.fromEntries(Object.entries(f).reverse()) as Finding,
  );
  assert.equal(roundScope(p, "group"), quote.scope);
  respondRoundQuote(p, client, quote.id, true);
  decide(p, owner, "paid", "approved", "Stable persisted quote");
});
test("declined quotes can be reissued, invoiced rounds cannot expand, revoked clients cannot accept", () => {
  const p = priced();
  request(p, "paid", "group");
  proposeRoundQuote(p, owner, "group");
  respondRoundQuote(p, client, p.quotes![0].id, false);
  proposeRoundQuote(p, owner, "group");
  const q = p.quotes![1];
  delete p.members[client.email];
  assert.throws(() => respondRoundQuote(p, client, q.id, true), /not found/);
  p.members[client.email] = "viewer";
  respondRoundQuote(p, client, q.id, true);
  decide(p, owner, "paid", "approved", "Approved priced scope");
  recordInvoice(p, owner, q.id, "INV-002");
  request(p, "extra", "group");
  assert.throws(() => proposeRoundQuote(p, owner, "group"), /invoiced round/);
  assert.throws(
    () => decide(p, owner, "extra", "approved", "Unquoted expansion"),
    /client must accept/,
  );
  assert.equal(q.amountMinor, 50000);
});
