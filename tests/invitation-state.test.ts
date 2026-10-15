import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentInvitationState,
  canSendInvitation,
} from "../server/invitation-state";
import type { Project } from "../shared/model";

test("stale pending invitations cannot be displayed or mailed after removal or project deletion", () => {
  const id = "qa-invite";
  const notice = {
    state: "pending",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
  const item = {
    id,
    ...notice,
    email: "test@example.com",
    uid: "test",
    role: "viewer",
    inviter: "Owner",
    createdAt: new Date().toISOString(),
  } as Project["invitations"][number];
  const project = { invitations: [item] };
  assert.equal(canSendInvitation(id, notice, project), true);
  item.state = "revoked";
  assert.equal(currentInvitationState(id, notice.state, project), "revoked");
  assert.equal(canSendInvitation(id, notice, project), false);
  assert.equal(currentInvitationState(id, notice.state, undefined), "revoked");
  assert.equal(canSendInvitation(id, notice, undefined), false);
  assert.equal(canSendInvitation(id, notice, { invitations: [] }), false);
  item.state = "pending";
  assert.equal(
    canSendInvitation(id, { ...notice, expiresAt: "invalid" }, project),
    false,
  );
  item.expiresAt = new Date(Date.now() - 1).toISOString();
  assert.equal(canSendInvitation(id, notice, project), false);
  assert.equal(currentInvitationState(id, "accepted", undefined), "accepted");
});
