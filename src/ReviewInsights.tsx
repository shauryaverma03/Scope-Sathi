import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  money,
  type ChangeRequest,
  type Project,
  type Finding,
} from "../shared/model";
import {
  nextAction,
  evidenceLocation,
  requestQuote,
  reviewContext,
  wordDiff,
} from "../shared/review";

export function SourcePassage({
  source,
  quote,
  label,
}: {
  source: string;
  quote: string;
  label: string;
}) {
  const location = evidenceLocation(source, quote);
  const mark = useRef<HTMLElement>(null);
  if (!location)
    return (
      <p className="helper">{label}: exact passage not found in this source.</p>
    );
  return (
    <details
      className="source-locator"
      onToggle={(e) => {
        if (e.currentTarget.open)
          mark.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
      }}
    >
      <summary>
        {label} · lines {location.firstLine}–{location.lastLine}
        {location.occurrences > 1
          ? ` · first of ${location.occurrences} matches`
          : ""}
      </summary>
      <pre
        tabIndex={0}
        aria-label={`${label}, retained text with highlighted evidence`}
      >
        {source.slice(0, location.start)}
        <mark ref={mark}>{source.slice(location.start, location.end)}</mark>
        {source.slice(location.end)}
      </pre>
      <p className="helper">
        Line numbers refer to retained text, not PDF pages.
      </p>
    </details>
  );
}

