import nodemailer from "nodemailer";
import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { canSendInvitation } from "./invitation-state";
import type { Project } from "../shared/model";
import { deployment } from "../shared/deployment";
export type EmailContent = { subject: string; html: string; text: string };
export function escapeHTML(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function publicAppURL() {
  try {
    const configured = process.env.APP_PUBLIC_URL;
    const fallback =
      process.env.APP_MODE === "google" &&
      process.env.GOOGLE_CLOUD_PROJECT === deployment.project
        ? deployment.origin
        : "";
    const u = new URL(configured === undefined ? fallback : configured);
    if (
      u.protocol !== "https:" ||
      !!u.username ||
      !!u.password ||
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
    )
      return "";
    return u.origin;
  } catch {
    return "";
  }
}
export function emailReady() {
  return !!(
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.EMAIL_FROM &&
    (publicAppURL() ||
      (process.env.EMAIL_LOCAL_TEST === "true" &&
        process.env.APP_MODE === "firebase" &&
        !process.env.K_SERVICE)) &&
    process.env.EMAIL_ENABLED === "true"
  );
}
const roleDetails = {
  reviewer:
    "Review requirements and approve, reject or request clarification on proposed changes.",
  editor:
    "Prepare change requests and manage tasks. Approval remains with reviewers.",
  viewer:
    "Read the agreed scope, project tasks and decision history. You cannot edit or approve changes.",
};
function layout(
  title: string,
  intro: string,
  body: string,
  url: string,
  button: string,
  footer: string,
): string {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(title)}</title></head><body style="margin:0;background:#f4f6ef;font-family:Arial,sans-serif;color:#244a3e"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden"><tr><td style="padding:30px;background:#244a3e;color:#ffffff;font-size:26px;font-weight:bold">◇ scopesathi <span style="color:#d5e7b4">✧</span><p style="font-size:11px;letter-spacing:2px;font-weight:normal;margin-bottom:0">CLARITY BEFORE COMMITMENT</p></td></tr><tr><td style="padding:32px"><h1 style="font-size:28px;line-height:1.2;margin:0 0 20px">${escapeHTML(title)}</h1><p style="font-size:16px;line-height:1.7">${intro}</p>${body}${url ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#244a3e;border-radius:8px"><a href="${escapeHTML(url)}" style="display:inline-block;padding:16px 24px;color:#ffffff;text-decoration:none;font-weight:bold">${escapeHTML(button)} →</a></td></tr></table>` : ""}<p style="color:#77836e;font-size:12px;line-height:1.7;margin-top:26px">${escapeHTML(footer)}</p></td></tr></table><p style="max-width:560px;color:#829074;font-size:12px;line-height:1.6">ScopeSathi · Every change deserves a clear decision.<br>This is an account or project notification, not a marketing subscription.</p></td></tr></table></body></html>`;
}
export function welcomeEmail(name: string, url = publicAppURL()): EmailContent {
  const title = "Welcome to shared clarity.";
  const items = [
    [
      "01",
      "Establish your baseline",
      "Capture a client brief and review requirements before approval.",
    ],
    [
      "02",
      "Review changes with evidence",
      "Compare requests with the original agreement and record a human decision.",
    ],
    [
      "03",
      "Keep your team aligned",
      "Track revision rounds, affected tasks, roles and scope history.",
    ],
  ];
  const body = items
    .map(
      ([n, h, p]) =>
        `<table role="presentation" width="100%" style="background:#f3f6eb;border-radius:10px;margin:18px 0"><tr><td style="padding:20px"><span style="color:#859b62">${n}</span><h2 style="font-size:18px;margin:10px 0">${h}</h2><p style="line-height:1.6;font-size:14px;margin:0">${p}</p></td></tr></table>`,
    )
    .join("");
  return {
    subject: "Welcome to ScopeSathi — clarity before commitment",
    html: layout(
      title,
      `Hello ${escapeHTML(name)}. Your Google account is ready. Here is how to get started:`,
      body,
      url,
      "Open your workspace",
      "Live AI suggestions depend on your workspace configuration. Your team always approves scope changes.",
    ),
    text: `Hello ${name}. Welcome to ScopeSathi. Capture the client brief, approve the baseline, review client changes, track revision rounds and affected tasks. Your team always approves scope changes.${url ? " Open your workspace: " + url : ""}`,
  };
}
export function invitationEmail(
  project: string,
  inviter: string,
  role: keyof typeof roleDetails,
  id: string,
  url = publicAppURL(),
): EmailContent {
  const link = url ? `${url}/?invitation=${encodeURIComponent(id)}` : "";
  const body = `<table role="presentation" width="100%" style="background:#f3f6eb;border-radius:10px;margin:22px 0"><tr><td style="padding:22px"><p style="margin:0;color:#829763;font-size:12px">YOUR INVITED ROLE</p><h2 style="font-size:22px;text-transform:capitalize">${escapeHTML(role)}</h2><p style="font-size:15px;line-height:1.7">${roleDetails[role]}</p></td></tr></table><p style="line-height:1.7">Sign in with the Google account that received this invitation, then accept it in your invitation inbox. Project access is granted only after acceptance. This invitation expires in seven days.</p>`;
  return {
    subject: `You’re invited to ${project} as a ${role} — ScopeSathi`,
    html: layout(
      "Your team has invited you.",
      `${escapeHTML(inviter)} invited you to <strong>${escapeHTML(project)}</strong>.`,
      body,
      link,
      "Review invitation",
      "If this invitation was unexpected, decline it or ignore this email. The project owner can revoke it.",
    ),
    text: `${inviter} invited you to ${project} as a ${role}. ${roleDetails[role]} Sign in with the invited Google account and accept in your inbox. Access is not granted until acceptance. Expires in seven days.${link ? " Review: " + link : ""}`,
  };
}
export function accessEmail(
  project: string,
  role: keyof typeof roleDetails,
  url = publicAppURL(),
): EmailContent {
  return {
    subject: `Your ${role} access to ${project} is active — ScopeSathi`,
    html: layout(
      "You’re part of the project.",
      `You accepted the invitation to <strong>${escapeHTML(project)}</strong>.`,
      `<p style="line-height:1.7">Your role is <strong>${escapeHTML(role)}</strong>. ${roleDetails[role]}</p>`,
      url,
      "Open your workspace",
      "Your access remains controlled by the project owner.",
    ),
    text: `You accepted ${role} access to ${project}. ${roleDetails[role]}${url ? " Open: " + url : ""}`,
  };
}
export function membershipEmail(
  project: string,
  owner: string,
  role: keyof typeof roleDetails,
  url = publicAppURL(),
): EmailContent {
  return {
    subject: `Your ${role} role in ${project} — ScopeSathi`,
    html: layout(
      "Your project role is ready.",
      `${escapeHTML(owner)} has granted you <strong>${escapeHTML(role)}</strong> access to <strong>${escapeHTML(project)}</strong>.`,
      `<p style="line-height:1.7">${roleDetails[role]}</p>`,
      url,
      "Open your workspace",
      "This records existing project access. The project owner controls your role.",
    ),
    text: `${owner} granted you ${role} access to ${project}. ${roleDetails[role]}${url ? " Open: " + url : ""}`,
  };
}
export function mailJob(
  recipientEmail: string,
  kind: "welcome" | "invitation" | "access" | "membership",
  payload: Record<string, string>,
) {
  return {
    recipientEmail,
    kind,
    payload,
    status: emailReady() ? "queued" : "waiting_setup",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
}
let running = false;
export async function deliverQueuedMail(batchSize = 10) {
  if (running || !emailReady()) return false;
  running = true;
  try {
    const db = getFirestore();
    const stuck = await db
      .collection("mailOutbox")
      .where("status", "==", "sending")
      .limit(10)
      .get();
    for (const doc of stuck.docs) {
      const row = doc.data();
      if (Date.now() - Date.parse(row.startedAt) > 120000)
        await doc.ref.update({
          status: "uncertain",
          error:
            "Sender submission was interrupted. Check the sender account before retrying to avoid duplicate email.",
        });
    }
    const jobs = await db
      .collection("mailOutbox")
      .where("status", "in", ["queued", "waiting_setup"])
      .limit(Math.max(1, Math.min(10, batchSize)))
      .get();
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: (process.env.SMTP_PORT || "465") === "465",
      requireTLS: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    for (const doc of jobs.docs) {
      const lease = randomUUID();
      const job = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        const data = fresh.data();
        if (!data || !["queued", "waiting_setup"].includes(data.status))
          return null;
        tx.update(doc.ref, {
          status: "sending",
          lease,
          attempts: (data.attempts || 0) + 1,
          startedAt: new Date().toISOString(),
        });
        return data;
      });
      if (!job) continue;
      if (job.kind === "invitation") {
        const n = await db.collection("notifications").doc(doc.id).get();
        const invitation = n.data();
        const project = invitation?.projectId
          ? await db.collection("projects").doc(invitation.projectId).get()
          : undefined;
        if (
          !invitation ||
          !canSendInvitation(
            doc.id,
            invitation as { state: string; expiresAt: string },
            project?.data() as Project | undefined,
          )
        ) {
          await doc.ref.update({ status: "cancelled" });
          continue;
        }
      }
      const payload = job.payload;
      const content =
        job.kind === "welcome"
          ? welcomeEmail(payload.name)
          : job.kind === "invitation"
            ? invitationEmail(
                payload.project,
                payload.inviter,
                payload.role,
                doc.id,
              )
            : job.kind === "membership"
              ? membershipEmail(payload.project, payload.inviter, payload.role)
              : accessEmail(payload.project, payload.role);
      if (!publicAppURL()) {
        const notice =
          "Local test: ScopeSathi is not publicly deployed. Open http://127.0.0.1:5173/ on the host Mac, sign in with this email, and use the notification inbox for invitations. This address will not work on another device.";
        content.subject = "[Local test] " + content.subject;
        content.html = content.html.replace(
          "<h1",
          `<p style="padding:16px;background:#f3f6eb;color:#244a3e">${notice}</p><h1`,
        );
        content.text = notice + "\n\n" + content.text;
      }
      try {
        const sent = await transport.sendMail({
          from: process.env.EMAIL_FROM,
          to: job.recipientEmail,
          subject: content.subject,
          html: content.html,
          text: content.text,
          messageId: `<${doc.id}@scopesathi.local>`,
        });
        if (!sent.accepted?.length) throw new Error("Recipient not accepted");
        await doc.ref.update({
          status: "sent",
          sentAt: new Date().toISOString(),
        });
      } catch {
        await doc.ref.update({
          status: "failed",
          error:
            "The sender could not confirm submission. Check email settings before retrying. A timeout may have submitted the message.",
        });
      }
    }
    transport.close();
    return true;
  } catch {
    console.error("Email queue check failed; no delivery confirmed.");
    return false;
  } finally {
    running = false;
  }
}
