import {
  ApprovedWorkspace,
  EnhancedHistory,
  TaskPlanPanel,
} from "./WorkspaceViews";
import {
  FindingImpact,
  NextAction,
  ReportPreview,
  Traceability,
} from "./ReviewInsights";
import type { ExtractionResult } from "../shared/model";
import { NotificationInbox, InvitationList } from "./Notifications";
import {
  EmptyWorkspace,
  IntakePanel,
  RevisionPanel,
  CostPanel,
  RequestSummary,
  VersionComparison,
  ConnectionPanel,
} from "./WorkspacePanels";
import {
  needsSeparateAgreement,
  revisionSummary,
  roundScope,
  money,
} from "../shared/model";
import { Home, FirstVisit } from "./Welcome";
import React, { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  LayoutDashboard,
  Files,
  GitPullRequest,
  History,
  Settings,
  ChevronDown,
  Check,
  CheckCheck,
  ShieldCheck,
  Sparkles,
  FileText,
  Upload,
  Link2,
  Clock3,
  MoreHorizontal,
  Download,
  X,
  LoaderCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Trash2,
  Search,
  CheckCircle2,
  ListTodo,
  ExternalLink,
  ChevronRight,
  MessageSquare,
  LockKeyhole,
} from "lucide-react";
import type { User } from "firebase/auth";
import type {
  Config,
  Project,
  Requirement,
  ChangeRequest,
  Finding,
  Task,
} from "../shared/model";
import { SAMPLE_BRIEF, SAMPLE_REQUEST } from "../shared/model";
import { api, setupAuth, login, logout, download } from "./api";
export const ErrorContext = React.createContext({ message: "", sequence: 0 });
export function dialogError(
  error: { message: string; sequence: number },
  openedAt: number,
) {
  return error.sequence > openedAt ? error.message : "";
}
type Tab =
  "overview" | "baseline" | "requests" | "tasks" | "history" | "settings";