export function WordingDiff({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  return (
    <p
      className="word-diff"
      aria-label="Wording changes: deletions struck through, additions underlined"
    >
      {wordDiff(before, after).map((part, i) =>
        part.kind === "removed" ? (
          <del key={i}>{part.text}</del>
        ) : part.kind === "added" ? (
          <ins key={i}>{part.text}</ins>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function FindingImpact({
  p,
  r,
  f,
  locate = false,
}: {
  p: Project;
  r: ChangeRequest;
  f: Finding;
  locate?: boolean;
}) {
  const c = reviewContext(p, r, f);
  const after = f.kind === "removal" ? "" : f.proposedText;
  return (
    <section
      className="finding-impact"
      aria-label={`Evidence and impact for ${f.title}`}
    >
      <p className="helper">
        Evidence:{" "}
        {c.requestEvidence && c.baselineEvidence
          ? "exact passages found"
          : "reference needs review"}
        . Text matching does not prove interpretation.
      </p>
      {locate && (
        <div className="source-locations">
          <SourcePassage
            label="Locate incoming evidence"
            source={r.text}
            quote={f.requestQuote}
          />
          {c.requirement && (
            <SourcePassage
              label={`Locate agreed wording in v${r.baselineVersion}`}
              source={c.requirement.text}
              quote={f.currentQuote}
            />
          )}
          {c.requirement && evidenceLocation(p.brief, c.requirement.quote) && (
            <SourcePassage
              label="Matching passage in original brief"
              source={p.brief}
              quote={c.requirement.quote}
            />
          )}
        </div>
      )}
      {["modification", "addition", "removal"].includes(f.kind) && (
        <>
          <h4>Proposed wording changes</h4>
          {!c.baselineAvailable && f.requirementId && (
            <p className="info warning">
              Historical baseline unavailable. Do not infer the original wording
              from today's scope.
            </p>
          )}
          <WordingDiff before={c.requirement?.text || ""} after={after} />
          {f.kind === "removal" && (
            <p>
              Proposed removal; earlier approved versions remain in history.
            </p>
          )}
        </>
      )}
      <p>
        <strong>Linked work:</strong>{" "}
        {c.tasks.length
          ? c.tasks.map((t) => t.title).join(" · ")
          : "No currently linked tasks identified."}
      </p>
      {!!c.missingTaskIds.length && (
        <p className="helper">
          Earlier task reference no longer available:{" "}
          {c.missingTaskIds.join(", ")}
        </p>
      )}
      <p className="helper">
        Explicit requirement links are included even when the model omits a
        task. Current task status is not a historical snapshot.
      </p>
    </section>
  );
}

export function Traceability({
  p,
  open,
}: {
  p: Project;
  open: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const requests = p.requests.filter((r) =>
    [r.title, r.text, ...r.analysis.findings.map((f) => f.requirementId)]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="panel traceability" aria-label="Change traceability">
      <div className="panel-heading">
        <div>
          <h2>Follow a change</h2>
          <p>
            Request → requirement → decision → linked work. Relationships come
            from saved records.
          </p>
        </div>
      </div>
      <div className="editor-inner">
        <label>
          Find a request or requirement
          <input
            value={query}
            maxLength={150}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, message or REQ ID"
          />
        </label>
      </div>
      {!requests.length ? (
        <p className="editor-inner">
          {p.requests.length
            ? "No matching changes."
            : "Submit a request to begin the decision trail."}
        </p>
      ) : (
        <div
          className="trace-scroll"
          tabIndex={0}
          role="region"
          aria-label="Traceability table"
        >
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Baseline / requirement</th>
                <th>Decision</th>
                <th>Round consent / quote</th>
                <th>Linked work today</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const quote = requestQuote(p, r);
                const tasks = [
                  ...new Map(
                    r.analysis.findings
                      .flatMap((f) => reviewContext(p, r, f).tasks)
                      .map((t) => [t.id, t]),
                  ).values(),
                ];
                return (
                  <tr key={r.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => open(r.id)}
                      >
                        {r.title}
                      </button>
                      <small>{r.engine}</small>
                    </td>
                    <td>
                      v{r.baselineVersion}
                      {r.resultVersion ? ` → v${r.resultVersion}` : ""}
                      <br />
                      {[
                        ...new Set(
                          r.analysis.findings.map(
                            (f) => f.requirementId || "Standalone finding",
                          ),
                        ),
                      ].join(", ")}
                    </td>
                    <td>
                      {r.status}
                      {r.decidedBy && <small>By {r.decidedBy}</small>}
                      {r.decidedAt && (
                        <small>
                          {new Date(r.decidedAt).toLocaleDateString()}
                        </small>
                      )}
                    </td>
                    <td>
                      {quote ? (
                        <>
                          {money(quote.amountMinor, quote.currency)} ·{" "}
                          {quote.state}
                          <small>
                            {quote.current
                              ? "Matches current round scope"
                              : "Scope changed; consent not current"}
                          </small>
                          <small>Round amount; not a payment receipt</small>
                        </>
                      ) : (
                        "No formal round quote"
                      )}
                    </td>
                    <td>
                      {tasks.length
                        ? tasks.map((t) => (
                            <div key={t.id}>
                              {t.title}{" "}
                              <small>{t.status.replaceAll("_", " ")}</small>
                            </div>
                          ))
                        : "No linked tasks"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function NextAction({
  p,
  email,
  navigate,
  open,
}: {
  p: Project;
  email?: string;
  navigate: (tab: string) => void;
  open: (id: string) => void;
}) {
  const action = nextAction(p, email);
  return (
    <section className="panel next-action">
      <div>
        <span className="eyebrow">NEXT USEFUL STEP</span>
        <h2>{action.title}</h2>
        <p>{action.detail}</p>
      </div>
      <button
        className="button primary"
        onClick={() => {
          navigate(action.tab);
          if (action.requestId) open(action.requestId);
        }}
      >
        Open next step →
      </button>
    </section>
  );
}

export function ChangeReport({
  p,
  r,
  includeNote = false,
}: {
  p: Project;
  r: ChangeRequest;
  includeNote?: boolean;
}) {
  const q = requestQuote(p, r);
  return (
    <article className="print-report">
      <header>
        <p className="eyebrow">SCOPESATHI · CLIENT CHANGE SUMMARY</p>
        <h1>{p.name}</h1>
        <h2>{r.title}</h2>
        <p>
          Request {r.id} · Baseline v{r.baselineVersion}
          {r.resultVersion ? ` → v${r.resultVersion}` : ""} ·{" "}
          {r.status.toUpperCase()}
        </p>
        <p>
          Prepared from saved project revision {p.revision}. Pending proposals
          are not approved commitments.
        </p>
      </header>
      <section>
        <h2>Client request</h2>
        <p className="report-text">{r.text}</p>
      </section>
      {r.analysis.findings.map((f) => (
        <section key={f.id}>
          <h2>{f.title}</h2>
          <p>
            {f.kind.replaceAll("_", " ")} ·{" "}
            {f.requirementId || "Standalone finding"}
          </p>
          <div className="evidence">
            <div>
              <strong>Agreed evidence</strong>
              <blockquote>
                {f.currentQuote || "No existing clause referenced."}
              </blockquote>
            </div>
            <div>
              <strong>Request evidence</strong>
              <blockquote>{f.requestQuote}</blockquote>
            </div>
          </div>
          <FindingImpact p={p} r={r} f={f} />
          {!!f.questions.length && (
            <>
              <h3>Unresolved questions</h3>
              <ul>
                {f.questions.map((question, i) => (
                  <li key={i}>{question}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      ))}
      <section>
        <h2>Decision and commercial status</h2>
        <p>
          {r.status === "pending"
            ? "Awaiting a reviewer decision."
            : `Decision recorded ${r.decidedAt || "(date unavailable)"} by ${r.decidedBy || "(reviewer unavailable)"}.`}
        </p>
        <p>
          Category: {r.category === "correction" ? "Correction" : "New scope"}.
          Round:{" "}
          {p.rounds.find((round) => round.id === (r.roundId || r.id))?.name ||
            r.title}
          .
        </p>
        {q ? (
          <p>
            Round quote: {money(q.amountMinor, q.currency)} · {q.state} ·{" "}
            {q.current
              ? "matches current round scope"
              : "scope has changed; not current consent"}
            . This amount covers the round, not necessarily this request alone.
            No payment receipt is implied.
          </p>
        ) : (
          <p>
            No formal round quote is recorded. This report is not an invoice or
            payment request.
          </p>
        )}
        {includeNote && r.reviewNote && (
          <>
            <h3>Decision note (explicitly included)</h3>
            <p className="report-text">{r.reviewNote}</p>
          </>
        )}
      </section>
      <footer>
        AI proposes; people decide. Exact source matches do not guarantee
        semantic accuracy. Linked task details show their current state. Preview
        this report before sharing.
      </footer>
    </article>
  );
}

export function ReportPreview({
  p,
  r,
  close,
}: {
  p: Project;
  r: ChangeRequest;
  close: () => void;
}) {
  const [includeNote, setIncludeNote] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("report-preview-open");
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.body.classList.remove("report-preview-open");
      previous?.focus();
    };
  }, []);
  const content = (
    <div
      className="report-overlay"
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Preview client change report"
      tabIndex={-1}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") close();
        if (e.key === "Tab") {
          const items =
            ref.current?.querySelectorAll<HTMLElement>("button, input");
          if (!items?.length) return;
          const first = items[0],
            last = items[items.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === ref.current)
          ) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div className="report-tools">
        <button className="button" onClick={close}>
          Close preview
        </button>
        <label>
          <input
            type="checkbox"
            checked={includeNote}
            onChange={(e) => setIncludeNote(e.target.checked)}
          />{" "}
          Include decision note
        </label>
        <button className="button primary" onClick={() => window.print()}>
          Print / save PDF
        </button>
        <p>
          Saved proposal only. Unsaved edits are excluded. Member lists, invoice
          references and internal activity logs are omitted.
        </p>
      </div>
      <ChangeReport p={p} r={r} includeNote={includeNote} />
    </div>
  );
  return typeof document === "undefined"
    ? content
    : createPortal(content, document.body);
}
