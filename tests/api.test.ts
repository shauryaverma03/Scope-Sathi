import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Project } from "../shared/model";
import { SAMPLE_BRIEF, SAMPLE_REQUEST } from "../shared/model";
let child: ChildProcess, dir: string;
const base = "http://127.0.0.1:8093/api";
async function req(
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: r.status === 204 ? null : await r.json() };
}
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "scope-api-"));
  child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PORT: "8093",
      SCOPESATHI_DATA_DIR: dir,
      NODE_ENV: "test",
    },
    stdio: "pipe",
  });
  let out = "";
  child.stderr?.on("data", (x) => (out += x.toString()));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("API startup failed: " + out);
});
after(async () => {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise<void>((r) => child.once("exit", () => r()));
  }
  if (dir) await rm(dir, { recursive: true, force: true });
});
test("complete API workflow and concurrent revision protection", async () => {
  let p = (await req("/sample", "POST", {})).data as Project;
  assert.equal(p.versions.length, 1);
  p = (
    await req(`/projects/${p.id}/requests`, "POST", {
      revision: p.revision,
      title: "Guest checkout",
      source: "Client",
      text: SAMPLE_REQUEST,
    })
  ).data;
  assert.equal(p.versions.length, 1);
  const r = p.requests[0];
  const unresolved = await req(
    `/projects/${p.id}/requests/${r.id}/decision`,
    "POST",
    { revision: p.revision, decision: "approved", note: "Looks good" },
  );
  assert.equal(unresolved.status, 409);
  const findings = structuredClone(r.analysis.findings);
  findings[0].questions = [];
  p = (
    await req(`/projects/${p.id}/requests/${r.id}/decision`, "POST", {
      revision: p.revision,
      decision: "approved",
      note: "Tracking details confirmed",
      findings,
    })
  ).data;
  assert.equal(p.versions.length, 2);
  assert.equal(p.requests[0].resultVersion, 2);
  assert.equal(p.tasks[0].status, "needs_review");
  const duplicate = await req(
    `/projects/${p.id}/requests/${r.id}/decision`,
    "POST",
    { revision: p.revision, decision: "rejected", note: "Another decision" },
  );
  assert.equal(duplicate.status, 409);
  const responses = await Promise.all(
    ["Task A", "Task B"].map((title) =>
      req(`/projects/${p.id}/tasks`, "POST", {
        revision: p.revision,
        title,
        requirementIds: [],
      }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const persisted = (await req(`/projects/${p.id}`)).data;
  assert.equal(persisted.tasks.length, 4);
});
test("stale reanalysis is rejected by preflight before model generation", async () => {
  let p = (await req("/sample", "POST", {})).data as Project;
  p = (
    await req(`/projects/${p.id}/requests`, "POST", {
      revision: p.revision,
      title: "Manual change",
      source: "Synthetic QA",
      text: "Please add a saved wish list.",
      method: "local",
    })
  ).data;
  const response = await req(
    `/projects/${p.id}/requests/${p.requests[0].id}/reanalyse`,
    "POST",
    { revision: p.revision - 1 },
  );
  assert.equal(response.status, 409);
  assert.match(response.data.error, /Refresh this project before reanalysing/);
  assert.equal((await req(`/projects/${p.id}`)).data.revision, p.revision);
});
test("new project, extraction, baseline and text upload", async () => {
  const p = (
    await req("/projects", "POST", {
      name: "Fresh project",
      client: "Test",
      description: "",
    })
  ).data;
  const noBaseline = await req(`/projects/${p.id}/requests`, "POST", {
    revision: 0,
    title: "Too early",
    source: "Test",
    text: SAMPLE_REQUEST,
  });
  assert.equal(noBaseline.status, 409);
  const form = new FormData();
  form.append(
    "file",
    new Blob([SAMPLE_BRIEF], { type: "text/plain" }),
    "brief.txt",
  );
  const uploaded = await fetch(`${base}/projects/${p.id}/document`, {
    method: "POST",
    body: form,
  });
  assert.equal(uploaded.status, 200);
  assert.equal((await uploaded.json()).text, SAMPLE_BRIEF);
  const extracted = (
    await req(`/projects/${p.id}/extract`, "POST", { brief: SAMPLE_BRIEF })
  ).data;
  assert.equal(extracted.requirements.length, 5);
  const approved = await req(`/projects/${p.id}/baseline`, "POST", {
    revision: 0,
    brief: SAMPLE_BRIEF,
    requirements: extracted.requirements,
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.versions.length, 1);
  const deleted = await req(`/projects/${p.id}`, "DELETE");
  assert.equal(deleted.status, 204);
  assert.equal((await req(`/projects/${p.id}`)).status, 404);
});
test("foreign browser origin is rejected and invalid inputs return 400", async () => {
  const malformed = await fetch(base + "/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal(
    (await malformed.json()).requestId,
    malformed.headers.get("x-request-id"),
  );
  assert.equal(
    (await req("/sample", "POST", {}, { Origin: "https://example.com" }))
      .status,
    403,
  );
  assert.equal((await req("/projects", "POST", { name: "x" })).status, 400);
});
test("cloud runtime cannot start in local demo mode", async () => {
  const p = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      K_SERVICE: "scope-sathi",
      PORT: "8094",
    },
    stdio: "pipe",
  });
  const code = await new Promise<number | null>((r) => p.once("exit", r));
  assert.notEqual(code, 0);
});

test("text PDF upload extracts usable source text", async () => {
  const p = (
    await req("/projects", "POST", {
      name: "PDF test",
      client: "Test",
      description: "",
    })
  ).data;
  const sentence = "Customers must sign in before checkout.";
  const stream = `BT /F1 12 Tf 50 750 Td (${sentence}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, obj] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const form = new FormData();
  form.append("file", new Blob([pdf], { type: "application/pdf" }), "test.pdf");
  const response = await fetch(`${base}/projects/${p.id}/document`, {
    method: "POST",
    body: form,
  });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).text.includes(sentence));
});

test("API persists structured intake, round grouping and extra-round agreement", async () => {
  let p = (
    await req("/projects", "POST", {
      name: "Intake API",
      client: "Client",
      description: "",
    })
  ).data;
  const intake = {
    goal: "Online store",
    users: "Customers",
    features: "Checkout",
    deliverables: "Website",
    constraints: "Accessible",
    acceptance: "Checkout succeeds",
    excluded: "Native apps",
  };
  p = (
    await req(`/projects/${p.id}/intake`, "POST", {
      revision: p.revision,
      intake,
      brief: SAMPLE_BRIEF,
    })
  ).data;
  assert.equal(p.intake.excluded, "Native apps");
  assert.equal(p.brief, SAMPLE_BRIEF);
  const requirements = (
    await req(`/projects/${p.id}/extract`, "POST", { brief: SAMPLE_BRIEF })
  ).data.requirements;
  p = (
    await req(`/projects/${p.id}/baseline`, "POST", {
      revision: p.revision,
      brief: SAMPLE_BRIEF,
      requirements,
    })
  ).data;
  assert.equal(
    (
      await req(`/projects/${p.id}/intake`, "POST", {
        revision: p.revision,
        intake,
      })
    ).status,
    409,
  );
  p = (
    await req(`/projects/${p.id}/revision-policy`, "POST", {
      revision: p.revision,
      includedRounds: 0,
      definition: "Related requests together count as one approved round.",
    })
  ).data;
  p = (
    await req(`/projects/${p.id}/rounds`, "POST", {
      revision: p.revision,
      name: "Client launch review",
    })
  ).data;
  const roundId = p.rounds[0].id;
  p = (
    await req(`/projects/${p.id}/requests`, "POST", {
      revision: p.revision,
      title: "Checkout change",
      source: "Client",
      text: SAMPLE_REQUEST,
      category: "new_scope",
      roundId,
    })
  ).data;
  const r = p.requests[0];
  assert.equal(r.roundId, roundId);
  const findings = structuredClone(r.analysis.findings);
  findings[0].questions = [];
  p = (
    await req(`/projects/${p.id}/requests/${r.id}/proposal`, "POST", {
      revision: p.revision,
      findings,
      category: "new_scope",
      roundId,
    })
  ).data;
  assert.equal(p.requests[0].roundId, roundId);
  const body = {
    revision: p.revision,
    decision: "approved",
    note: "Approved after client review",
    findings,
  };
  assert.equal(
    (await req(`/projects/${p.id}/requests/${r.id}/decision`, "POST", body))
      .status,
    409,
  );
  p = (
    await req(`/projects/${p.id}/requests/${r.id}/decision`, "POST", {
      ...body,
      separateAgreement: "Client confirmed the additional launch review round.",
    })
  ).data;
  assert.equal(p.versions.length, 2);
  assert.match(p.requests[0].separateAgreement, /launch review/);
});

test("pricing endpoints enforce schema, client identity and concurrency", async () => {
  let p = (await req("/sample", "POST", {})).data as Project;
  for (const invalid of [
    { rateMinor: -1 },
    { rateMinor: 0.5 },
    { currency: "INVALID" },
    { clientEmail: "wrong-address" },
  ]) {
    const res = await req("/projects/" + p.id + "/revision-policy", "POST", {
      revision: p.revision,
      includedRounds: 5,
      definition: "Related changes count as one round.",
      ...invalid,
    });
    assert.equal(res.status, 400);
  }
  assert.equal(
    (
      await req("/projects/" + p.id + "/revision-policy", "POST", {
        revision: p.revision,
        includedRounds: 5,
        definition: "Five included rounds before priced extra work.",
        rateMinor: 50000,
        clientEmail: "unknown@example.com",
        currency: "INR",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/projects/" + p.id + "/quotes", "POST", {
        revision: p.revision,
        roundId: "missing",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/projects/" + p.id + "/quotes", "POST", {
        revision: p.revision + 1,
        roundId: "missing",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("/projects/" + p.id + "/quotes/missing/respond", "POST", {
        revision: p.revision,
        accept: true,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await req("/projects/" + p.id + "/quotes/missing/invoice", "POST", {
        revision: p.revision,
        reference: "INV-1",
      })
    ).status,
    409,
  );
  assert.equal((await req("/projects/" + p.id)).data.revision, p.revision);
});

test("workspace amendments, task planning and explicit impact review persist over API reload", async () => {
  let p = (
    await req("/projects", "POST", {
      name: "Workspace API test",
      client: "",
      description: "",
    })
  ).data as Project;
  const brief =
    "Customers must search products.\nSCOPESATHI / document heading";
  p = (
    await req("/projects/" + p.id + "/baseline", "POST", {
      revision: p.revision,
      brief,
      requirements: [
        {
          id: "REQ-001",
          text: "Customers must search products.",
          quote: "Customers must search products.",
        },
        {
          id: "REQ-002",
          text: "SCOPESATHI / document heading",
          quote: "SCOPESATHI / document heading",
        },
      ],
    })
  ).data;
  p = (
    await req("/projects/" + p.id + "/task-plan", "POST", {
      revision: p.revision,
      items: [{ requirementId: "REQ-001", title: "Build product search" }],
    })
  ).data;
  const task = p.tasks[0];
  assert.equal(
    (
      await req("/projects/" + p.id + "/task-plan", "POST", {
        revision: p.revision,
        items: [{ requirementId: "REQ-001", title: "Duplicate task" }],
      })
    ).status,
    409,
  );
  p = (
    await req("/projects/" + p.id + "/amendments", "POST", {
      revision: p.revision,
      requirementId: "REQ-001",
      kind: "modification",
      proposedText: "Customers must search and filter products.",
      message: "Please add category filters to product search.",
      category: "new_scope",
    })
  ).data;
  assert.equal(p.versions.length, 1);
  assert.equal(p.requests[0].status, "pending");
  assert.equal(
    (
      await req("/projects/" + p.id + "/amendments", "POST", {
        revision: p.revision - 1,
        requirementId: "REQ-001",
        kind: "removal",
        proposedText: "",
        message: "Remove product search from scope.",
        category: "new_scope",
      })
    ).status,
    409,
  );
  p = (
    await req(
      "/projects/" + p.id + "/requests/" + p.requests[0].id + "/decision",
      "POST",
      {
        revision: p.revision,
        decision: "approved",
        note: "Client and reviewer confirmed filters",
      },
    )
  ).data;
  assert.equal(p.tasks[0].status, "needs_review");
  assert.equal(p.versions.length, 2);
  const edit = {
    revision: p.revision,
    title: task.title,
    status: "in_progress",
    requirementIds: ["REQ-001"],
    description: "Implement category filters with product search.",
  };
  assert.equal(
    (await req("/projects/" + p.id + "/tasks/" + task.id, "PATCH", edit))
      .status,
    400,
  );
  p = (
    await req("/projects/" + p.id + "/tasks/" + task.id, "PATCH", {
      ...edit,
      reviewNote: "Reviewed v2; updated work to include category filters.",
    })
  ).data;
  assert.equal(p.tasks[0].status, "in_progress");
  assert.match(p.tasks[0].reviewNote!, /v2/);
  const reopened = (await req("/projects/" + p.id)).data as Project;
  assert.equal(
    reopened.versions[0].requirements[0].text,
    "Customers must search products.",
  );
  assert.match(reopened.tasks[0].description!, /category filters/);
  assert.ok(
    reopened.events.some((e) => e.action === "Requirement amendment proposed"),
  );
  assert.ok(
    reopened.events.some(
      (e) => e.action === "Task updated" && e.detail.includes("v2"),
    ),
  );
});
