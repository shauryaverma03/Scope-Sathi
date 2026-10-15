import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  FileText,
  History,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { api, download } from "./api";
import { VersionComparison } from "./WorkspacePanels";
import type { Project, Requirement } from "../shared/model";
type Run = (fn: () => Promise<void>, message?: string) => Promise<void>;
export function ApprovedWorkspace({
  p,
  canEdit,
  busy,
  run,
  onCreated,
}: {
  p: Project;
  canEdit: boolean;
  busy: boolean;
  run: Run;
  onCreated: (p: Project) => void;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<{
    r: Requirement;
    kind: "modification" | "removal";
    text: string;
    message: string;
    category: "new_scope" | "correction";
  }>();
  const editorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (draft) {
      editorRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      editorRef.current
        ?.querySelector<HTMLTextAreaElement>("textarea")
        ?.focus({ preventScroll: true });
    }
  }, [draft?.r.id, draft?.kind]);
  const list = p.requirements.filter(
    (r) =>
      (filter === "all" || (r.category || "feature") === filter) &&
      [r.id, r.text].join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const legacy = p.requirements.some((r) =>
    /^SCOPESATHI\s*[/|]|^SUNDAY STORE\s*\/|^--\s*\d|^(?:Project context|Online Store Requirements)$/i.test(
      r.text,
    ),
  );
  return (
    <>
      <section className="panel workspace-intro">
        <div>
          <span className="badge green">Approved v{p.versions.length}</span>
          <h2>Your current agreement</h2>
          <p>
            {p.requirements.length} requirements ·{" "}
            {p.tasks.filter((t) => t.status === "needs_review").length} tasks
            need review
          </p>
          <p>
            To edit agreed wording, propose an amendment below. Approval creates
            a new version and preserves this agreement.
          </p>
        </div>
        <button
          className="button"
          onClick={() =>
            download(
              p.name + "-baseline.json",
              JSON.stringify(p.versions.at(-1), null, 2),
            )
          }
        >
          Export baseline
        </button>
      </section>
      {legacy && (
        <div className="info warning">
          <FileText size={20} />
          <div>
            <strong>
              This baseline includes document metadata from the earlier
              extractor.
            </strong>
            <p>
              Propose removal of headings/footer entries or edit incomplete
              clauses as corrections to the original agreement. Each proposal
              needs review; the old baseline stays in history.
            </p>
          </div>
        </div>
      )}
      {draft && (
        <section
          ref={editorRef}
          className="panel editor-inner amendment-editor"
        >
          <h2>
            {draft.kind === "removal" ? "Propose removal" : "Propose an edit"} ·{" "}
            {draft.r.id}
          </h2>
          <blockquote>{draft.r.text}</blockquote>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const next = await api<Project>(
                  "/projects/" + p.id + "/amendments",
                  "POST",
                  {
                    revision: p.revision,
                    requirementId: draft.r.id,
                    kind: draft.kind,
                    proposedText: draft.text,
                    message: draft.message,
                    category: draft.category,
                  },
                );
                setDraft(undefined);
                onCreated(next);
              }, "Amendment submitted. Approved scope awaits review.");
            }}
          >
            {draft.kind === "modification" && (
              <label>
                Replacement wording
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                />
              </label>
            )}
            <label>
              Exact client request or team correction explanation
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={3}
                value={draft.message}
                onChange={(e) =>
                  setDraft({ ...draft, message: e.target.value })
                }
                placeholder="Explain the intended edit/removal and why. This becomes the recorded source."
              />
            </label>
            <label>
              Classification
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    category: e.target.value as typeof draft.category,
                  })
                }
              >
                <option value="new_scope">
                  New scope - revision policy applies
                </option>
                <option value="correction">
                  Correction to meet the original agreement
                </option>
              </select>
            </label>
            <p className="helper">
              Classify document extraction mistakes as corrections only when
              this reflects the original agreement. A reviewer confirms the
              decision.
            </p>
            <div className="button-row">
              <button className="button primary" disabled={busy}>
                Submit amendment for review
              </button>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => setDraft(undefined)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      <div className="panel list-toolbar scope-toolbar">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search approved requirements"
            placeholder="Search ID or wording…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="scope-category">
          Category
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["all", "feature", "constraint", "acceptance", "exclusion"].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </label>
      </div>
      <div className="requirements-grid">
        {list.map((r) => (
          <article className="requirement-card" key={r.id}>
            <div>
              <span className="mono">{r.id}</span>
              <span className="badge">{r.category || "feature"}</span>
            </div>
            <h3>{r.text}</h3>
            <details>
              <summary>Exact source evidence</summary>
              <blockquote>{r.quote}</blockquote>
            </details>
            <small>
              {p.tasks.filter((t) => t.requirementIds.includes(r.id)).length}{" "}
              linked tasks ·{" "}
              {
                p.requests.filter(
                  (q) =>
                    q.status === "pending" &&
                    q.analysis.findings.some((f) => f.requirementId === r.id),
                ).length
              }{" "}
              pending proposals
            </small>
            {canEdit && (
              <div className="button-row">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    setDraft({
                      r,
                      kind: "modification",
                      text: r.text,
                      message: "",
                      category: "new_scope",
                    })
                  }
                >
                  Propose edit
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    setDraft({
                      r,
                      kind: "removal",
                      text: "",
                      message: "",
                      category: "new_scope",
                    })
                  }
                >
                  Propose removal
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!list.length && (
        <p className="info">
          No requirements match this search. Clear the search or choose All.
        </p>
      )}
      <details className="panel scope-comparison">
        <summary>Compare preserved versions ({p.versions.length})</summary>
        <VersionComparison p={p} />
      </details>
      <details className="panel source-panel">
        <summary>Original brief and intake</summary>
        <pre>{p.brief}</pre>
        {Object.entries(p.intake)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <p key={k}>
              <strong>{k}:</strong> {v}
            </p>
          ))}
      </details>
    </>
  );
}
export function EnhancedHistory({
  p,
  open,
}: {
  p: Project;
  open: (id: string) => void;
}) {
  const [filter, setFilter] = useState("decisions"),
    [query, setQuery] = useState(""),
    [order, setOrder] = useState("newest");
  const [version, setVersion] = useState(p.versions.length),
    [scopeQuery, setScopeQuery] = useState("");
  const v = p.versions.find((v) => v.number === version) || p.versions.at(-1);
  const matches = (value: string) =>
    value.toLowerCase().includes(query.toLowerCase());
  const decisions = p.requests
    .filter(
      (r) =>
        r.status !== "pending" &&
        matches([r.title, r.reviewNote, r.decidedBy, r.status].join(" ")),
    )
    .sort((a, b) =>
      order === "newest"
        ? (b.decidedAt || "").localeCompare(a.decidedAt || "")
        : (a.decidedAt || "").localeCompare(b.decidedAt || ""),
    );
  const events = p.events
    .filter(
      (e) =>
        matches(e.action + " " + e.detail + " " + e.actor) &&
        (filter === "all" ||
          (filter === "tasks" && /^Task/i.test(e.action)) ||
          (filter === "access" && /invit|member|access/i.test(e.action)) ||
          (filter === "pricing" &&
            /round|quote|estimate|invoice|allowance|pricing/i.test(e.action))),
    )
    .sort((a, b) =>
      order === "newest" ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at),
    );
  return (
    <>
      <div className="request-metrics">
        {[
          ["Scope versions", p.versions.length],
          [
            "Approved decisions",
            p.requests.filter((r) => r.status === "approved").length,
          ],
          [
            "Rejected",
            p.requests.filter((r) => r.status === "rejected").length,
          ],
          [
            "Clarification",
            p.requests.filter((r) => r.status === "clarification").length,
          ],
        ].map(([k, n]) => (
          <div key={k}>
            <small>{k}</small>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <div className="history-grid">
        <section className="panel history-panel">
          <div className="panel-heading">
            <h2>Decision trail</h2>
            <button
              className="text-button"
              onClick={() =>
                download(
                  p.name + "-history.json",
                  JSON.stringify(
                    {
                      versions: p.versions,
                      requests: p.requests,
                      events: p.events,
                      quotes: p.quotes || [],
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              Export history
            </button>
          </div>
          <div className="history-controls">
            <input
              aria-label="Search decision history"
              placeholder="Search reason, reviewer or action…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="button-row">
              <select
                aria-label="History category"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {["decisions", "all", "tasks", "access", "pricing"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
              <select
                aria-label="History order"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
          <div
            className="history-scroll timeline large"
            tabIndex={0}
            role="region"
            aria-label="Scrollable decision trail"
          >
            {filter === "decisions" ? (
              <>
                {[
                  ...decisions.map((r) => ({
                    id: r.id,
                    at: r.decidedAt || r.createdAt,
                    type: "request",
                    r,
                  })),
                  ...p.versions
                    .filter((v) => matches(v.reason + " " + v.approvedBy))
                    .map((v) => ({
                      id: "v" + v.number,
                      at: v.approvedAt,
                      type: "baseline",
                      v,
                    })),
                ]
                  .sort((a, b) =>
                    order === "newest"
                      ? b.at.localeCompare(a.at)
                      : a.at.localeCompare(b.at),
                  )
                  .map((item) =>
                    "r" in item ? (
                      <article className="decision-record" key={item.id}>
                        <span
                          className={
                            "badge " +
                            (item.r.status === "approved" ? "green" : "amber")
                          }
                        >
                          {item.r.status}
                        </span>
                        <h3>{item.r.title}</h3>
                        <p>{item.r.reviewNote}</p>
                        <small>
                          {item.r.decidedBy} ·{" "}
                          {new Date(item.at).toLocaleString()}
                        </small>
                        <p className="helper">
                          {item.r.analysis.findings.length} findings · reviewed
                          against v{item.r.baselineVersion} ·{" "}
                          {item.r.category === "correction"
                            ? "Correction"
                            : "New scope"}
                        </p>
                        <button
                          className="text-button"
                          onClick={() => open(item.r.id)}
                        >
                          View evidence and decision
                        </button>
                      </article>
                    ) : (
                      <article className="decision-record" key={item.id}>
                        <span className="badge green">
                          Baseline v{item.v.number}
                        </span>
                        <p>{item.v.reason}</p>
                        <small>
                          {item.v.approvedBy} ·{" "}
                          {new Date(item.at).toLocaleString()}
                        </small>
                        <button
                          className="text-button"
                          onClick={() => setVersion(item.v.number)}
                        >
                          Inspect preserved version
                        </button>
                      </article>
                    ),
                  )}
                {!decisions.length && (
                  <p>
                    No request decisions yet. Submit and review a request to
                    build the trail.
                  </p>
                )}
              </>
            ) : events.length ? (
              events.map((e) => (
                <article className="decision-record" key={e.id}>
                  <h3>{e.action}</h3>
                  <p>{e.detail}</p>
                  <small>
                    {e.actor} · {new Date(e.at).toLocaleString()}
                  </small>
                </article>
              ))
            ) : (
              <p>No activity matches these filters.</p>
            )}
          </div>
        </section>
        <section className="panel history-panel">
          <div className="panel-heading">
            <h2>Baseline archive</h2>
            <select
              aria-label="Baseline version"
              value={v?.number || 0}
              onChange={(e) => setVersion(Number(e.target.value))}
            >
              {p.versions.map((v) => (
                <option key={v.number} value={v.number}>
                  Version {v.number}
                </option>
              ))}
            </select>
          </div>
          <div className="history-controls">
            <input
              aria-label="Search archived requirements"
              placeholder="Search this version…"
              value={scopeQuery}
              onChange={(e) => setScopeQuery(e.target.value)}
            />
            {v && (
              <p className="helper">
                {v.reason} · {v.approvedBy} · {v.requirements.length}{" "}
                requirements
              </p>
            )}
          </div>
          <div
            key={v?.number}
            className="history-scroll archive"
            tabIndex={0}
            role="region"
            aria-label="Scrollable baseline archive"
          >
            {v ? (
              v.requirements
                .filter((r) =>
                  (r.id + " " + r.text)
                    .toLowerCase()
                    .includes(scopeQuery.toLowerCase()),
                )
                .map((r) => (
                  <article className="archive-req" key={r.id}>
                    <span className="mono">{r.id}</span>
                    <p>{r.text}</p>
                    <details>
                      <summary>Source passage</summary>
                      <blockquote>{r.quote}</blockquote>
                    </details>
                  </article>
                ))
            ) : (
              <p>Approve the initial baseline to start the archive.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export function TaskPlanPanel({
  p,
  canEdit,
  busy,
  run,
  update,
}: {
  p: Project;
  canEdit: boolean;
  busy: boolean;
  run: Run;
  update: (p: Project) => void;
}) {
  const [show, setShow] = useState(false),
    [drafts, setDrafts] = useState<
      { requirementId: string; title: string; selected: boolean }[]
    >([]);
  const uncovered = p.requirements.filter(
    (r) =>
      !p.tasks.some((t) => t.requirementIds.includes(r.id)) &&
      r.category !== "exclusion" &&
      (r.category === "feature" ||
        (!r.category && /\b(must|shall|support|provide|can)\b/i.test(r.text))),
  );
  return (
    <section className="panel workspace-intro task-plan">
      <div>
        <h2>Turn scope into linked work</h2>
        <p>
          {uncovered.length} feature requirements have no linked task. Preview
          one starter task per requirement, edit the titles and select what to
          create.
        </p>
        <p className="helper">
          This is a deterministic planning aid, not an AI effort estimate.
          Existing work is never overwritten.
        </p>
      </div>
      <button
        className="button"
        disabled={!canEdit || !p.versions.length || !uncovered.length || busy}
        onClick={() => {
          setDrafts(
            uncovered.map((r) => ({
              requirementId: r.id,
              title: ("Implement: " + r.text.replace(/^R\d+[.:]\s*/, "")).slice(
                0,
                200,
              ),
              selected: true,
            })),
          );
          setShow(!show);
        }}
      >
        Preview task plan
      </button>
      {show && canEdit && (
        <div className="task-plan-preview">
          {drafts.map((d, i) => (
            <div key={d.requirementId}>
              <label>
                <input
                  type="checkbox"
                  checked={d.selected}
                  onChange={(e) =>
                    setDrafts((ds) =>
                      ds.map((v, j) =>
                        j === i ? { ...v, selected: e.target.checked } : v,
                      ),
                    )
                  }
                />
                {d.requirementId}
              </label>
              <input
                aria-label={"Task title for " + d.requirementId}
                maxLength={200}
                value={d.title}
                onChange={(e) =>
                  setDrafts((ds) =>
                    ds.map((v, j) =>
                      j === i ? { ...v, title: e.target.value } : v,
                    ),
                  )
                }
              />
            </div>
          ))}
          <div className="button-row">
            <button
              className="button primary"
              disabled={
                busy ||
                !drafts.some((d) => d.selected) ||
                drafts.some((d) => d.selected && d.title.trim().length < 3)
              }
              onClick={() =>
                run(async () => {
                  update(
                    await api<Project>(
                      "/projects/" + p.id + "/task-plan",
                      "POST",
                      {
                        revision: p.revision,
                        items: drafts
                          .filter((d) => d.selected)
                          .map(({ requirementId, title }) => ({
                            requirementId,
                            title,
                          })),
                      },
                    ),
                  );
                  setShow(false);
                }, "Task plan saved with requirement links.")
              }
            >
              Create selected tasks
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => setShow(false)}
            >
              Cancel preview
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