const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "baseline", label: "Approved scope", icon: Files },
  { id: "requests", label: "Change requests", icon: GitPullRequest },
  { id: "tasks", label: "Tasks & impact", icon: ListTodo },
  { id: "history", label: "Decision history", icon: History },
] as const;
const date = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Files size={28} />
      <h3>{title}</h3>
      <div className="empty-content">{children}</div>
    </div>
  );
}
function App() {
  const [config, setConfig] = useState<Config>();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<"project" | "request" | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState({ message: "", sequence: 0 });
  const error = errorState.message;
  function setError(message: string) {
    setErrorState((previous) => ({ message, sequence: previous.sequence + 1 }));
  }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [revealComplete, setRevealComplete] = useState(false);
  const pageReady = Boolean(config && authReady && !loading);
  useEffect(() => {
    if (!pageReady) {
      setRevealComplete(false);
      return;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(
      () => setRevealComplete(true),
      reduced ? 180 : 1800,
    );
    return () => window.clearTimeout(timer);
  }, [pageReady]);
  const p = projects.find((p) => p.id === selected);
  const request = p?.requests.find((r) => r.id === reviewId);
  const email =
    config?.mode === "demo"
      ? "demo@scopesathi.local"
      : user?.email?.toLowerCase() || "";
  const canEdit = p?.members[email] !== "viewer";
  const canReview = p?.members[email] === "reviewer";
  const update = (next: Project) => {
    setProjects((ps) =>
      ps.some((p) => p.id === next.id)
        ? ps.map((p) => (p.id === next.id ? next : p))
        : [next, ...ps],
    );
    setSelected(next.id);
  };
  async function refresh() {
    const all = await api<Project[]>("/projects");
    setProjects(all);
    setSelected((id) => (all.some((p) => p.id === id) ? id : all[0]?.id || ""));
  }
  async function checkConnection() {
    const database = await api<NonNullable<Config["database"]>>("/connection");
    const next = await api<Config>("/config");
    setConfig({ ...next, database });
    if (next.database?.state === "connected" || next.storage === "local")
      await refresh();
  }
  async function run(fn: () => Promise<void>, message?: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (message) setToast(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let mounted = true;
    api<Config>("/config")
      .then((c) => {
        if (!mounted) return;
        setConfig(c);
        if (c.mode === "demo") {
          setAuthReady(true);
        } else
          unsub = setupAuth(c, (u) => {
            setLoading(true);
            setProjects([]);
            setSelected("");
            setReviewId(null);
            setModal(null);
            setError("");
            setUser(u);
            setAuthReady(true);
          });
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);
  useEffect(() => {
    if (!authReady) return;
    if (config?.mode !== "demo" && !user) {
      setProjects([]);
      setSelected("");
      setLoading(false);
      return;
    }
    setLoading(true);
    let active = true;
    Promise.all([
      api<Project[]>("/projects"),
      config?.mode === "demo"
        ? Promise.resolve()
        : api("/session", "POST", {}).catch(() => {
            if (active)
              setError(
                "Account notifications could not be initialized. Open the inbox to retry or check the connection.",
              );
          }),
    ])
      .then(([all]) => {
        if (!active) return;
        setProjects(all);
        setSelected((id) =>
          all.some((p) => p.id === id) ? id : all[0]?.id || "",
        );
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authReady, user, config?.mode]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setModal(null);
        setReviewId(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy]);
  const seed = () =>
    run(async () => {
      update(await api<Project>("/sample", "POST", {}));
      setTab("overview");
    }, "Sample project is ready.");
  const change = (path: string, body: unknown) =>
    api<Project>(`/projects/${p!.id}${path}`, "POST", body).then(update);
  if (!config && !error)
    return <LoadingScreen stage="Preparing your workspace" />;
  if (!config)
    return (
      <div className="connection-page">
        <Brand />
        {error ? (
          <>
            <h1>Let’s reconnect.</h1>
            <p>{error}</p>
            <button
              className="button primary"
              onClick={() => window.location.reload()}
            >
              Try again <RefreshCw size={16} />
            </button>
          </>
        ) : (
          <div className="loading">
            <LoaderCircle className="spin" />
            Opening ScopeSathi…
          </div>
        )}
      </div>
    );
  if (config.mode !== "demo" && !authReady)
    return <LoadingScreen stage="Restoring your secure session" />;
  if (pageReady && !revealComplete) return <SparkleReveal />;
  if (config.mode !== "demo" && !user)
    return (
      <Home
        videoUrl={config.demoVideoUrl}
        busy={busy}
        error={error}
        login={(remember) =>
          run(async () => {
            await login(remember);
          })
        }
      />
    );
  if (loading)
    return <LoadingScreen stage="Loading your projects and permissions" />;
  return (
    <ErrorContext.Provider value={errorState}>
      <div className="shell">
        <aside className="sidebar">
          <Brand />
          <div className="workspace">
            <div className="workspace-icon">S</div>
            <div>
              <strong>Your workspace</strong>
              <small>
                {config?.mode === "demo" ? "Local demo" : "Google sign-in"}
              </small>
            </div>
            <ChevronDown size={15} />
          </div>
          <div className="nav-caption">WORKSPACE</div>
          <nav>
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`nav-link ${tab === t.id ? "active" : ""}`}
                onClick={() => {
                  setTab(t.id);
                  setReviewId(null);
                }}
              >
                <t.icon size={18} />
                {t.label}
                {t.id === "requests" &&
                  !!p?.requests.filter((r) => r.status === "pending")
                    .length && (
                    <span className="nav-count">
                      {p.requests.filter((r) => r.status === "pending").length}
                    </span>
                  )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="scope-note">
              <div className="mini-stars">✧</div>
              <strong>Clarity before commitment.</strong>
              <p>
                Your AI proposes.
                <br />
                Your team decides.
              </p>
              <span>
                <ShieldCheck size={14} /> Human approval, always
              </span>
            </div>
            <button
              className={`nav-link ${tab === "settings" ? "active" : ""}`}
              onClick={() => {
                setTab("settings");
                setReviewId(null);
              }}
            >
              <Settings size={18} />
              Project settings
            </button>
            <FirstVisit
              navigate={(next) => {
                setTab(next as Tab);
                setModal(null);
                setReviewId(null);
              }}
            />
            <div
              className="profile"
              title={
                user
                  ? `${user.displayName || "Google account"} · ${email}`
                  : "Demo reviewer"
              }
            >
              <div className="avatar">
                {(user?.displayName || "Demo reviewer")
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <strong>{user?.displayName || "Demo reviewer"}</strong>
                <small>
                  {config?.mode === "demo" ? "Sample workspace" : email}
                </small>
              </div>
              {user && (
                <button
                  className="icon-button"
                  aria-label="Sign out"
                  onClick={() =>
                    run(async () => {
                      await logout();
                    })
                  }
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <div className="breadcrumb">
              Workspace <ChevronRight size={13} />
              <span>{p?.name || "Projects"}</span>
              {p && (
                <span className="badge">
                  {p.ownerId === (user?.uid || "local-demo")
                    ? "Owner"
                    : p.members[email] || "Member"}
                </span>
              )}
            </div>
            <div className="top-actions">
              {config.mode !== "demo" && (
                <NotificationInbox email={email} refresh={refresh} />
              )}
              <span
                className={`connection ${config?.mode === "demo" ? "demo" : ""}`}
              >
                <span />
                {config?.mode === "demo"
                  ? "Local demo · sample analysis"
                  : config.storage === "firestore"
                    ? config.database?.state === "connected"
                      ? "Firestore verified"
                      : "Firestore needs setup"
                    : "Saved on this Mac"}
              </span>
              <button
                aria-label="Refresh projects"
                title="Refresh projects"
                className="icon-button"
                disabled={busy}
                onClick={() => run(checkConnection)}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </header>
          <main className="content">
            {error && (
              <div className="error" role="alert">
                <AlertTriangle size={18} />
                <span>{error}</span>
                <button aria-label="Dismiss error" onClick={() => setError("")}>
                  <X size={16} />
                </button>
              </div>
            )}
            {loading ? (
              <div className="loading">
                <LoaderCircle className="spin" />
                Opening your workspace…
              </div>
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">YOUR PROJECT, IN FOCUS</div>
                    <h1>
                      {tabs.find((t) => t.id === tab)?.label ||
                        "Project settings"}
                      <span className="heading-dot">.</span>
                    </h1>
                    <p>
                      {tab === "overview"
                        ? "A clear picture of what’s agreed, what’s changing, and what comes next."
                        : tab === "baseline"
                          ? "The agreement your team can build on. Every change starts here."
                          : tab === "requests"
                            ? "Turn client conversations into considered decisions."
                            : tab === "tasks"
                              ? "See the work affected by approved changes."
                              : tab === "history"
                                ? "A lasting record of every decision and approved version."
                                : "Manage your project, access, and Google Cloud connection."}
                    </p>
                  </div>
                  {(!p || !["tasks", "history", "settings"].includes(tab)) && (
                    <button
                      className="button primary"
                      onClick={() =>
                        setModal(p && p.versions.length ? "request" : "project")
                      }
                      disabled={busy || (!!p && !canEdit)}
                    >
                      <Plus size={17} />
                      {p && p.versions.length ? "New request" : "New project"}
                    </button>
                  )}
                </div>
                {projects.length > 0 && (
                  <div className="project-switch">
                    <label htmlFor="project-select">PROJECT</label>
                    <select
                      id="project-select"
                      value={selected}
                      onChange={(e) => {
                        setSelected(e.target.value);
                        setReviewId(null);
                      }}
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="text-button"
                      onClick={() => setModal("project")}
                    >
                      <Plus size={14} />
                      Create another
                    </button>
                  </div>
                )}
                {!p ? (
                  <EmptyWorkspace
                    tab={tab}
                    create={() => setModal("project")}
                    config={config}
                    email={email}
                    name={user?.displayName || "Demo reviewer"}
                    run={run}
                    refresh={checkConnection}
                  />
                ) : (
                  <>
                    {["overview", "requests", "settings"].includes(tab) && (
                      <details className="panel cost-disclosure">
                        <summary>
                          Revision allowance and extra-work estimates ·{" "}
                          {revisionSummary(p).remaining ?? "Unlimited"} rounds
                          remaining
                        </summary>
                        <CostPanel
                          p={p}
                          email={email}
                          owner={p.ownerId === (user?.uid || "local-demo")}
                          canReview={!!canReview}
                          run={run}
                          update={update}
                        />
                      </details>
                    )}
                    {tab === "overview" && (
                      <Overview
                        p={p}
                        email={email}
                        setTab={setTab}
                        open={setReviewId}
                        newRequest={() => setModal("request")}
                        canEdit={!!canEdit}
                      />
                    )}
                    {tab === "baseline" && (
                      <Baseline
                        onCreated={(next) => {
                          update(next);
                          setTab("requests");
                          setReviewId(next.requests[0].id);
                        }}
                        config={config}
                        key={p.id}
                        p={p}
                        busy={busy}
                        canReview={!!canReview}
                        canEdit={!!canEdit}
                        run={run}
                        update={update}
                      />
                    )}
                    {tab === "requests" && (
                      <Requests
                        key={p.id}
                        p={p}
                        open={setReviewId}
                        newRequest={() => setModal("request")}
                        canEdit={!!canEdit}
                      />
                    )}
                    {tab === "tasks" && (
                      <Tasks
                        key={p.id}
                        p={p}
                        busy={busy}
                        run={run}
                        update={update}
                        canEdit={!!canEdit}
                      />
                    )}
                    {tab === "history" && (
                      <EnhancedHistory key={p.id} p={p} open={setReviewId} />
                    )}
                    {tab === "settings" && (
                      <>
                        <section className="panel">
                          <div className="editor-inner">
                            <h2>Your account</h2>
                            <p>
                              {user?.displayName || "Demo reviewer"} · {email}
                            </p>
                          </div>
                        </section>
                        <ConnectionPanel
                          config={config}
                          run={run}
                          refresh={checkConnection}
                        />
                        <RevisionPanel
                          key={`policy-${p.id}-${JSON.stringify(p.revisionPolicy)}`}
                          p={p}
                          run={run}
                          update={update}
                          owner={p.ownerId === (user?.uid || "local-demo")}
                        />
                        <SettingsView
                          key={p.id}
                          p={p}
                          config={config!}
                          owner={p.ownerId === (user?.uid || "local-demo")}
                          busy={busy}
                          run={run}
                          update={update}
                          remove={() =>
                            run(async () => {
                              await api(`/projects/${p.id}`, "DELETE");
                              await refresh();
                              setTab("overview");
                            }, "Project deleted.")
                          }
                        />
                      </>
                    )}
                  </>
                )}
                <footer className="footer">
                  <span>
                    <ShieldCheck size={14} /> Your baseline changes only when a
                    reviewer approves.
                  </span>
                  <span>
                    Built for thoughtful teams{" "}
                    <span className="footer-star">✧</span>
                  </span>
                </footer>
              </>
            )}
          </main>
        </div>
        {toast && (
          <div role="status" className="toast">
            <CheckCircle2 size={18} />
            {toast}
          </div>
        )}
        {busy && (
          <div className="busy-indicator" role="status">
            <LoaderCircle className="spin" size={16} /> Working…
          </div>
        )}
        {modal === "project" && (
          <Modal
            title="A new beginning"
            subtitle="Create a project and establish the agreed scope."
            close={() => setModal(null)}
            busy={busy}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                run(async () => {
                  update(
                    await api<Project>("/projects", "POST", {
                      name: data.get("name"),
                      client: data.get("client"),
                      description: data.get("description"),
                    }),
                  );
                  setModal(null);
                  setTab("baseline");
                }, "Project created. Add your brief next.");
              }}
            >
              <label>
                Project name
                <input
                  name="name"
                  minLength={2}
                  maxLength={100}
                  required
                  placeholder="e.g. The Sunday Store"
                  autoFocus
                />
              </label>
              <label>
                Client or team
                <input
                  name="client"
                  maxLength={100}
                  placeholder="e.g. Sunday Studio"
                />
              </label>
              <label>
                A little context
                <textarea
                  name="description"
                  maxLength={500}
                  placeholder="What are you building together?"
                  rows={3}
                />
              </label>
              <button className="button primary full" disabled={busy}>
                Create project <ArrowRight size={17} />
              </button>
            </form>
          </Modal>
        )}
        {modal === "request" && p && (
          <Modal
            title="Bring a request into focus"
            subtitle="Nothing changes in your approved scope until you decide."
            close={() => setModal(null)}
            busy={busy}
          >
            <RequestForm
              key={p.id}
              p={p}
              demo={config.ai === "manual"}
              busy={busy}
              submit={(body) =>
                run(async () => {
                  const next = await api<Project>(
                    `/projects/${p.id}/requests`,
                    "POST",
                    { ...body, revision: p.revision },
                  );
                  update(next);
                  setModal(null);
                  setTab("requests");
                  setReviewId(next.requests[0].id);
                })
              }
            />
          </Modal>
        )}
        {request && p && (
          <Review
            key={`${request.id}-${p.revision}`}
            p={p}
            request={request}
            canReview={!!canReview}
            canEdit={!!canEdit}
            busy={busy}
            close={() => setReviewId(null)}
            decide={(decision, note, findings, agreement) =>
              run(async () => {
                await change(`/requests/${request.id}/decision`, {
                  revision: p.revision,
                  decision,
                  note,
                  findings,
                  separateAgreement: agreement,
                });
                setReviewId(null);
              }, `Request ${decision}.`)
            }
            save={(findings, category, roundId) =>
              run(async () => {
                await change(`/requests/${request.id}/proposal`, {
                  revision: p.revision,
                  findings,
                  category,
                  roundId,
                });
              }, "Proposal saved. Approved scope is unchanged.")
            }
            reanalyse={() =>
              run(async () => {
                await change(`/requests/${request.id}/reanalyse`, {
                  revision: p.revision,
                });
              }, "Analysis refreshed.")
            }
          />
        )}
      </div>
    </ErrorContext.Provider>
  );
}
function SparkleReveal() {
  return (
    <div
      className="sparkle-reveal"
      role="status"
      aria-label="Your page is ready"
    >
      <svg
        className="sparkle-reveal-mark"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <path d="M32 7 39 24 56 32 39 39 32 57 25 39 8 32 25 25Z" />
      </svg>
    </div>
  );
}
export function LoadingScreen({ stage }: { stage: string }) {
  return (
    <div
      className="boot-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="boot-brand">
        <Brand />
      </div>
      <div className="boot-animation" aria-hidden="true">
        <div className="boot-orbit" />
        <div className="boot-sheet">
          <span />
          <span />
          <span />
          <ShieldCheck size={26} />
        </div>
        <div className="boot-spark">✧</div>
      </div>
      <p className="eyebrow">CLARITY BEFORE COMMITMENT</p>
      <h1>Good work starts with shared scope.</h1>
      <p>{stage}…</p>
      <div className="boot-progress" aria-hidden="true">
        <span />
      </div>
      <div className="boot-steps" aria-hidden="true">
        <span>Secure session</span>
        <span>Project access</span>
        <span>Shared workspace</span>
      </div>
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <svg viewBox="0 0 32 32">
          <path d="M6 9h14l6 7-6 7H6l6-7z" />
        </svg>
      </div>
      scope<span>sathi</span>
      <sup>✧</sup>
    </div>
  );
}
function GoogleMark() {
  return <span className="google-mark">G</span>;
}
function Overview({
  p,
  email,
  setTab,
  open,
  newRequest,
  canEdit,
}: {
  p: Project;
  email: string;
  setTab: (t: Tab) => void;
  open: (id: string) => void;
  newRequest: () => void;
  canEdit: boolean;
}) {
  const pending = p.requests.filter((r) => r.status === "pending"),
    affected = p.tasks.filter((t) => t.status === "needs_review");
  return (
    <>
      <NextAction
        p={p}
        email={email}
        navigate={(next) => setTab(next as Tab)}
        open={open}
      />
      <RequestSummary p={p} />
      <section className="setup-checklist">
        <button onClick={() => setTab("baseline")}>
          {Object.values(p.intake).some(Boolean) ? "✓" : "1"} Client intake
        </button>
        <button onClick={() => setTab("baseline")}>
          {p.versions.length ? "✓" : "2"} Approved baseline
        </button>
        <button onClick={() => setTab("requests")}>
          {p.requests.length ? "✓" : "3"} Review requests
        </button>
        <button onClick={() => setTab("settings")}>
          {p.revisionPolicy.includedRounds !== null ? "✓" : "4"} Revision policy
        </button>
      </section>
      <details className="panel traceability-disclosure">
        <summary>Explore request-to-task traceability</summary>
        <Traceability p={p} open={open} />
      </details>
      <div className="stats">
        <Stat
          label="Approved requirements"
          value={p.requirements.length}
          note={
            p.versions.length
              ? `Baseline version ${p.versions.length}`
              : "Awaiting your first baseline"
          }
          icon={Files}
        />
        <Stat
          label="Awaiting a decision"
          value={pending.length}
          note={
            pending.length
              ? "A little clarity goes a long way"
              : "You’re all caught up"
          }
          icon={GitPullRequest}
          accent
        />
        <Stat
          label="Tasks to revisit"
          value={affected.length}
          note="After approved scope changes"
          icon={ListTodo}
        />
        <Stat
          label="Decisions recorded"
          value={p.requests.filter((r) => r.status !== "pending").length}
          note="Every decision, accounted for"
          icon={ShieldCheck}
        />
      </div>
      <div className="dashboard-grid">
        <div>
          <section className="project-hero">
            <div>
              <div className="hero-eyebrow">
                <span />{" "}
                {p.versions.length
                  ? "APPROVED & VERSIONED"
                  : "READY FOR YOUR FIRST BRIEF"}
              </div>
              <h2>{p.name}</h2>
              <p>
                {p.description ||
                  "A shared place for the scope you agree on and the changes you consider."}
              </p>
              <button className="hero-link" onClick={() => setTab("baseline")}>
                {p.versions.length
                  ? "Explore approved scope"
                  : "Set up the baseline"}{" "}
                <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="hero-sheet">
                <div className="sheet-dot" />
                <span />
                <span />
                <span />
                <div className="sheet-check">
                  <Check size={22} />
                </div>
              </div>
              <div className="float-version">
                v{p.versions.length || "1"} <Check size={12} />
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  On your radar <span className="count">{pending.length}</span>
                </h2>
                <p>Requests waiting for a thoughtful decision.</p>
              </div>
              <button
                className="text-button"
                onClick={() => setTab("requests")}
              >
                View all <ArrowRight size={15} />
              </button>
            </div>
            {pending.length ? (
              <div className="request-list">
                {pending.slice(0, 3).map((r) => (
                  <RequestRow key={r.id} r={r} open={() => open(r.id)} />
                ))}
              </div>
            ) : (
              <div className="calm-empty">
                <div className="calm-icon">
                  <CheckCheck size={25} />
                </div>
                <h3>A little breathing room.</h3>
                <p>
                  No requests awaiting review. Bring in a client message
                  <br />
                  when you’re ready to understand what changes.
                </p>
                {!!p.versions.length && canEdit && (
                  <button className="text-button" onClick={newRequest}>
                    Review a new request <ArrowRight size={15} />
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
        <div className="right-column">
          <section className="panel activity-panel">
            <div className="panel-heading">
              <h2>The latest</h2>
              <History size={17} />
            </div>
            <div className="timeline">
              {p.events.slice(0, 4).map((e, i) => (
                <div className="timeline-item" key={e.id}>
                  <div className={`timeline-dot ${i === 0 ? "latest" : ""}`}>
                    <Check size={11} />
                  </div>
                  <div>
                    <strong>{e.action}</strong>
                    <p>{e.detail}</p>
                    <small>
                      {e.actor} · {date(e.at)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <button className="text-button" onClick={() => setTab("history")}>
              All activity <ArrowRight size={15} />
            </button>
          </section>
          <section className="principle">
            <span className="eyebrow">THE SCOPESATHI WAY</span>
            <MessageSquare size={25} />
            <h3>
              “Could we add this?”
              <br />
              isn’t an approval.
            </h3>
            <p>
              Ideas stay proposals until a reviewer makes the call. Your agreed
              scope stays intact.
            </p>
            <div>
              <LockKeyhole size={14} /> Protected by human review
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
function Stat({
  label,
  value,
  note,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof Files;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <div>
        {label}
        <Icon size={17} />
      </div>
      <strong>{String(value).padStart(2, "0")}</strong>
      <small>{note}</small>
    </div>
  );
}
function RequestRow({ r, open }: { r: ChangeRequest; open: () => void }) {
  return (
    <button className="request-row" onClick={open}>
      <div className="request-icon">
        <GitPullRequest size={19} />
      </div>
      <div>
        <strong>{r.title}</strong>
        <small>
          {r.source} · {date(r.createdAt)} · compared with v{r.baselineVersion}
        </small>
        <small>
          {r.analysis.findings.length} findings ·{" "}
          {
            r.analysis.findings.filter(
              (f) => f.questions.length || f.kind === "clarification",
            ).length
          }{" "}
          need clarification ·{" "}
          {r.category === "correction" ? "Correction" : "New scope"}
        </small>
      </div>
      <Badge
        tone={
          r.status === "approved"
            ? "green"
            : r.status === "pending"
              ? "amber"
              : "neutral"
        }
      >
        {r.status === "pending"
          ? "Needs review"
          : r.status === "clarification"
            ? "Needs clarification"
            : r.status}
      </Badge>
      <ChevronRight size={16} />
    </button>
  );
}
function Requests({
  p,
  open,
  newRequest,
  canEdit,
}: {
  p: Project;
  open: (id: string) => void;
  newRequest: () => void;
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const list = p.requests.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      [
        r.title,
        r.text,
        r.source,
        ...r.analysis.findings.map((f) => f.requirementId + " " + f.title),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <section className="panel workspace-intro">
        <div>
          <h2>From client message to reviewed decision</h2>
          <p>
            Submit the exact request, confirm affected requirements, then
            approve, reject or ask for clarification.
          </p>
          <p className="helper">
            Every request starts as a proposal for review. Submitting a request
            never changes approved scope.
          </p>
        </div>
        <button
          className="button primary"
          disabled={!canEdit || !p.versions.length}
          onClick={newRequest}
        >
          <Plus size={16} /> Submit a change request
        </button>
      </section>
      <RequestSummary p={p} />
      <section className="panel">
        <div className="list-toolbar">
          <div className="filter-tabs">
            {["all", "pending", "approved", "clarification", "rejected"].map(
              (f) => (
                <button
                  className={filter === f ? "selected" : ""}
                  onClick={() => setFilter(f)}
                  key={f}
                >
                  {f === "pending"
                    ? "Needs review"
                    : f === "all"
                      ? "All requests"
                      : f}
                </button>
              ),
            )}
          </div>
          <div className="search">
            <Search size={16} />
            <input
              aria-label="Search requests"
              placeholder="Find a request…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {list.length ? (
          list.map((r) => (
            <RequestRow key={r.id} r={r} open={() => open(r.id)} />
          ))
        ) : (
          <Empty title="Nothing here yet">
            <p>
              {query || filter !== "all"
                ? "No matches. Clear the search or choose All requests."
                : p.versions.length
                  ? "No request has been submitted yet. Start with the client message using the button above."
                  : "Approve your project baseline before submitting a request."}
            </p>
            {canEdit && p.versions.length > 0 && !query && filter === "all" && (
              <button className="button primary" onClick={newRequest}>
                Create your first request
              </button>
            )}
          </Empty>
        )}
      </section>
    </>
  );
}
type Run = (fn: () => Promise<void>, message?: string) => Promise<void>;
function Baseline({
  config,
  onCreated,
  p,
  busy,
  canReview,
  canEdit,
  run,
  update,
}: {
  config: Config;
  onCreated: (next: Project) => void;
  p: Project;
  busy: boolean;
  canReview: boolean;
  canEdit: boolean;
  run: Run;
  update: (p: Project) => void;
}) {
  const [brief, setBrief] = useState(p.brief || "");
  const [review, setReview] = useState<ExtractionResult>();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [extractedBrief, setExtractedBrief] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  async function prepare(method: "ai" | "local") {
    setExtracting(true);
    setExtractionError("");
    try {
      const data = await api<ExtractionResult>(
        `/projects/${p.id}/extract`,
        "POST",
        { brief, method },
      );
      setRequirements(data.requirements);
      setReview(data);
      setCategoryFilter("all");
      setExtractedBrief(brief);
    } catch (e) {
      setExtractionError(
        e instanceof Error && e.name === "TimeoutError"
          ? "The server took too long. Retry or choose Prepare without AI. Your brief is unchanged."
          : e instanceof Error
            ? e.message
            : "Analysis failed. Please retry.",
      );
    } finally {
      setExtracting(false);
    }
  }
  if (p.versions.length)
    return (
      <ApprovedWorkspace
        p={p}
        canEdit={canEdit}
        busy={busy}
        run={run}
        onCreated={onCreated}
      />
    );
  return (
    <>
      <IntakePanel
        p={p}
        run={run}
        update={update}
        canEdit={canEdit}
        useBrief={(text) => {
          setBrief(text);
          setRequirements([]);
        }}
      />
      <section className="panel baseline-editor">
        <div className="panel-heading">
          <div>
            <h2>Start with a shared agreement</h2>
            <p>
              Paste a brief or upload a text PDF. Review each requirement before
              approval.
            </p>
          </div>
          <Badge>Step {requirements.length ? "2" : "1"} of 2</Badge>
        </div>
        <div className="editor-inner">
          <label>
            Project brief
            <textarea
              value={brief}
              onChange={(e) => {
                setBrief(e.target.value);
                setRequirements([]);
              }}
              rows={9}
              maxLength={16000}
              placeholder="Describe the agreed features, constraints, and deliverables…"
              disabled={!canEdit}
            />
          </label>
          <div className="button-row">
            <label className={`button upload ${busy ? "disabled" : ""}`}>
              <Upload size={16} />
              Upload PDF or text
              <input
                aria-label="Upload project brief"
                type="file"
                accept=".pdf,.txt"
                disabled={busy || !canEdit}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    run(async () => {
                      const data = new FormData();
                      data.set("file", f);
                      const result = await api<{ text: string }>(
                        `/projects/${p.id}/document`,
                        "POST",
                        data,
                      );
                      setBrief(result.text);
                      setRequirements([]);
                    });
                  e.target.value = "";
                }}
              />
            </label>
            <button
              className="button"
              disabled={busy || !canEdit || brief.trim().length < 20}
              onClick={() =>
                run(
                  async () =>
                    update(
                      await api<Project>(`/projects/${p.id}/intake`, "POST", {
                        revision: p.revision,
                        intake: p.intake,
                        brief,
                      }),
                    ),
                  "Brief draft saved.",
                )
              }
            >
              Save brief draft
            </button>
            <button
              className="text-button"
              onClick={() => {
                setBrief(SAMPLE_BRIEF);
                setRequirements([]);
              }}
              disabled={!canEdit}
            >
              Use example brief
            </button>
            <button
              className="button primary push-right"
              disabled={busy || brief.trim().length < 20 || !canEdit}
              onClick={() => run(() => prepare("ai"))}
            >
              <Sparkles size={16} />
              {busy
                ? "Preparing requirements…"
                : config.ai === "manual"
                  ? "Prepare clean requirements"
                  : "Analyse with Gemini"}
            </button>
          </div>
          {config.ai !== "manual" && (
            <button
              className="button"
              disabled={busy || !canEdit || brief.trim().length < 20}
              onClick={() => run(() => prepare("local"))}
            >
              Prepare without AI
            </button>
          )}
          {extracting && (
            <p role="status" className="info">
              Reading the brief and validating source quotes. Gemini has a
              40-second limit; a response or error will appear here.
            </p>
          )}
          {extractionError && (
            <div role="alert" className="error">
              {extractionError}
            </div>
          )}
          <p className="helper">
            Up to 2 MB / 16,000 characters. Text is extracted; the original file
            is not retained.
          </p>
          <div className="extraction-mode info">
            <Sparkles size={18} />
            <div>
              <strong>
                {config.ai === "manual"
                  ? "Document cleanup available · Gemini needs setup"
                  : `Gemini configured · ${config.model}`}
              </strong>
              <p>
                {config.ai === "manual"
                  ? "Wrapped clauses are grouped and headings are separated locally. This is rule-based cleanup, not semantic AI. Configure a private Gemini key/model to enable analysis."
                  : "Gemini proposes requirements and review questions. Exact evidence is validated; approval stays with your reviewer."}
              </p>
            </div>
          </div>
          {requirements.length > 0 && (
            <div className="extracted">
              <h3>Review your proposed baseline</h3>
              <p className="muted">
                Correct wording and check each quote. Extraction does not
                approve the scope.
              </p>
              {review && (
                <section className="analysis-review">
                  <span className="badge">{review.engine}</span>
                  <h3>{requirements.length} proposed clauses</h3>
                  <p>{review.summary}</p>
                  {!!review.questions.length && (
                    <div>
                      <strong>Questions to consider before approval</strong>
                      <ul>
                        {review.questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!!review.context.length && (
                    <details>
                      <summary>
                        Supporting agreement and document context (
                        {review.context.length} passages)
                      </summary>
                      <p className="helper">
                        Acceptance criteria and exclusions still apply. They
                        remain in the original brief and are included when
                        Gemini reviews later change requests.
                      </p>
                      {review.context.map((c, i) => (
                        <blockquote key={i}>
                          <p>{c.quote}</p>
                          <small>{c.reason}</small>
                        </blockquote>
                      ))}
                    </details>
                  )}
                </section>
              )}
              <div className="filter-tabs" aria-label="Requirement categories">
                {[
                  "all",
                  "feature",
                  "constraint",
                  "acceptance",
                  "exclusion",
                ].map((c) => (
                  <button
                    key={c}
                    className={categoryFilter === c ? "selected" : ""}
                    onClick={() => setCategoryFilter(c)}
                  >
                    {c.replace(/^./, (x) => x.toUpperCase())} (
                    {
                      requirements.filter(
                        (r) => c === "all" || (r.category || "feature") === c,
                      ).length
                    }
                    )
                  </button>
                ))}
              </div>
              {requirements.map((r, i) => (
                <div
                  hidden={
                    categoryFilter !== "all" &&
                    (r.category || "feature") !== categoryFilter
                  }
                  className="extracted-item"
                  key={r.id}
                >
                  <div className="row-between">
                    <span className="mono">{r.id}</span>
                    <button
                      aria-label={`Remove ${r.id}`}
                      className="icon-button"
                      disabled={!canEdit}
                      onClick={() =>
                        setRequirements((rs) => rs.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <label>
                    Requirement category
                    <select
                      value={r.category || "feature"}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setRequirements((rs) =>
                          rs.map((q, j) =>
                            j === i
                              ? {
                                  ...q,
                                  category: e.target
                                    .value as Requirement["category"],
                                }
                              : q,
                          ),
                        )
                      }
                    >
                      {["feature", "constraint", "acceptance", "exclusion"].map(
                        (c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Requirement
                    <textarea
                      value={r.text}
                      maxLength={2000}
                      rows={2}
                      onChange={(e) =>
                        setRequirements((rs) =>
                          rs.map((r, j) =>
                            j === i ? { ...r, text: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Exact source quote
                    <textarea
                      value={r.quote}
                      maxLength={2000}
                      rows={2}
                      onChange={(e) =>
                        setRequirements((rs) =>
                          rs.map((r, j) =>
                            j === i ? { ...r, quote: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
              <div className="approval-strip">
                <ShieldCheck size={23} />
                <p>
                  Approving creates version 1.
                  <br />
                  <strong>
                    Future requests cannot change it without review.
                  </strong>
                </p>
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    !canReview ||
                    extractedBrief !== brief ||
                    requirements.some((r) => !r.text.trim() || !r.quote.trim())
                  }
                  onClick={() =>
                    run(async () => {
                      update(
                        await api<Project>(
                          `/projects/${p.id}/baseline`,
                          "POST",
                          {
                            revision: p.revision,
                            brief,
                            requirements,
                          },
                        ),
                      );
                    }, "Baseline approved. Your scope is now protected.")
                  }
                >
                  <Check size={17} />
                  Approve baseline
                </button>
              </div>
              {!canReview && (
                <p className="helper">
                  A project reviewer must approve the baseline.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
export function RequestForm({
  p,
  demo,
  busy,
  submit,
}: {
  p: Project;
  demo: boolean;
  busy: boolean;
  submit: (body: Record<string, string>) => void;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [source, setSource] = useState("Client message");
  const [category, setCategory] = useState("new_scope");
  const [roundId, setRoundId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [method, setMethod] = useState(demo ? "local" : "ai");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!uploading)
          submit({ title, text, source, category, roundId, method });
      }}
    >
      {demo && (
        <div className="info">
          <Sparkles size={17} />
          <span>
            Live AI is not connected. Submit the request, then edit the
            proposal, choose its change type and resolve questions before
            approving.
          </span>
        </div>
      )}
      {!demo && (
        <label>
          Review method
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={busy || uploading}
          >
            <option value="ai">Analyse with Gemini</option>
            <option value="local">Manual review — no AI call</option>
          </select>
          <small className="helper">
            If Gemini is unavailable, submit for manual review. A reviewer must
            prepare and approve the proposal.
          </small>
        </label>
      )}
      <label>
        Request title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={150}
          placeholder="e.g. Add guest checkout"
          autoFocus
        />
      </label>
      <label>
        Where did it come from?
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option>Client message</option>
          <option>Meeting notes</option>
          <option>Email</option>
          <option>Project brief update</option>
        </select>
      </label>
      <div className="button-row">
        <label>
          Request category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="new_scope">New scope</option>
            <option value="correction">
              Correction to meet original agreement
            </option>
          </select>
        </label>
        <label>
          Revision round
          <select value={roundId} onChange={(e) => setRoundId(e.target.value)}>
            <option value="">Start a new round for this request</option>
            {p.rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="helper">
        Group related requests into the same round. A reviewer confirms the
        category before approval.
      </p>
      <label>
        The exact request
        <textarea
          required
          minLength={10}
          maxLength={12000}
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste what the client said. Include relevant context and dates."
        />
      </label>
      <label className="button upload">
        Upload revised PDF or text
        <input
          aria-label="Upload revised requirements"
          type="file"
          accept=".pdf,.txt"
          disabled={busy || uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setUploading(true);
            setUploadError("");
            try {
              const form = new FormData();
              form.set("file", file);
              const result = await api<{ text: string }>(
                `/projects/${p.id}/document`,
                "POST",
                form,
              );
              if (result.text.length > 12000)
                throw new Error(
                  "Revised requests accept up to 12,000 characters. Shorten this document and retry.",
                );
              setText(result.text);
              setSource("Project brief update");
            } catch (error) {
              setUploadError(
                error instanceof Error ? error.message : "Upload failed",
              );
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      {uploadError && (
        <p className="error" role="alert">
          {uploadError}
        </p>
      )}
      <p className="helper">
        Text PDFs only; scanned documents need OCR. Original files are not
        retained.
      </p>
      <div className="row-between">
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setTitle("Add guest checkout");
            setText(SAMPLE_REQUEST);
          }}
        >
          Use guest checkout example
        </button>
        <span className="helper">Compared with v{p.versions.length}</span>
      </div>
      <button className="button primary full" disabled={busy || uploading}>
        <Sparkles size={16} />
        {method === "local"
          ? "Submit for manual review"
          : "Analyse request"}{" "}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  close,
  busy,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  close: () => void;
  busy: boolean;
}) {
  const errorState = React.useContext(ErrorContext);
  const openedAt = React.useRef(errorState.sequence);
  const error = dialogError(errorState, openedAt.current);
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const last = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const list = focusable(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      last?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
      >
        <button
          className="modal-close icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
        <div className="eyebrow">SCOPESATHI WORKSPACE</div>
        <h2 id="modal-title">{title}</h2>
        <p>{subtitle}</p>
        {error && (
          <div className="error" role="alert">
            <AlertTriangle size={17} />
            {error}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
export function Review({
  p,
  request: r,
  canReview,
  canEdit,
  busy,
  close,
  decide,
  reanalyse,
  save,
}: {
  p: Project;
  request: ChangeRequest;
  canReview: boolean;
  canEdit: boolean;
  busy: boolean;
  close: () => void;
  decide: (d: string, n: string, f: Finding[], agreement?: string) => void;
  reanalyse: () => void;
  save: (findings: Finding[], category: string, roundId: string) => void;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [findings, setFindings] = useState<Finding[]>(
    structuredClone(r.analysis.findings),
  );
  const [note, setNote] = useState("");
  const [agreement, setAgreement] = useState("");
  const [category, setCategory] = useState(r.category || "new_scope");
  const [roundId, setRoundId] = useState(r.roundId || r.id);
  const [editRequested, setEditing] = useState(
    r.status === "pending" && r.engine.includes("Manual"),
  );
  const editing = canReview && r.status === "pending" && editRequested;
  const stale = r.baselineVersion !== p.versions.length;
  const openQuestions = findings.some(
    (f) => f.questions.length || f.kind === "clarification",
  );
  const patch = (id: string, change: Partial<Finding>) =>
    setFindings((fs) => fs.map((f) => (f.id === id ? { ...f, ...change } : f)));
  const requiresAgreement = needsSeparateAgreement(
    p,
    r.roundId || r.id,
    r.category || "new_scope",
    findings,
  );
  const scopeChange = findings.some((f) =>
    ["addition", "modification", "removal"].includes(f.kind),
  );
  const roundQuote = [...(p.quotes || [])]
    .reverse()
    .find((q) => q.roundId === (r.roundId || r.id) && q.state !== "superseded");
  const needsClientConsent =
    (r.category || "new_scope") === "new_scope" &&
    scopeChange &&
    (!!roundQuote ||
      ((p.revisionPolicy.rateMinor || 0) > 0 && requiresAgreement));
  const currentQuote =
    roundQuote?.state === "accepted" &&
    roundQuote.scope ===
      roundScope(
        {
          ...p,
          requests: p.requests.map((request) =>
            request.id === r.id
              ? { ...request, analysis: { ...request.analysis, findings } }
              : request,
          ),
        },
        r.roundId || r.id,
      );
  return (
    <Modal
      title={r.title}
      subtitle={`${r.source} · ${date(r.createdAt)} · Baseline v${r.baselineVersion}`}
      close={close}
      busy={busy}
    >
      <div className="review-summary">
        <Badge tone={r.status === "approved" ? "green" : "amber"}>
          {r.status}
        </Badge>
        <p>{r.analysis.summary}</p>
        <small>Analysis: {r.engine}</small>
        {r.analysis.run && (
          <details className="analysis-provenance">
            <summary>Analysis provenance</summary>
            <p className="helper">
              Model run: {r.analysis.run.provider} · {r.analysis.run.model} ·{" "}
              {(r.analysis.run.durationMs / 1000).toFixed(1)}s · prompt{" "}
              {r.analysis.run.promptVersion}. Generated{" "}
              {new Date(r.analysis.run.completedAt).toLocaleString()}. Metadata
              describes generation, not later reviewer edits.
            </p>
            <p className="helper">
              Input tokens: {r.analysis.run.inputTokens ?? "not reported"};
              output tokens: {r.analysis.run.outputTokens ?? "not reported"}.
              Usage is not a price estimate or confidence score.
            </p>
          </details>
        )}
        <button className="button" onClick={() => setReportOpen(true)}>
          Preview client report
        </button>
        <p className="helper">
          Category:{" "}
          {r.category === "correction"
            ? "Correction to original agreement"
            : "New scope"}{" "}
          · Round: {p.rounds.find((q) => q.id === r.roundId)?.name || r.title}
        </p>
        {r.separateAgreement && (
          <p>Separate agreement: {r.separateAgreement}</p>
        )}
      </div>
      {reportOpen && (
        <ReportPreview
          key={r.id}
          p={p}
          r={r}
          close={() => setReportOpen(false)}
        />
      )}
      {stale && r.status === "pending" && (
        <div className="info warning">
          <AlertTriangle size={18} />
          <div>
            This analysis uses an older baseline. Reanalyse before approving.
            <button
              className="text-button"
              onClick={reanalyse}
              disabled={busy || !canEdit}
            >
              <RefreshCw size={14} />
              Reanalyse against v{p.versions.length}
            </button>
          </div>
        </div>
      )}
      <details className="source-panel">
        <summary>Read the full incoming request</summary>
        <pre>{r.text}</pre>
      </details>
      {canReview && r.status === "pending" && (
        <button
          className="text-button edit-toggle"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Finish editing" : "Edit proposal & resolve questions"}
        </button>
      )}
      {editing && (
        <div className="panel editor-inner">
          <label>
            Reviewed request category
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as "new_scope" | "correction")
              }
            >
              <option value="new_scope">New scope</option>
              <option value="correction">
                Correction to original agreement
              </option>
            </select>
          </label>
          <label>
            Revision round
            <select
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
            >
              {p.rounds.map((q) => (
                <option value={q.id} key={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </label>
          <p className="helper">
            Save the classification and grouping before approval.
          </p>
        </div>
      )}
      {editing && (
        <div className="row-between">
          <button
            className="button"
            disabled={busy || findings.length >= 15}
            onClick={() =>
              setFindings((fs) => [
                ...fs,
                {
                  id: `F-${crypto.randomUUID().slice(0, 8)}`,
                  kind: "clarification",
                  title: "Additional change",
                  requirementId: "",
                  currentQuote: "",
                  requestQuote: r.text.slice(0, 1800),
                  proposedText: "",
                  reason: "Manual reviewer proposal",
                  questions: ["Confirm the intended scope."],
                  taskIds: [],
                },
              ])
            }
          >
            Add finding
          </button>
          <button
            className="button primary"
            disabled={busy || stale}
            onClick={() => save(findings, category, roundId)}
          >
            Save proposal
          </button>
        </div>
      )}
      {findings.map((f) => (
        <article className="finding" key={f.id}>
          <div className="row-between">
            <Badge tone={f.kind === "clarification" ? "amber" : "green"}>
              {f.kind.replace("_", " ")}
            </Badge>
            <span className="mono">{f.requirementId || "New requirement"}</span>
          </div>
          <h3>{f.title}</h3>
          <p>{f.reason}</p>
          <div className="evidence">
            <div>
              <span>CURRENT AGREEMENT</span>
              <blockquote>
                {f.currentQuote || "No existing requirement referenced."}
              </blockquote>
            </div>
            <div>
              <span>CLIENT REQUEST</span>
              <blockquote>{f.requestQuote}</blockquote>
            </div>
          </div>
          <FindingImpact p={p} r={r} f={f} locate />
          {editing ? (
            <div className="proposal-edit">
              <label>
                Finding title
                <input
                  value={f.title}
                  maxLength={150}
                  onChange={(e) => patch(f.id, { title: e.target.value })}
                />
              </label>
              <label>
                Exact quote from the request
                <textarea
                  value={f.requestQuote}
                  maxLength={2000}
                  onChange={(e) =>
                    patch(f.id, { requestQuote: e.target.value })
                  }
                />
              </label>
              <label>
                Reason
                <textarea
                  value={f.reason}
                  maxLength={2000}
                  onChange={(e) => patch(f.id, { reason: e.target.value })}
                />
              </label>
              <button
                className="text-button"
                disabled={findings.length === 1}
                onClick={() =>
                  setFindings((fs) => fs.filter((q) => q.id !== f.id))
                }
              >
                Remove finding
              </button>
              <label>
                Type of change
                <select
                  value={f.kind}
                  onChange={(e) =>
                    patch(f.id, { kind: e.target.value as Finding["kind"] })
                  }
                >
                  {[
                    "addition",
                    "modification",
                    "removal",
                    "clarification",
                    "no_change",
                  ].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                Existing requirement
                <select
                  value={f.requirementId}
                  onChange={(e) => {
                    const req = p.requirements.find(
                      (q) => q.id === e.target.value,
                    );
                    patch(f.id, {
                      requirementId: req?.id || "",
                      currentQuote: req?.text || "",
                      taskIds: p.tasks
                        .filter((t) => t.requirementIds.includes(req?.id || ""))
                        .map((t) => t.id)
                        .slice(0, 15),
                    });
                  }}
                >
                  <option value="">None / standalone addition</option>
                  {p.requirements.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.id}: {q.text.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Proposed requirement wording
                <textarea
                  value={f.proposedText}
                  rows={4}
                  maxLength={2000}
                  onChange={(e) =>
                    patch(f.id, { proposedText: e.target.value })
                  }
                />
              </label>
              <label>
                Affected tasks (hold Command/Ctrl to select multiple)
                <select
                  multiple
                  value={f.taskIds}
                  onChange={(e) =>
                    patch(f.id, {
                      taskIds: Array.from(
                        e.target.selectedOptions,
                        (o) => o.value,
                      ),
                    })
                  }
                >
                  {p.tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Open questions (one per line; remove only after resolving)
                <textarea
                  rows={3}
                  value={f.questions.join("\n")}
                  onChange={(e) =>
                    patch(f.id, {
                      questions: e.target.value
                        .split("\n")
                        .filter((q) => q.trim()),
                    })
                  }
                />
              </label>
            </div>
          ) : (
            f.proposedText && (
              <div className="proposed">
                <span>PROPOSED WORDING</span>
                <p>{f.proposedText}</p>
              </div>
            )
          )}
          {f.questions.length > 0 && (
            <div className="questions">
              <strong>
                <MessageSquare size={14} /> Needs a conversation
              </strong>
              <ul>
                {f.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {!!f.taskIds.length && (
            <div className="impact">
              <span>AFFECTED TASKS · SUGGESTED</span>
              {f.taskIds.map((id) => (
                <div key={id}>
                  <ListTodo size={14} />
                  {p.tasks.find((t) => t.id === id)?.title || id}
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
      {r.status === "pending" && canReview ? (
        <div className="decision-box">
          <h3>Your decision</h3>
          <p>
            Save your proposal after adding or removing findings. Record the
            reason, including answers to any resolved questions.
          </p>
          <label>
            Decision note
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              minLength={5}
              maxLength={1000}
              placeholder="Explain the decision for your team…"
            />
          </label>
          {openQuestions && (
            <p className="helper">
              Resolve open questions in the proposal before approving. You can
              request clarification now.
            </p>
          )}
          {needsClientConsent && (
            <div className="info">
              <div>
                {currentQuote && roundQuote
                  ? `Client accepted ${money(roundQuote.amountMinor, roundQuote.currency)}. Approval will record quote ${roundQuote.id} as the separate agreement.`
                  : "Client acceptance is required. Close this review and use the cost meter in Change requests to propose or update the estimate. The client can accept it from their own account."}
              </div>
            </div>
          )}
          {requiresAgreement && !needsClientConsent && (
            <label>
              Separate agreement for this additional round
              <textarea
                rows={3}
                value={agreement}
                maxLength={1000}
                onChange={(e) => setAgreement(e.target.value)}
                placeholder="Record who agreed to the additional round and its terms. No charge is applied automatically."
              />
              <span className="helper">
                The included allowance is exhausted. At least 10 characters
                required.
              </span>
            </label>
          )}
          <div className="decision-buttons">
            <button
              className="button primary"
              disabled={
                busy ||
                note.trim().length < 5 ||
                stale ||
                openQuestions ||
                category !== r.category ||
                roundId !== r.roundId ||
                (needsClientConsent && !currentQuote) ||
                (requiresAgreement &&
                  !needsClientConsent &&
                  agreement.trim().length < 10) ||
                findings.length !== r.analysis.findings.length ||
                findings.some((f, i) => f.id !== r.analysis.findings[i]?.id)
              }
              onClick={() => decide("approved", note, findings, agreement)}
            >
              <Check size={16} />
              Approve change
            </button>
            <button
              className="button"
              disabled={busy || note.trim().length < 5}
              onClick={() => decide("clarification", note, findings)}
            >
              Ask for clarification
            </button>
            <button
              className="button danger"
              disabled={busy || note.trim().length < 5}
              onClick={() => decide("rejected", note, findings)}
            >
              Reject
            </button>
          </div>
          <small>
            Approval creates a new baseline version when scope changes and flags
            affected tasks for review.
          </small>
        </div>
      ) : r.status !== "pending" ? (
        <div className="decision-box">
          <Badge tone="green">Decision recorded</Badge>
          <p>{r.reviewNote}</p>
          <small>
            {r.decidedBy} · {r.decidedAt && date(r.decidedAt)}
          </small>
          {r.status === "clarification" && (
            <p className="helper">
              After getting answers, submit a new request containing the
              clarified details. This decision stays in the history.
            </p>
          )}
        </div>
      ) : (
        <div className="info">
          <LockKeyhole size={17} />
          Only a project reviewer can make this decision.
        </div>
      )}
    </Modal>
  );
}
function Tasks({
  p,
  busy,
  run,
  update,
  canEdit,
}: {
  p: Project;
  busy: boolean;
  run: Run;
  update: (p: Project) => void;
  canEdit: boolean;
}) {
  const [edit, setEdit] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [description, setDescription] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const start = (t?: Task) => {
    setEdit(t || null);
    setAdding(true);
    setTitle(t?.title || "");
    setIds(t?.requirementIds || []);
    setStatus(t?.status || "todo");
    setDescription(t?.description || "");
    setReviewNote("");
  };
  return (
    <>
      <div className="request-metrics">
        {[
          [
            "Requirements with work",
            p.requirements.filter((r) =>
              p.tasks.some((t) => t.requirementIds.includes(r.id)),
            ).length +
              " / " +
              p.requirements.length,
          ],
          [
            "Needs scope review",
            p.tasks.filter((t) => t.status === "needs_review").length,
          ],
          [
            "Unlinked tasks",
            p.tasks.filter((t) => !t.requirementIds.length).length,
          ],
          ["Completed", p.tasks.filter((t) => t.status === "done").length],
        ].map(([label, n]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <TaskPlanPanel
        p={p}
        canEdit={canEdit}
        busy={busy}
        run={run}
        update={update}
      />
      <label className="search task-search">
        <Search size={16} />
        <input
          aria-label="Search tasks and requirement links"
          placeholder="Search tasks or requirement IDs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="section-summary">
        <p>
          Approved changes flag linked tasks. Review the wording before
          continuing work.
        </p>
        <div className="button-row">
          <button
            className="button"
            onClick={() =>
              download(
                `${p.name}-tasks.csv`,
                "\uFEFF" +
                  [
                    ["ID", "Title", "Status", "Requirement IDs"],
                    ...p.tasks.map((t) => [
                      t.id,
                      t.title,
                      t.status,
                      t.requirementIds.join(";"),
                    ]),
                  ]
                    .map((row) =>
                      row
                        .map(
                          (v) =>
                            `"${(/^[=+@\-\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`,
                        )
                        .join(","),
                    )
                    .join("\n"),
                "text/csv",
              )
            }
          >
            <Download size={15} />
            Export
          </button>
          <button
            className="button primary"
            disabled={!canEdit || !p.versions.length}
            onClick={() => start()}
          >
            <Plus size={16} />
            Add task
          </button>
        </div>
      </div>
      <div className="task-board">
        {(["needs_review", "todo", "in_progress", "done"] as const).map((s) => (
          <section className="task-column" key={s}>
            <h3>
              <span className={`status-dot ${s}`} />
              {s.replaceAll("_", " ")}
              <span>
                {
                  p.tasks.filter(
                    (t) =>
                      t.status === s &&
                      (
                        t.title +
                        " " +
                        t.description +
                        " " +
                        t.requirementIds.join(" ")
                      )
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  ).length
                }
              </span>
            </h3>
            {p.tasks
              .filter(
                (t) =>
                  t.status === s &&
                  (
                    t.title +
                    " " +
                    t.description +
                    " " +
                    t.requirementIds.join(" ")
                  )
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((t) => (
                <button
                  className="task-card"
                  key={t.id}
                  onClick={() => start(t)}
                >
                  <span className="mono">{t.id}</span>
                  <strong>{t.title}</strong>
                  <div>
                    <Link2 size={13} />
                    {t.requirementIds.length} linked requirements
                  </div>
                  {!!t.description && (
                    <p className="task-description">{t.description}</p>
                  )}
                  <ul className="task-links">
                    {t.requirementIds.slice(0, 3).map((id) => (
                      <li key={id}>
                        <b>{id}</b>{" "}
                        {p.requirements.find((r) => r.id === id)?.text ||
                          "Removed requirement - update links"}
                      </li>
                    ))}
                  </ul>
                  {!t.requirementIds.length && (
                    <small>Link this task to scope to track impact.</small>
                  )}
                  {s === "needs_review" && (
                    <>
                      <Badge tone="amber">
                        Scope changed - review required
                      </Badge>
                      <p className="task-impact-reason">
                        {p.requests.find(
                          (r) =>
                            r.status === "approved" &&
                            r.analysis.findings.some(
                              (f) =>
                                [
                                  "addition",
                                  "modification",
                                  "removal",
                                ].includes(f.kind) &&
                                (f.taskIds.includes(t.id) ||
                                  t.requirementIds.includes(f.requirementId)),
                            ),
                        )?.title ||
                          "An approved scope update affected this work."}
                      </p>
                    </>
                  )}
                </button>
              ))}
            {!p.tasks.some(
              (t) =>
                t.status === s &&
                (
                  t.title +
                  " " +
                  t.description +
                  " " +
                  t.requirementIds.join(" ")
                )
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            ) && (
              <div className="column-empty">
                {query
                  ? "No matching tasks"
                  : s === "needs_review"
                    ? "No scope reviews pending"
                    : s === "todo"
                      ? "Add a task or preview a task plan"
                      : s === "in_progress"
                        ? "Move reviewed work here when it starts"
                        : "Completed work appears here"}
              </div>
            )}
          </section>
        ))}
      </div>
      {adding && (
        <Modal
          title={edit ? "Review task" : "Add a task"}
          subtitle={
            canEdit
              ? "Review changed scope and record the next action."
              : "Read-only task details and scope evidence."
          }
          busy={busy}
          close={() => setAdding(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                update(
                  await api<Project>(
                    `/projects/${p.id}/tasks${edit ? "/" + edit.id : ""}`,
                    edit ? "PATCH" : "POST",
                    {
                      revision: p.revision,
                      title,
                      description,
                      reviewNote,
                      requirementIds: ids,
                      ...(edit ? { status } : {}),
                    },
                  ),
                );
                setAdding(false);
              }, "Task saved.");
            }}
          >
            <fieldset disabled={!canEdit || busy}>
              <label>
                Task title
                <input
                  minLength={3}
                  maxLength={200}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Work description / acceptance notes
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              {edit?.status === "needs_review" && (
                <div className="info warning">
                  <div>
                    <strong>Approved scope changed.</strong>
                    <p>
                      Inspect the linked requirement wording below, update this
                      work and explain how you reviewed it before moving it out
                      of Needs Review.
                    </p>
                  </div>
                </div>
              )}
              {edit && (
                <label>
                  Status
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as Task["status"])
                    }
                  >
                    {["todo", "in_progress", "done", "needs_review"].map(
                      (s) => (
                        <option key={s} value={s}>
                          {s.replaceAll("_", " ")}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              {edit && (
                <label>
                  Review / update note
                  <textarea
                    maxLength={1000}
                    rows={2}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="What changed and what should happen next?"
                  />
                </label>
              )}
              <label>Linked requirements</label>
              <div className="checkbox-list">
                {p.requirements.map((r) => (
                  <label key={r.id}>
                    <input
                      type="checkbox"
                      checked={ids.includes(r.id)}
                      onChange={(e) =>
                        setIds((prev) =>
                          e.target.checked
                            ? [...prev, r.id]
                            : prev.filter((x) => x !== r.id),
                        )
                      }
                    />
                    <span>
                      <b>{r.id}</b>
                      {r.text}
                    </span>
                  </label>
                ))}
              </div>
              {ids.some((id) => !p.requirements.some((r) => r.id === id)) && (
                <div className="info warning">
                  A linked requirement was removed.
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setIds(
                        ids.filter((id) =>
                          p.requirements.some((r) => r.id === id),
                        ),
                      )
                    }
                  >
                    Remove obsolete links
                  </button>
                </div>
              )}
              <button
                className="button primary full"
                disabled={
                  busy ||
                  !canEdit ||
                  (edit?.status === "needs_review" &&
                    status !== "needs_review" &&
                    reviewNote.trim().length < 5)
                }
              >
                Save task <Check size={16} />
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}
function SettingsView({
  p,
  config,
  owner,
  busy,
  run,
  update,
  remove,
}: {
  p: Project;
  config: Config;
  owner: boolean;
  busy: boolean;
  run: Run;
  update: (p: Project) => void;
  remove: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-heading">
          <h2>Project access</h2>
          <ShieldCheck size={18} />
        </div>
        <div className="editor-inner">
          <p className="muted">
            Reviewers approve changes. Editors submit requests and manage tasks.
            Viewers have read-only access.
          </p>
          {Object.entries(p.members).map(([email, role]) => (
            <div className="member" key={email}>
              <div>
                <strong>{email}</strong>
                <small>{email === p.ownerEmail ? "Owner" : role}</small>
              </div>
              {owner && email !== p.ownerEmail && (
                <button
                  className="icon-button"
                  aria-label={`Remove access for ${email}`}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      update(
                        await api<Project>(
                          `/projects/${p.id}/members`,
                          "DELETE",
                          { revision: p.revision, email },
                        ),
                      );
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {owner && (
            <form
              className="member-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  data = new FormData(form);
                run(async () => {
                  const payload = {
                    revision: p.revision,
                    email: data.get("email"),
                    role: data.get("role"),
                  };
                  try {
                    update(
                      await api<Project>(
                        `/projects/${p.id}/members`,
                        "POST",
                        payload,
                      ),
                    );
                  } catch (error) {
                    if (
                      !(error instanceof Error) ||
                      !error.message.includes("RECIPIENT_NOT_REGISTERED")
                    )
                      throw error;
                    if (
                      !window.confirm(
                        `${payload.email} has not signed up. Check the spelling. Send a signup invitation? Access will start only after they sign in with this email and accept. During local testing they must use this Mac.`,
                      )
                    )
                      throw new Error(
                        "Invitation cancelled. No email was queued.",
                      );
                    update(
                      await api<Project>(`/projects/${p.id}/members`, "POST", {
                        ...payload,
                        allowUnregistered: true,
                      }),
                    );
                  }
                  form.reset();
                }, "Invitation created. Your teammate must accept it before new access starts.");
              }}
            >
              <label>
                Teammate’s Google account
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="teammate@example.com"
                />
              </label>
              <label>
                Role
                <select name="role">
                  <option value="editor">Editor</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <button
                className="button"
                disabled={busy || config.mode === "demo"}
              >
                Invite teammate
              </button>
              <p className="helper">
                New teammates can receive a signup invitation. They must sign in
                with the invited Google account and accept before gaining
                access.{" "}
                {config.email?.configured
                  ? "Email notification is queued; delivery status appears below."
                  : "Email delivery is waiting for sender setup."}
              </p>
            </form>
          )}
          {owner && (
            <InvitationList p={p} config={config} run={run} update={update} />
          )}
        </div>
      </section>
      <div>
        {owner && (
          <section className="panel danger-zone">
            <h3>Delete project</h3>
            <p>
              Deletes this project’s scope, tasks, requests and history. Export
              anything you need first.
            </p>
            <label>
              Type the project name to confirm
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={p.name}
              />
            </label>
            <button
              className="button danger"
              disabled={busy || confirm !== p.name}
              onClick={remove}
            >
              <Trash2 size={15} />
              Delete project
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
export default App;
