import React, { useEffect, useState } from "react";
import { Bell, Check, X, RefreshCw, Mail } from "lucide-react";
import { api } from "./api";
import type { Project, Invitation, Config } from "../shared/model";
type Notice = {
  id: string;
  kind: "welcome" | "invitation" | "membership";
  title: string;
  message: string;
  state: string;
  projectName?: string;
  role?: string;
  expiresAt?: string;
  expired: boolean;
  emailStatus: string;
};
const mailText: Record<string, string> = {
  waiting_setup: "Email waiting for sender setup",
  queued: "Email queued",
  sending: "Email submission in progress",
  sent: "Email submitted to the sender",
  failed: "Email submission failed; no delivery confirmed",
  uncertain: "Email submission interrupted; check the sender account",
  cancelled: "Email cancelled",
  not_queued: "No email queued",
};
export function NotificationInbox({
  email,
  refresh,
}: {
  email: string;
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<Notice[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setItems(await api<Notice[]>("/notifications"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notifications unavailable.");
    }
  }
  useEffect(() => {
    let active = true;
    api<Notice[]>("/notifications")
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    const t = setInterval(() => {
      if (active) void load();
    }, 45000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [email]);
  const count = items.filter(
    (n) => n.kind === "invitation" && n.state === "pending" && !n.expired,
  ).length;
  async function decide(id: string, decision: "accepted" | "declined") {
    setBusy(true);
    setError("");
    try {
      await api(`/notifications/${id}/decision`, "POST", { decision });
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invitation action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="icon-button notification-bell"
        aria-label={`Notifications${count ? `, ${count} pending invitations` : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={19} />
        {count > 0 && <span>{count}</span>}
      </button>
      {open && (
        <section
          className="notifications-panel"
          aria-label="Your notifications"
        >
          <div className="panel-heading">
            <div>
              <h2>Your inbox</h2>
              <p>Invitations are tied to your verified Google account.</p>
            </div>
            <button
              className="icon-button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="editor-inner">
            <button className="text-button" onClick={() => void load()}>
              <RefreshCw size={14} />
              Refresh inbox
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {items.length === 0 && !error && <p>No notifications yet.</p>}
            {items.map((n) => (
              <article key={n.id} className="notice-card">
                <span className="badge">
                  {n.expired && n.state === "pending" ? "Expired" : n.state}
                </span>
                <h3>{n.title}</h3>
                <p>{n.message}</p>
                {n.role && (
                  <p className="helper">
                    Role: {n.role}.{" "}
                    {n.role === "reviewer"
                      ? "You can approve, reject or request clarification."
                      : n.role === "editor"
                        ? "You can prepare requests and manage tasks."
                        : "You can read project scope and history."}
                  </p>
                )}
                <small>
                  <Mail size={12} /> {mailText[n.emailStatus] || n.emailStatus}
                </small>
                {n.kind === "invitation" &&
                  n.state === "pending" &&
                  !n.expired && (
                    <div className="button-row">
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void decide(n.id, "accepted")}
                      >
                        <Check size={15} />
                        Accept invitation
                      </button>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => void decide(n.id, "declined")}
                      >
                        Decline
                      </button>
                    </div>
                  )}
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export function InvitationList({
  p,
  config,
  run,
  update,
}: {
  p: Project;
  config: Config;
  run: (fn: () => Promise<void>, message?: string) => Promise<void>;
  update: (p: Project) => void;
}) {
  const [rows, setRows] = useState<(Invitation & { emailStatus: string })[]>(
    [],
  );
  useEffect(() => {
    let active = true;
    if (config.storage === "firestore")
      api<typeof rows>(`/projects/${p.id}/invitations`)
        .then((data) => {
          if (active) setRows(data);
        })
        .catch(() => {
          if (active)
            setRows(
              p.invitations.map((i) => ({ ...i, emailStatus: "not_queued" })),
            );
        });
    return () => {
      active = false;
    };
  }, [p.id, p.revision]);
  return (
    <div className="pending-invitations">
      <h3>Invitations</h3>
      <p className="helper">
        Only registered, verified Google accounts can be invited. New access
        starts after acceptance.
      </p>
      {rows.length === 0 && (
        <p className="helper">No invitations for this project yet.</p>
      )}
      {rows.map((i) => (
        <article className="notice-card" key={i.id}>
          <strong>{i.email}</strong>
          <p>
            {i.role} ·{" "}
            {i.state === "pending" && Date.parse(i.expiresAt) < Date.now()
              ? "expired"
              : i.state}
          </p>
          <small>{mailText[i.emailStatus] || i.emailStatus}</small>
          {i.state === "pending" && (
            <button
              className="text-button"
              onClick={() =>
                run(
                  async () =>
                    update(
                      await api<Project>(
                        `/projects/${p.id}/invitations/${i.id}/revoke`,
                        "POST",
                        { revision: p.revision },
                      ),
                    ),
                  "Invitation revoked.",
                )
              }
            >
              Revoke invitation
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
