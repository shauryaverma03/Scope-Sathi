import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkFirebaseSession } from "../server/auth";
import { splitBrief, analyse, extract } from "../server/ai";
import {
  createProject,
  approveBaseline,
  saveProposal,
  addRequest,
  decide,
} from "../server/domain";
import {
  SAMPLE_BRIEF,
  SAMPLE_REQUEST,
  type ChangeRequest,
} from "../shared/model";
let child: ChildProcess, dir: string;
const url = "http://127.0.0.1:8095/api";
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "scope-free-"));
  child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      APP_MODE: "firebase",
      STORAGE_BACKEND: "local",
      GOOGLE_CLOUD_PROJECT: "test-scope",
      FIREBASE_WEB_CONFIG: JSON.stringify({
        projectId: "test-scope",
        apiKey: "test-public-key",
        authDomain: "test-scope.firebaseapp.com",
      }),
      GEMINI_API_KEY: "",
      PORT: "8095",
      SCOPESATHI_DATA_DIR: dir,
      NODE_ENV: "test",
    },
    stdio: "pipe",
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url + "/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Free mode did not start");
});
after(async () => {
  if (child && child.exitCode === null) {
    child.kill();
    await new Promise((r) => child.once("exit", r));
  }
  if (dir) await rm(dir, { recursive: true, force: true });
});
test("free mode starts without paid model or Admin credentials, reports actual storage", async () => {
  const c = await (await fetch(url + "/config")).json();
  assert.equal(c.mode, "firebase");
  assert.equal(c.storage, "local");
  assert.equal(c.ai, "manual");
  assert.equal(c.firebase.projectId, "test-scope");
  assert.ok(!JSON.stringify(c).includes("private_key"));
});
test("free backend rejects missing and forged tokens on read/write/upload", async () => {
  for (const path of [
    "/projects",
    "/sample",
    "/projects/00000000-0000-4000-8000-000000000000/document",
  ]) {
    const method = path === "/projects" ? "GET" : "POST";
    assert.equal((await fetch(url + path, { method })).status, 401);
    assert.equal(
      (
        await fetch(url + path, {
          method,
          headers: { Authorization: "Bearer forged.token.value" },
        })
      ).status,
      401,
    );
  }
});
test("session lookup rejects disabled sessions and connection failures", async () => {
  const fake = (status: number, body: unknown) =>
    (async () =>
      new Response(JSON.stringify(body), { status })) as typeof fetch;
  await checkFirebaseSession(
    "token",
    "key",
    fake(200, { users: [{ localId: "a" }] }),
  );
  await assert.rejects(
    checkFirebaseSession(
      "token",
      "key",
      fake(400, { error: { message: "USER_DISABLED" } }),
    ),
    /disabled/,
  );
  await assert.rejects(
    checkFirebaseSession(
      "token",
      "key",
      fake(200, { users: [{ disabled: true }] }),
    ),
    /sign in/,
  );
  await assert.rejects(
    checkFirebaseSession("token", "key", (async () => {
      throw new Error("offline");
    }) as typeof fetch),
    /connection/,
  );
});
test("manual extraction preserves long paragraphs and rejects truncation", async () => {
  const brief = "A requirement sentence. ".repeat(180);
  const parts = splitBrief(brief);
  assert.ok(parts.every((s) => s.length <= 2000));
  assert.equal(parts.join(" "), brief.trim());
  assert.throws(
    () =>
      splitBrief(
        Array.from({ length: 31 }, (_, i) => `Requirement ${i}`).join("\n"),
      ),
    /more than 30/,
  );
  const result = await extract(brief, false);
  assert.equal(result.requirements.length, parts.length);
});
test("manual multi-finding review saves without approval and flags linked tasks on decision", async () => {
  const a = { uid: "owner", email: "owner@example.com", name: "Owner" };
  const p = createProject(a, "Test", "", "");
  approveBaseline(
    p,
    a,
    SAMPLE_BRIEF,
    (await extract(SAMPLE_BRIEF, false)).requirements,
  );
  p.tasks = [
    {
      id: "T1",
      title: "Checkout",
      status: "done",
      requirementIds: ["REQ-001"],
    },
  ];
  const analysis = await analyse(p, SAMPLE_REQUEST, false, false);
  assert.equal(analysis.findings[0].kind, "clarification");
  const r: ChangeRequest = {
    id: "r",
    title: "Change",
    source: "Client",
    text: SAMPLE_REQUEST,
    createdAt: new Date().toISOString(),
    createdBy: a.email,
    baselineVersion: 1,
    analysis,
    engine: "Manual",
    status: "pending",
  };
  addRequest(p, a, r);
  const findings = [
    {
      ...analysis.findings[0],
      kind: "modification" as const,
      requirementId: "REQ-001",
      currentQuote: p.requirements[0].text,
      proposedText: "Customers can sign in or use guest checkout.",
      questions: [],
    },
    {
      ...analysis.findings[0],
      id: "F2",
      kind: "addition" as const,
      proposedText: "Customers receive a tracking link.",
      questions: [],
    },
  ];
  saveProposal(p, a, r.id, findings);
  assert.equal(p.versions.length, 1);
  assert.equal(p.requests[0].analysis.findings.length, 2);
  const outsider = {
    uid: "editor",
    email: "editor@example.com",
    name: "Editor",
  };
  p.members[outsider.email] = "editor";
  assert.throws(() => saveProposal(p, outsider, r.id, findings), /role/);
  decide(p, a, r.id, "approved", "Confirmed with client", findings);
  assert.equal(p.versions.length, 2);
  assert.equal(p.tasks[0].status, "needs_review");
  assert.equal(p.requirements.length, 6);
  assert.throws(
    () => saveProposal(p, a, r.id, findings),
    /already has a decision/,
  );
});
