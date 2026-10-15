import "dotenv/config";
import assert from "node:assert/strict";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createStore } from "../server/store";
import {
  createProject,
  approveBaseline,
  addRequest,
  decide,
  setRevisionPolicy,
  proposeRoundQuote,
  respondRoundQuote,
  recordInvoice,
} from "../server/domain";
import { proposeAmendment } from "../server/workspace";
import { analyse, extract } from "../server/ai";
import { SAMPLE_BRIEF, SAMPLE_REQUEST } from "../shared/model";
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS)
  throw new Error(
    "Configure the Admin credential first. Live Firestore verification has not run.",
  );
initializeApp({ credential: applicationDefault(), projectId: "scopesathi" });
const store = createStore(true);
const owner = {
  uid: `validation-${randomUUID()}`,
  email: "verification@scopesathi.invalid",
  name: "ScopeSathi validation",
};
const outsider = {
  uid: "validation-outsider",
  email: "outsider@scopesathi.invalid",
  name: "Outsider",
};
if (process.argv[2] === "--read") {
  const p = await store.get(process.argv[3], {
    ...owner,
    uid: process.argv[4],
  });
  assert.equal(p.versions.length, 3);
  assert.equal(p.tasks[0].status, "needs_review");
  assert.equal(p.requests[0].status, "approved");
  assert.equal(p.requests.find((r) => r.baselineVersion === 1)?.resultVersion, 2);
  assert.equal(p.requests.find((r) => r.baselineVersion === 2)?.resultVersion, 3);
  assert.equal(p.quotes?.[0].state, "accepted");
  assert.equal(p.quotes?.[0].amountMinor, 50000);
  assert.equal(p.quotes?.[0].invoiceReference, "VALIDATION-001");
  console.log("Fresh-process Firestore read passed.");
} else {
  const project = createProject(
    owner,
    "ScopeSathi temporary verification",
    "",
    "Disposable record for persistence verification",
  );
  let created = false;
  try {
    await store.create(project);
    created = true;
    let p = await store.update(project.id, owner, 0, (p) => {
      approveBaseline(p, owner, SAMPLE_BRIEF, [
        {
          id: "REQ-001",
          text: SAMPLE_BRIEF.split("\n")[0],
          quote: SAMPLE_BRIEF.split("\n")[0],
        },
      ]);
      p.tasks.push({
        id: "T1",
        title: "Checkout",
        status: "todo",
        requirementIds: ["REQ-001"],
      });
      p.members["client@scopesathi.invalid"] = "viewer";
      p.memberEmails.push("client@scopesathi.invalid");
      setRevisionPolicy(
        p,
        owner,
        0,
        "Zero included rounds in the pricing validation fixture.",
        {
          currency: "INR",
          rateMinor: 50000,
          clientEmail: "client@scopesathi.invalid",
        },
      );
    });
    const analysis = await analyse(p, SAMPLE_REQUEST, false, true);
    analysis.findings[0].questions = [];
    p = await store.update(p.id, owner, p.revision, (p) =>
      addRequest(p, owner, {
        id: randomUUID(),
        title: "Guest checkout",
        source: "Verification fixture",
        text: SAMPLE_REQUEST,
        createdAt: new Date().toISOString(),
        createdBy: owner.email,
        baselineVersion: 1,
        analysis,
        engine: "Prepared verification fixture",
        status: "pending",
        category: "new_scope",
        roundId: "test-round",
      }),
    );
    const client = {
      uid: "validation-client",
      email: "client@scopesathi.invalid",
      name: "Validation client",
    };
    p = await store.update(p.id, owner, p.revision, (p) =>
      proposeRoundQuote(p, owner, "test-round"),
    );
    await assert.rejects(
      store.update(p.id, outsider, p.revision, (p) =>
        respondRoundQuote(p, outsider, p.quotes![0].id, true),
      ),
      /not found/,
    );
    p = await store.update(p.id, client, p.revision, (p) =>
      respondRoundQuote(p, client, p.quotes![0].id, true),
    );
    p = await store.update(p.id, owner, p.revision, (p) =>
      decide(
        p,
        owner,
        p.requests[0].id,
        "approved",
        "Verified tracking behaviour",
      ),
    );
    p = await store.update(p.id, owner, p.revision, (p) => {
      p.tasks[0].title = "Review guest checkout implementation";
    });
    p = await store.update(p.id, owner, p.revision, (p) =>
      recordInvoice(p, owner, p.quotes![0].id, "VALIDATION-001"),
    );
    p = await store.update(p.id, owner, p.revision, (p) =>
      proposeAmendment(p, owner, {
        requirementId: p.requirements[0].id,
        kind: "modification",
        proposedText:
          p.requirements[0].text + " Tracking links expire after 24 hours.",
        message:
          "Team correction: clarify the agreed guest tracking expiry as twenty-four hours.",
        category: "correction",
      }),
    );
    p = await store.update(p.id, owner, p.revision, (p) =>
      decide(
        p,
        owner,
        p.requests[0].id,
        "approved",
        "Synthetic amendment reviewed; retain original history.",
      ),
    );
    assert.equal(p.versions.length, 3);
    assert.equal(p.requirements[0].id, "REQ-001");
    const saved = await getFirestore().collection("projects").doc(p.id).get();
    assert.equal(saved.exists, true);
    assert.equal(saved.data()?.quotes[0].invoiceReference, "VALIDATION-001");
    await assert.rejects(store.get(p.id, outsider), /not found/);
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "tests/firestore.live.ts", "--read", p.id, owner.uid],
      { stdio: "inherit", env: process.env },
    );
    const code = await new Promise<number | null>((resolve) =>
      child.once("exit", resolve),
    );
    assert.equal(code, 0);
    console.log(
      "Live Firestore create, baseline, request, quote, client acceptance, approval, invoice reference, reviewed requirement amendment, task update, unauthorized access and fresh-process persistence checks passed. Google browser sign-in is tested separately.",
    );
  } finally {
    if (created) await store.delete(project.id, owner);
  }
}
