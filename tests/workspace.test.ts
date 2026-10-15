import { test } from "node:test";
import assert from "node:assert/strict";
import { createProject, approveBaseline, decide } from "../server/domain";
import { proposeAmendment, draftTasks } from "../server/workspace";
import { revisionSummary } from "../shared/model";
const owner = { uid: "owner", email: "owner@example.com", name: "Owner" };
const editor = { uid: "editor", email: "editor@example.com", name: "Editor" };
const viewer = { uid: "viewer", email: "viewer@example.com", name: "Viewer" };
function fixture() {
  const p = createProject(owner, "Workspace upgrade", "", "");
  approveBaseline(
    p,
    owner,
    "Customers must search products.\nSCOPESATHI / document heading",
    [
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
  );
  p.members[editor.email] = "editor";
  p.members[viewer.email] = "viewer";
  return p;
}
test("approved edits are proposals, reviewer approval preserves IDs/versions and flags linked work", () => {
  const p = fixture();
  draftTasks(p, owner, [
    { requirementId: "REQ-001", title: "Implement search" },
  ]);
  const before = structuredClone(p.versions[0]);
  proposeAmendment(p, editor, {
    requirementId: "REQ-001",
    kind: "modification",
    proposedText: "Customers must search and filter products.",
    message: "Please add category filters alongside product search.",
    category: "new_scope",
  });
  assert.equal(p.requirements[0].text, before.requirements[0].text);
  assert.equal(p.tasks[0].status, "todo");
  assert.throws(
    () =>
      decide(
        p,
        editor,
        p.requests[0].id,
        "approved",
        "Editor attempted approval",
      ),
    /role/,
  );
  decide(
    p,
    owner,
    p.requests[0].id,
    "approved",
    "Reviewer confirmed the client request",
  );
  assert.equal(p.requirements[0].id, "REQ-001");
  assert.equal(p.versions.length, 2);
  assert.deepEqual(p.versions[0], before);
  assert.equal(p.tasks[0].status, "needs_review");
  assert.equal(revisionSummary(p).used, 1);
});
test("legacy metadata can be removed through a reviewed correction without consuming allowance", () => {
  const p = fixture();
  proposeAmendment(p, owner, {
    requirementId: "REQ-002",
    kind: "removal",
    proposedText: "",
    message:
      "This is a document heading accidentally extracted as a requirement.",
    category: "correction",
  });
  decide(
    p,
    owner,
    p.requests[0].id,
    "approved",
    "Confirmed extraction correction",
  );
  assert.equal(p.requirements.length, 1);
  assert.equal(p.versions[0].requirements.length, 2);
  assert.equal(revisionSummary(p).used, 0);
});
test("viewers cannot amend scope or plan work; duplicate and invalid task plans are rejected", () => {
  const p = fixture();
  assert.throws(
    () =>
      proposeAmendment(p, viewer, {
        requirementId: "REQ-001",
        kind: "removal",
        proposedText: "",
        message: "Remove product search from scope.",
        category: "new_scope",
      }),
    /role/,
  );
  assert.throws(
    () =>
      draftTasks(p, viewer, [
        { requirementId: "REQ-001", title: "Implement search" },
      ]),
    /role/,
  );
  assert.throws(
    () =>
      draftTasks(p, owner, [{ requirementId: "missing", title: "Bad link" }]),
    /Unknown/,
  );
  assert.throws(
    () =>
      draftTasks(p, owner, [
        { requirementId: "REQ-001", title: "One" },
        { requirementId: "REQ-001", title: "Two" },
      ]),
    /once/,
  );
  assert.equal(p.tasks.length, 0);
  draftTasks(p, editor, [{ requirementId: "REQ-001", title: "Build search" }]);
  assert.throws(
    () =>
      draftTasks(p, owner, [
        { requirementId: "REQ-001", title: "Build search again" },
      ]),
    /already/,
  );
});
test("unchanged edits and removal of the final requirement cannot bypass approval rules", () => {
  const p = fixture();
  assert.throws(
    () =>
      proposeAmendment(p, owner, {
        requirementId: "REQ-001",
        kind: "modification",
        proposedText: p.requirements[0].text,
        message: "No change intended to the scope.",
        category: "correction",
      }),
    /unchanged/,
  );
  p.requirements = [p.requirements[0]];
  proposeAmendment(p, owner, {
    requirementId: "REQ-001",
    kind: "removal",
    proposedText: "",
    message: "Remove every requirement from scope.",
    category: "correction",
  });
  assert.throws(
    () => decide(p, owner, p.requests[0].id, "approved", "Review removal"),
    /at least one/,
  );
});
