import "dotenv/config";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createProject } from "../server/domain";
import { createStore } from "../server/store";
import {
  sessionWelcome,
  syncExistingMemberships,
  invite,
  invitationDecision,
  revokeInvitation,
  inbox,
} from "../server/invitations";
process.env.EMAIL_ENABLED = "false";
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS)
  throw new Error(
    "Admin credential required for live invitation verification.",
  );
initializeApp({ credential: applicationDefault(), projectId: "scopesathi" });
const suffix = randomUUID();
const owner = {
  uid: `owner-test-${suffix}`,
  email: `owner-${suffix}@example.com`,
  name: "Invitation verification",
};
const recipientEmail = `reviewer-${suffix}@example.com`;
const db = getFirestore(),
  store = createStore(true);
let uid = "";
const p = createProject(
  owner,
  "Temporary invitation verification",
  "",
  "Disposable test project",
);
let projectCreated = false;
try {
  const user = await getAuth().createUser({
    email: recipientEmail,
    emailVerified: true,
  });
  uid = user.uid;
  await getAuth().updateUser(uid, {
    providerToLink: {
      providerId: "google.com",
      uid: `google-test-${suffix}`,
      email: recipientEmail,
    },
  });
  const recipient = { uid, email: recipientEmail, name: "Test reviewer" };
  await store.create(p);
  projectCreated = true;
  await Promise.all([sessionWelcome(recipient), sessionWelcome(recipient)]);
  assert.equal(
    (await db.collection("mailOutbox").doc(`welcome-${uid}`).get()).exists,
    true,
  );
  assert.equal(
    (await inbox(recipient)).filter((n) => n.kind === "welcome").length,
    1,
  );
  let next = await invite(p.id, owner, p.revision, recipientEmail, "reviewer");
  assert.equal(next.members[recipientEmail], undefined);
  await assert.rejects(store.get(p.id, recipient), /not found/);
  const invitation = next.invitations[0];
  assert.equal(
    (await inbox(recipient)).filter((n) => n.kind === "invitation").length,
    1,
  );
  await assert.rejects(
    invitationDecision(
      invitation.id,
      { ...recipient, uid: "wrong" },
      "accepted",
    ),
    /account that received/,
  );
  await invitationDecision(invitation.id, recipient, "accepted");
  next = await store.get(p.id, owner);
  assert.equal(next.members[recipientEmail], "reviewer");
  assert.equal((await store.get(p.id, recipient)).id, p.id);
  await assert.rejects(
    invitationDecision(invitation.id, recipient, "accepted"),
    /already/,
  );
  const second = await invite(
    p.id,
    owner,
    next.revision,
    recipientEmail,
    "editor",
  );
  await revokeInvitation(
    p.id,
    second.invitations[1].id,
    owner,
    second.revision,
  );
  await assert.rejects(
    invitationDecision(second.invitations[1].id, recipient, "accepted"),
    /already/,
  );
  const beforeRemoval = await store.get(p.id, owner);
  const third = await invite(
    p.id,
    owner,
    beforeRemoval.revision,
    recipientEmail,
    "viewer",
  );
  const removedInvitation = third.invitations.at(-1)!;
  await store.update(p.id, owner, third.revision, (project) => {
    delete project.members[recipientEmail];
    project.memberEmails = project.memberEmails.filter(
      (email) => email !== recipientEmail,
    );
    project.invitations.find(
      (item) => item.id === removedInvitation.id,
    )!.state = "revoked";
  });
  assert.equal(
    (await inbox(recipient)).find((n) => n.id === removedInvitation.id)?.state,
    "revoked",
  );
  const current = await store.get(p.id, owner);
  await store.update(p.id, owner, current.revision, (p) => {
    p.members[recipientEmail] = "viewer";
    p.memberEmails.push(recipientEmail);
  });
  await Promise.all([
    syncExistingMemberships(recipient),
    syncExistingMemberships(recipient),
  ]);
  assert.equal(
    (await inbox(recipient)).filter((n) => n.kind === "membership").length,
    1,
  );
  const outbox = await db
    .collection("mailOutbox")
    .where("recipientEmail", "==", recipientEmail)
    .get();
  assert.ok(outbox.docs.every((d) => d.data().status === "waiting_setup"));
  console.log(
    "Live verified-account lookup, invitation acceptance, pending-access denial, wrong-account rejection, repeat/revoked decision rejection, welcome deduplication and email waiting-state checks passed. No emails were sent.",
  );
} finally {
  if (projectCreated) await store.delete(p.id, owner);
  if (uid) {
    for (const name of ["notifications", "mailOutbox"]) {
      const docs = await db
        .collection(name)
        .where(
          name === "notifications" ? "recipientUid" : "recipientEmail",
          "==",
          name === "notifications" ? uid : recipientEmail,
        )
        .get();
      for (const doc of docs.docs) await doc.ref.delete();
    }
    await db.collection("users").doc(uid).delete();
    await getAuth().deleteUser(uid);
  }
}
