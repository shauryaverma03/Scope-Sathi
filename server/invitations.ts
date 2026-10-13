import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "node:crypto";
import {
  normalizeProject,
  type Project,
  type Actor,
  type Role,
} from "../shared/model";
import { AppError, event, now } from "./domain";
import { mailJob, emailReady } from "./email";
export type Invitation = {
  id: string;
  email: string;
  uid: string;
  role: Role;
  inviter: string;
  createdAt: string;
  expiresAt: string;
  state: "pending" | "accepted" | "declined" | "revoked";
};
export function assertRecipient(
  target: {
    uid: string;
    email?: string;
    emailVerified: boolean;
    disabled: boolean;
    providerData: { providerId: string }[];
  },
  email: string,
) {
  if (
    target.email?.toLowerCase() !== email ||
    !target.emailVerified ||
    target.disabled ||
    !target.providerData.some((p) => p.providerId === "google.com")
  )
    throw new AppError(
      400,
      "Use a verified Google account registered with ScopeSathi. Ask your teammate to sign in once before inviting them.",
    );
}
export function assertAccept(invitation: Invitation, a: Actor) {
  if ((invitation.uid && invitation.uid !== a.uid) || invitation.email !== a.email)
    throw new AppError(
      403,
      "Sign in with the Google account that received this invitation.",
    );
  if (invitation.state !== "pending")
    throw new AppError(409, "This invitation already has a decision.");
  if (Date.parse(invitation.expiresAt) <= Date.now())
    throw new AppError(
      410,
      "This invitation expired. Ask the project owner to invite you again.",
    );
}
export async function sessionWelcome(a: Actor) {
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const ref = db.collection("users").doc(a.uid);
    const profile = await tx.get(ref);
    if (profile.exists) return;
    tx.create(ref, {
      uid: a.uid,
      email: a.email,
      name: a.name,
      firstSeenAt: now(),
    });
    const id = `welcome-${a.uid}`;
    tx.create(db.collection("notifications").doc(id), {
      recipientUid: a.uid,
      recipientEmail: a.email,
      kind: "welcome",
      title: "Welcome to ScopeSathi",
      message:
        "Your workspace is ready. Start with a client brief, review changes, and keep your team aligned.",
      state: "info",
      createdAt: now(),
    });
    tx.create(
      db.collection("mailOutbox").doc(id),
      mailJob(a.email, "welcome", { name: a.name }),
    );
  });
}
export async function syncExistingMemberships(a: Actor) {
  const db = getFirestore();
  const projects = await db
    .collection("projects")
    .where("memberEmails", "array-contains", a.email)
    .get();
  for (const snap of projects.docs) {
    const p = normalizeProject(snap.data() as Project);
    const role = p.members[a.email];
    if (
      p.ownerId === a.uid ||
      !role ||
      p.invitations.some(
        (i) => i.uid === a.uid && i.state === "accepted" && i.role === role,
      )
    )
      continue;
    const id = `membership-${p.id}-${a.uid}-${role}`;
    await db.runTransaction(async (tx) => {
      const ref = db.collection("notifications").doc(id);
      if ((await tx.get(ref)).exists) return;
      tx.create(ref, {
        recipientUid: a.uid,
        recipientEmail: a.email,
        kind: "membership",
        title: `Your role in ${p.name}`,
        message: `${p.ownerEmail} granted you ${role} access.`,
        role,
        projectName: p.name,
        projectId: p.id,
        state: "info",
        createdAt: now(),
      });
      tx.create(
        db.collection("mailOutbox").doc(id),
        mailJob(a.email, "membership", {
          project: p.name,
          inviter: p.ownerEmail,
          role,
        }),
      );
    });
  }
}
export async function invite(
  id: string,
  a: Actor,
  revision: number,
  email: string,
  role: Role,
  allowUnregistered = false,
) {
  let target: import("firebase-admin/auth").UserRecord | undefined;
  try {
    target = await getAuth().getUserByEmail(email);
  } catch (e: any) {
    if (e.code === "auth/user-not-found" && !allowUnregistered)
      throw new AppError(
        400,
        "RECIPIENT_NOT_REGISTERED: This person has not signed up. Check the email address or send a signup invitation.",
      );
    if (e.code !== "auth/user-not-found") throw new AppError(
      503,
      "Google account verification is unavailable. No invitation was created.",
    );
  }
  if (target) assertRecipient(target, email);
  const invitation: Invitation = {
    id: randomUUID(),
    email,
    uid: target?.uid || "",
    role,
    inviter: a.name || a.email,
    createdAt: now(),
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    state: "pending",
  };
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const ref = db.collection("projects").doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError(404, "Project not found.");
    const p = normalizeProject(snap.data() as Project);
    if (p.ownerId !== a.uid)
      throw new AppError(403, "Only the project owner can invite members.");
    if (p.revision !== revision)
      throw new AppError(409, "Refresh this project before inviting someone.");
    if (email === p.ownerEmail)
      throw new AppError(400, "The owner already has full access.");
    if (
      p.invitations.some(
        (i) =>
          i.email === email &&
          i.state === "pending" &&
          Date.parse(i.expiresAt) > Date.now(),
      )
    )
      throw new AppError(
        409,
        "A pending invitation already exists for this address. Revoke it before changing the role.",
      );
    p.invitations.push(invitation);
    p.revision++;
    if (Buffer.byteLength(JSON.stringify(p)) > 700000)
      throw new AppError(
        413,
        "This project reached its storage limit. Export before adding more records.",
      );
    event(
      p,
      a,
      "Invitation created",
      `${email}: ${role}. Awaiting acceptance.`,
    );
    tx.set(ref, p);
    tx.create(db.collection("notifications").doc(invitation.id), {
      ...invitation,
      recipientUid: target?.uid || "",
      recipientEmail: email,
      kind: "invitation",
      projectId: p.id,
      projectName: p.name,
      title: `Invitation to ${p.name}`,
      message: `${invitation.inviter} invited you as ${role}.`,
      createdAt: invitation.createdAt,
    });
    tx.create(
      db.collection("mailOutbox").doc(invitation.id),
      mailJob(email, "invitation", {
        project: p.name,
        inviter: invitation.inviter,
        role,
      }),
    );
    return p;
  });
}
export async function inbox(a: Actor) {
  const db = getFirestore();
  const rows = await db
    .collection("notifications")
    .where("recipientEmail", "==", a.email)
    .get();
  const result: any[] = [];
  for (const doc of rows.docs) {
    const data = doc.data();
    const mail = (await db.collection("mailOutbox").doc(doc.id).get()).data();
    result.push({
      ...data,
      id: doc.id,
      emailStatus: mail?.status || "not_queued",
      expired: data.expiresAt
        ? Date.parse(data.expiresAt) <= Date.now()
        : false,
    });
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function invitationDecision(
  id: string,
  a: Actor,
  decision: "accepted" | "declined",
) {
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const nref = db.collection("notifications").doc(id);
    const snap = await tx.get(nref);
    if (!snap.exists) throw new AppError(404, "Invitation not found.");
    const notification = snap.data()!;
    if (notification.kind !== "invitation")
      throw new AppError(400, "Not an invitation.");
    assertAccept(notification as Invitation, a);
    const pref = db.collection("projects").doc(notification.projectId);
    const project = await tx.get(pref);
    if (!project.exists)
      throw new AppError(410, "The project no longer exists.");
    const p = normalizeProject(project.data() as Project);
    const item = p.invitations.find((i) => i.id === id);
    if (!item || item.state !== "pending")
      throw new AppError(409, "This invitation is no longer active.");
    item.uid = a.uid;
    item.state = decision;
    if (decision === "accepted") {
      p.members[a.email] = item.role;
      p.memberEmails = [...new Set([...p.memberEmails, a.email])];
    }
    p.revision++;
    event(
      p,
      a,
      decision === "accepted" ? "Invitation accepted" : "Invitation declined",
      `${a.email}: ${item.role}`,
    );
    tx.set(pref, p);
    tx.update(nref, { state: decision, decidedAt: now() });
    if (decision === "accepted") {
      const key = `access-${id}`;
      tx.create(
        db.collection("mailOutbox").doc(key),
        mailJob(a.email, "access", { project: p.name, role: item.role }),
      );
    }
    return {
      state: decision,
      projectId: decision === "accepted" ? p.id : null,
    };
  });
}
export async function revokeInvitation(
  projectId: string,
  id: string,
  a: Actor,
  revision: number,
) {
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const ref = db.collection("projects").doc(projectId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError(404, "Project not found.");
    const p = normalizeProject(snap.data() as Project);
    if (p.ownerId !== a.uid)
      throw new AppError(403, "Only the owner can revoke invitations.");
    if (p.revision !== revision)
      throw new AppError(409, "Refresh before revoking.");
    const item = p.invitations.find((i) => i.id === id);
    if (!item || item.state !== "pending")
      throw new AppError(409, "Invitation is not pending.");
    item.state = "revoked";
    p.revision++;
    event(p, a, "Invitation revoked", item.email);
    tx.set(ref, p);
    tx.update(db.collection("notifications").doc(id), { state: "revoked" });
    return p;
  });
}
export async function invitationStatuses(p: Project) {
  const result = [];
  for (const item of p.invitations) {
    const mail = await getFirestore()
      .collection("mailOutbox")
      .doc(item.id)
      .get();
    result.push({ ...item, emailStatus: mail.data()?.status || "not_queued" });
  }
  return result;
}
