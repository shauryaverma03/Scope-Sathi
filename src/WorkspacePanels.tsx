import React, { useState } from "react";
import {
  FileText,
  ShieldCheck,
  Plus,
  RefreshCw,
  Download,
  Layers,
  ListTodo,
  Settings,
  GitPullRequest,
} from "lucide-react";
import { api, download } from "./api";
import {
  emptyIntake,
  revisionSummary,
  type Intake,
  type Project,
  type Config,
} from "../shared/model";
type Run = (fn: () => Promise<void>, message?: string) => Promise<void>;
const fields: [keyof Intake, string, number][] = [
  ["goal", "Project goal", 2000],
  ["users", "Intended users", 1500],
  ["features", "Required features", 4000],
  ["deliverables", "Deliverables", 1500],
  ["constraints", "Constraints", 1500],
  ["acceptance", "Acceptance criteria", 2000],
  ["excluded", "Excluded work", 1500],
];
export function IntakePanel({
  p,
  run,
  update,
  canEdit,
  useBrief,
}: {
  p: Project;
  run: Run;
  update: (p: Project) => void;
  canEdit: boolean;
  useBrief?: (s: string) => void;
}) {
  const [draft, setDraft] = useState<Intake>(() => ({
    ...emptyIntake(),
    ...p.intake,
  }));
  const locked = !!p.versions.length;
  const hasText = Object.values(draft).some((v) => v.trim());
  return (
    <section className="panel intake-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <FileText size={18} /> Client intake
          </h2>
          <p>
            {locked
              ? "Preserved with the initial agreement. Changes go through review."
              : "Capture the first agreement before analysing requirements."}
          </p>
        </div>
        <span className="badge">
          {locked ? "Baseline recorded" : "Draft intake"}
        </span>
      </div>
      <div className="editor-inner intake-fields">
        {fields.map(([key, label, max]) => (
          <label key={key}>
            {label}
            <textarea
              rows={key === "features" ? 4 : 2}
              maxLength={max}
              value={locked ? p.intake?.[key] || "" : draft[key]}
              disabled={locked || !canEdit}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [key]: e.target.value }))
              }
            />
          </label>
        ))}
      </div>
      {!locked && (
        <div className="editor-inner button-row">
          <button
            className="button"
            disabled={!canEdit}
            onClick={() =>
              run(
                async () =>
                  update(
                    await api<Project>(`/projects/${p.id}/intake`, "POST", {
                      revision: p.revision,
                      intake: draft,
                    }),
                  ),
                "Client intake saved.",
              )
            }
          >
            Save intake
          </button>
          <button
            className="button primary"
            disabled={!canEdit || !hasText}
            onClick={() =>
              run(async () => {
                update(
                  await api<Project>(`/projects/${p.id}/intake`, "POST", {
                    revision: p.revision,
                    intake: draft,
                  }),
                );
                useBrief?.(
                  fields
                    .filter(([k]) => draft[k].trim())
                    .map(([k, label]) => `${label}: ${draft[k].trim()}`)
                    .join("\n"),
                );
              }, "Client intake saved and added to the brief.")
            }
          >
            Use intake as the brief
          </button>
          <span className="helper">
            This saves the structured intake and fills the brief. Review it
            before extraction.
          </span>
        </div>
      )}
    </section>
  );
}
export function RevisionPanel({
  p,
  run,
  update,
  owner,
}: {
  p: Project;
  run: Run;
  update: (p: Project) => void;
  owner: boolean;
}) {
  const [limit, setLimit] = useState(
    p.revisionPolicy.includedRounds === null
      ? ""
      : String(p.revisionPolicy.includedRounds),
  );
  const [definition, setDefinition] = useState(p.revisionPolicy.definition);
  const s = revisionSummary(p);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Revision policy</h2>
          <p>
            One related round counts once after an approved new-scope change.
          </p>
        </div>
        <Layers size={19} />
      </div>
      <div className="editor-inner">
        <div className="revision-metrics">
          <strong>{s.used} rounds used</strong>
          <span>
            {s.remaining === null
              ? "No allowance limit"
              : `${s.remaining} remaining`}
          </span>
          <span>{s.beyond} beyond allowance</span>
        </div>
        <label>
          Included rounds (blank = no limit)
          <input
            type="number"
            min={0}
            max={1000}
            disabled={!owner}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </label>
        <label>
          Round definition
          <textarea
            rows={3}
            value={definition}
            maxLength={1000}
            disabled={!owner}
            onChange={(e) => setDefinition(e.target.value)}
          />
        </label>
        <p className="helper">
          Corrections to meet the original agreement, rejected requests,
          clarification and no-change decisions do not consume a round. Lowering
          the allowance does not erase previous decisions.
        </p>
        <button
          className="button primary"
          disabled={!owner || definition.trim().length < 20}
          onClick={() =>
            run(
              async () =>
                update(
                  await api<Project>(
                    `/projects/${p.id}/revision-policy`,
                    "POST",
                    {
                      revision: p.revision,
                      includedRounds: limit === "" ? null : Number(limit),
                      definition,
                    },
                  ),
                ),
              "Revision policy saved.",
            )
          }
        >
          Save revision policy
        </button>
      </div>
    </section>
  );
}
export function RequestSummary({ p }: { p: Project }) {
  const s = revisionSummary(p);
  return (
    <div className="request-metrics">
      {[
        ["Submitted requests", s.submitted],
        ["Approved scope changes", s.approvedChanges],
        ["Rejected", s.rejected],
        ["Clarification", s.clarification],
        ["Rounds used", s.used],
        ["Rounds remaining", s.remaining ?? "Unlimited"],
      ].map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
export function VersionComparison({ p }: { p: Project }) {
  const [before, setBefore] = useState(1),
    [after, setAfter] = useState(p.versions.length);
  const a = p.versions.find((v) => v.number === before),
    b = p.versions.find((v) => v.number === after);
  if (!a || !b) return null;
  const ids = [
    ...new Set([
      ...a.requirements.map((r) => r.id),
      ...b.requirements.map((r) => r.id),
    ]),
  ];
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Compare scope versions</h2>
          <p>Stable IDs make additions, edits and removals visible.</p>
        </div>
      </div>
      <div className="editor-inner">
        <div className="button-row">
          <label>
            Before
            <select
              value={before}
              onChange={(e) => setBefore(Number(e.target.value))}
            >
              {p.versions.map((v) => (
                <option key={v.number} value={v.number}>
                  Version {v.number}
                </option>
              ))}
            </select>
          </label>
          <label>
            After
            <select
              value={after}
              onChange={(e) => setAfter(Number(e.target.value))}
            >
              {p.versions.map((v) => (
                <option key={v.number} value={v.number}>
                  Version {v.number}
                </option>
              ))}
            </select>
          </label>
        </div>
        {ids.map((id) => {
          const old = a.requirements.find((r) => r.id === id),
            next = b.requirements.find((r) => r.id === id);
          const kind = !old
            ? "Added"
            : !next
              ? "Removed"
              : old.text !== next.text
                ? "Modified"
                : "Unchanged";
          return (
            <article className="version-diff" key={id}>
              <span className="badge">
                {kind} · {id}
              </span>
              <div>
                <p>{old?.text || "No previous requirement"}</p>
                <p>{next?.text || "Requirement removed"}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
export function ConnectionPanel({
  config,
  run,
  refresh,
}: {
  config: Config;
  run: Run;
  refresh: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<{
    items: {
      id: string;
      name: string;
      requirements: number;
      versions: number;
      requests: number;
      tasks: number;
      fingerprint: string;
      state: string;
    }[];
    message: string;
  }>();
  const db = config.database;
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Workspace connections</h2>
          <p>Connection status reflects actual verification.</p>
        </div>
        <Settings size={20} />
      </div>
      <div className="editor-inner">
        <span
          className={`badge ${db?.state === "connected" ? "green" : "amber"}`}
        >
          {db?.state === "connected"
            ? "Firestore connected"
            : config.storage === "local"
              ? "Local storage"
              : "Firestore needs setup"}
        </span>
        <p>{db?.message}</p>
        <p>
          <strong>Analysis:</strong>{" "}
          {config.ai === "manual"
            ? "Manual review. No live Gemini calls."
            : `${config.model} configured; availability is checked when a request runs.`}
        </p>
        <p>
          <strong>Authentication:</strong>{" "}
          {config.mode === "demo"
            ? "Local demo identity"
            : "Firebase Google sign-in"}
        </p>
        <div className="info">
          <div>
            <strong>Account and invitation emails</strong>
            <p>
              {config.email?.message ||
                "Email sender setup has not been verified."}
            </p>
            <p className="helper">
              Setup: docs/EMAIL_SETUP.md. Teammates can also view and accept
              invitations in the notification inbox.
            </p>
          </div>
        </div>
        <button className="button" onClick={() => run(refresh)}>
          <RefreshCw size={16} /> Check connection
        </button>
        {config.storage === "firestore" && db?.state !== "connected" && (
          <div className="info">
            <div>
              <strong>Connect this Mac to Firestore</strong>
              <ol>
                <li>
                  In Firebase Project settings, open Service accounts → Firebase
                  Admin SDK.
                </li>
                <li>
                  Save a private Admin JSON key securely outside this project.
                </li>
                <li>
                  Run the local setup script described in docs/FREE_SETUP.md,
                  providing only the file path.
                </li>
                <li>
                  Restart the backend and check the connection. Billing is not
                  required.
                </li>
              </ol>
              <p>
                Keep private keys out of chat and frontend code. Unsaved input
                stays in the form when a write fails.
              </p>
            </div>
          </div>
        )}
        {config.storage === "firestore" && db?.state === "connected" && (
          <div className="migration">
            <h3>Copy existing local projects</h3>
            <p>
              Preview your owned projects before copying. Cloud records are
              never overwritten and local originals are retained.
            </p>
            <button
              className="button"
              onClick={() =>
                run(async () => setPreview(await api("/migration")))
              }
            >
              Preview migration
            </button>
            {preview && (
              <>
                <p>{preview.message}</p>
                {preview.items.length === 0 && (
                  <p>No owned local projects found for this account.</p>
                )}
                {preview.items.map((item) => (
                  <article className="version-diff" key={item.id}>
                    <strong>{item.name}</strong>
                    <p>
                      {item.requirements} requirements · {item.versions}{" "}
                      versions · {item.requests} requests · {item.tasks} tasks
                    </p>
                    <span className="badge">
                      {item.state.replaceAll("_", " ")}
                    </span>
                    <button
                      className="button"
                      disabled={item.state !== "ready"}
                      onClick={() =>
                        run(async () => {
                          await api("/migration", "POST", {
                            id: item.id,
                            fingerprint: item.fingerprint,
                          });
                          setPreview(await api("/migration"));
                          await refresh();
                        }, "Firestore copy verified. Local original retained.")
                      }
                    >
                      Copy and verify
                    </button>
                  </article>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
const sections = {
  overview: {
    title: "Your project workspace",
    description:
      "Create a project to see agreed scope, pending decisions and the work that needs attention.",
    items: [
      "Capture your client’s first brief",
      "Approve a reviewed baseline",
      "Track requests and revision rounds",
    ],
    icon: Layers,
  },
  baseline: {
    title: "Start with the client’s agreement",
    description:
      "Save the project goal, users, deliverables and boundaries, then review the requirements extracted from a brief or document.",
    items: [
      "Structured client intake",
      "PDF and text brief upload",
      "Stable requirement IDs and source evidence",
    ],
    icon: FileText,
  },
  requests: {
    title: "Bring client changes into focus",
    description:
      "Create a project and approve its baseline before comparing an incoming request with the agreement.",
    items: [
      "Original vs proposed wording",
      "Multiple findings and clarification",
      "Related requests grouped into revision rounds",
    ],
    icon: GitPullRequest,
  },
  tasks: {
    title: "Make scope changes actionable",
    description:
      "Tasks link to specific requirements. Approved changes flag affected work for review.",
    items: [
      "Todo, in progress and done",
      "Requirement links",
      "Explicit review after a scope change",
    ],
    icon: ListTodo,
  },
  history: {
    title: "Every decision has a story",
    description:
      "After your first approval, this section will show who decided, why, and how the baseline changed.",
    items: [
      "Decisions and reviewer notes",
      "Preserved scope versions",
      "Exportable project history",
    ],
    icon: ShieldCheck,
  },
};
export function EmptyWorkspace({
  tab,
  create,
  config,
  email,
  name,
  run,
  refresh,
}: {
  tab: string;
  create: () => void;
  config: Config;
  email: string;
  name: string;
  run: Run;
  refresh: () => Promise<void>;
}) {
  if (tab === "settings")
    return (
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Your account</h2>
          </div>
          <div className="editor-inner">
            <h3>{name}</h3>
            <p>{email}</p>
            <p>
              Google manages your sign-in. Create a project to configure team
              access and revision policy.
            </p>
            <button className="button primary" onClick={create}>
              Create a project
            </button>
          </div>
        </section>
        <ConnectionPanel config={config} run={run} refresh={refresh} />
      </div>
    );
  const section = sections[tab as keyof typeof sections] || sections.overview;
  const Icon = section.icon;
  return (
    <section className={`panel section-start section-${tab}`}>
      <div className="start-symbol">
        <Icon size={36} />
      </div>
      <p className="eyebrow">
        {tab === "overview" ? "WELCOME TO SCOPESATHI" : tab.toUpperCase()}
      </p>
      <h2>{section.title}</h2>
      <p>{section.description}</p>
      <div className="start-options">
        {section.items.map((item, i) => (
          <article key={item}>
            <span>0{i + 1}</span>
            <h3>{item}</h3>
          </article>
        ))}
      </div>
      <button className="button primary" onClick={create}>
        <Plus size={17} /> Create your first project
      </button>
    </section>
  );
}
