import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Project } from "../shared/model";
import { SAMPLE_BRIEF, SAMPLE_REQUEST } from "../shared/model";
let child: ChildProcess, dir: string;
const base = "http://127.0.0.1:8097/api";
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
      PORT: "8097",
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
test("Sunday Store PDF upload and extraction produce exactly six complete feature cards", async () => {
  const p = (
    await req("/projects", "POST", {
      name: "PDF regression",
      client: "Synthetic",
      description: "",
    })
  ).data;
  const form = new FormData();
  form.append(
    "file",
    new Blob([await readFile("output/pdf/Sunday-Store-Client-Brief.pdf")], {
      type: "application/pdf",
    }),
    "Sunday-Store-Client-Brief.pdf",
  );
  const uploaded = await fetch(`${base}/projects/${p.id}/document`, {
    method: "POST",
    body: form,
  });
  assert.equal(uploaded.status, 200);
  const { text } = await uploaded.json();
  const result = await req(`/projects/${p.id}/extract`, "POST", {
    brief: text,
    method: "local",
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.requirements.length, 6);
  assert.match(result.data.engine, /no AI calls/);
  assert.ok(
    result.data.requirements.every(
      (r: { quote: string }) =>
        text.includes(r.quote) && /^R[1-6]\./.test(r.quote),
    ),
  );
  assert.ok(
    result.data.context.some((c: { quote: string }) =>
      c.quote.includes("CSV exports"),
    ),
  );
  assert.equal((await req(`/projects/${p.id}`)).data.versions.length, 0);
  await req(`/projects/${p.id}`, "DELETE");
});

test("explicit local extraction is usable beyond the eight-request Gemini allowance", async () => {
  const p = (
    await req("/projects", "POST", {
      name: "Local fallback quota",
      client: "Synthetic",
      description: "",
    })
  ).data;
  try {
    for (let attempt = 0; attempt < 9; attempt++) {
      const result = await req(`/projects/${p.id}/extract`, "POST", { brief: SAMPLE_BRIEF, method: "ai" });
      if (result.status === 429) break;
      assert.equal(result.status, 200);
    }
    assert.equal((await req(`/projects/${p.id}/extract`, "POST", { brief: SAMPLE_BRIEF, method: "ai" })).status, 429);
    for (let attempt = 0; attempt < 10; attempt++) {
      const result = await req(`/projects/${p.id}/extract`, "POST", {
        brief: SAMPLE_BRIEF,
        method: "local",
      });
      assert.equal(
        result.status,
        200,
        `Local extraction blocked at attempt ${attempt + 1}`,
      );
      assert.match(result.data.engine, /no AI calls/);
    }
  } finally {
    await req(`/projects/${p.id}`, "DELETE");
  }
});

test("manual request submission bypasses prepared AI output and leaves scope unchanged", async () => {
  const p = (await req("/sample", "POST", {})).data;
  try {
    const result = await req(`/projects/${p.id}/requests`, "POST", {
      revision: p.revision,
      title: "Manual recovery",
      source: "Synthetic client",
      text: SAMPLE_REQUEST,
      method: "local",
    });
    assert.equal(result.status, 200);
    const request = result.data.requests[0];
    assert.equal(request.status, "pending");
    assert.match(request.engine, /Manual review.*no AI calls/);
    assert.equal(request.analysis.findings[0].kind, "clarification");
    assert.deepEqual(result.data.requirements, p.requirements);
    assert.deepEqual(result.data.versions, p.versions);
  } finally {
    await req(`/projects/${p.id}`, "DELETE");
  }
});

test("invalid, empty and oversized uploads return actionable errors without changing the project", async () => {
  const p = (
    await req("/projects", "POST", {
      name: "Upload failure QA",
      client: "Synthetic",
      description: "",
    })
  ).data;
  try {
    for (const [name, content] of [
      ["brief.docx", "Unsupported document"],
      ["brief.pdf", "This is not a PDF"],
      ["brief.txt", ""],
      ["brief.txt", "a".repeat(2 * 1024 * 1024 + 1)],
    ]) {
      const form = new FormData();
      form.append("file", new Blob([content]), name);
      const response = await fetch(`${base}/projects/${p.id}/document`, {
        method: "POST",
        body: form,
      });
      assert.equal(response.status, 400, name);
      assert.ok((await response.json()).error);
    }
    const fresh = (await req(`/projects/${p.id}`)).data;
    assert.equal(fresh.revision, p.revision);
    assert.equal(fresh.versions.length, 0);
    assert.equal(fresh.brief, "");
  } finally {
    await req(`/projects/${p.id}`, "DELETE");
  }
});
