import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject, access } from "../server/domain";
test("persistent local workspace isolates identities, enforces roles and revokes shared access", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scope-store-"));
  process.env.SCOPESATHI_DATA_DIR = dir;
  const { createStore } = await import("../server/store");
  const store = createStore(false);
  const owner = { uid: "owner", email: "owner@example.com", name: "Owner" };
  const viewer = { uid: "viewer", email: "viewer@example.com", name: "Viewer" };
  try {
    const p = createProject(owner, "Private", "", "");
    await store.create(p);
    assert.equal((await store.list(viewer)).length, 0);
    await assert.rejects(store.get(p.id, viewer), /not found/);
    await store.update(p.id, owner, 0, (p) => {
      p.members[viewer.email] = "viewer";
      p.memberEmails.push(viewer.email);
    });
    assert.equal((await store.list(viewer)).length, 1);
    await assert.rejects(
      store.update(p.id, viewer, 1, (p) => access(p, viewer, true)),
      /role/,
    );
    await assert.rejects(store.delete(p.id, viewer), /owner/);
    const restarted = createStore(false);
    assert.equal((await restarted.get(p.id, owner)).revision, 1);
    await restarted.update(p.id, owner, 1, (p) => {
      delete p.members[viewer.email];
      p.memberEmails = p.memberEmails.filter((e) => e !== viewer.email);
    });
    await assert.rejects(store.get(p.id, viewer), /not found/);
    await store.delete(p.id, owner);
    assert.equal((await store.list(owner)).length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
