import {
  money,
  roundScope,
  type Project,
  type ChangeRequest,
  type Finding,
} from "./model";

/** Exact text locations in retained text; these are not PDF page coordinates. */
export function evidenceLocation(source: string, quote: string) {
  const text = quote.trim();
  if (!text) return undefined;
  const start = source.indexOf(text);
  if (start < 0) return undefined;
  const end = start + text.length;
  let occurrences = 0,
    offset = 0;
  while ((offset = source.indexOf(text, offset)) !== -1) {
    occurrences++;
    offset += text.length;
  }
  return {
    start,
    end,
    firstLine: source.slice(0, start).split("\n").length,
    lastLine: source.slice(0, end).split("\n").length,
    occurrences,
  };
}

/** Historical reviews must use their own baseline, never today's amended wording. */
export function reviewContext(p: Project, r: ChangeRequest, f: Finding) {
  const baseline = p.versions.find((v) => v.number === r.baselineVersion);
  const requirement = baseline?.requirements.find(
    (q) => q.id === f.requirementId,
  );
  const changes = ["addition", "modification", "removal"].includes(f.kind);
  const tasks = changes
    ? p.tasks.filter(
        (t) =>
          f.taskIds.includes(t.id) ||
          (!!f.requirementId && t.requirementIds.includes(f.requirementId)),
      )
    : [];
  return {
    requirement,
    baselineAvailable: !!baseline,
    requestEvidence:
      !!f.requestQuote.trim() && r.text.includes(f.requestQuote.trim()),
    baselineEvidence: f.requirementId
      ? !!requirement &&
        !!f.currentQuote.trim() &&
        requirement.text.includes(f.currentQuote.trim())
      : !f.currentQuote.trim(),
    tasks,
    missingTaskIds: f.taskIds.filter((id) => !p.tasks.some((t) => t.id === id)),
  };
}

/** Bounded word diff; long passages fall back to a complete replacement. */
export function wordDiff(before: string, after: string) {
  const a = before.match(/\s+|\S+/g) || [],
    b = after.match(/\s+|\S+/g) || [];
  type Piece = { kind: "same" | "removed" | "added"; text: string };
  const parts: Piece[] = [];
  const add = (kind: Piece["kind"], text: string) => {
    if (!text) return;
    if (parts.at(-1)?.kind === kind) parts.at(-1)!.text += text;
    else parts.push({ kind, text });
  };
  if (a.length > 400 || b.length > 400) {
    if (before === after) add("same", before);
    else {
      add("removed", before);
      add("added", after);
    }
    return parts;
  }
  const rows = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      rows[i][j] =
        a[i] === b[j]
          ? rows[i + 1][j + 1] + 1
          : Math.max(rows[i + 1][j], rows[i][j + 1]);
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      add("same", a[i++]);
      j++;
    } else if (
      i < a.length &&
      (j === b.length || rows[i + 1][j] >= rows[i][j + 1])
    )
      add("removed", a[i++]);
    else add("added", b[j++]);
  }
  return parts;
}

export function requestQuote(p: Project, r: ChangeRequest) {
  const q = [...(p.quotes || [])]
    .reverse()
    .find((q) => q.roundId === (r.roundId || r.id) && q.state !== "superseded");
  return q
    ? { ...q, current: q.scope === roundScope(p, r.roundId || r.id) }
    : undefined;
}

export function nextAction(p: Project, actorEmail?: string) {
  const email = actorEmail?.toLowerCase();
  const clientQuote =
    email &&
    p.members[email] &&
    [...(p.quotes || [])]
      .reverse()
      .find(
        (q) =>
          q.clientEmail === email &&
          q.state === "proposed" &&
          q.scope === roundScope(p, q.roundId),
      );
  if (clientQuote)
    return {
      tab: "settings",
      title: "Review your extra-work estimate",
      detail: `${money(clientQuote.amountMinor, clientQuote.currency)} for the quoted round. Open Revision allowance to review the scope and accept or decline. This does not approve the scope or collect payment.`,
    };
  if (email && p.members[email] === "viewer")
    return {
      tab: "history",
      title: "Follow your project's decisions",
      detail:
        "Your viewer access lets you inspect approved versions, evidence and decisions. Only the designated client can respond to their quote.",
    };
  if (!p.versions.length)
    return {
      tab: "baseline",
      title: "Establish your agreement",
      detail: "Review the brief and approve baseline version 1.",
    };
  const pending = p.requests.filter((r) => r.status === "pending");
  const stale = pending.find((r) => r.baselineVersion !== p.versions.length);
  if (stale)
    return {
      tab: "requests",
      requestId: stale.id,
      title: "Refresh a stale comparison",
      detail:
        stale.title + " uses an older baseline. Reanalyse before approval.",
    };
  const questions = pending.find((r) =>
    r.analysis.findings.some(
      (f) => f.questions.length || f.kind === "clarification",
    ),
  );
  if (questions)
    return {
      tab: "requests",
      requestId: questions.id,
      title: "Resolve an open question",
      detail:
        questions.title + " needs clarification before a reviewer can approve.",
    };
  const consent = [...(p.quotes || [])]
    .reverse()
    .find(
      (q) => q.state === "proposed" && q.scope === roundScope(p, q.roundId),
    );
  if (consent)
    return {
      tab: "settings",
      title: "Client response needed",
      detail:
        "The designated client can accept or decline the current extra-round quote in Revision allowance.",
    };
  if (pending.length)
    return {
      tab: "requests",
      requestId: pending[0].id,
      title: "Review the next proposal",
      detail:
        pending[0].title +
        ". Inspect evidence, impact and any required client consent.",
    };
  const tasks = p.tasks.filter((t) => t.status === "needs_review");
  if (tasks.length)
    return {
      tab: "tasks",
      title: "Review affected work",
      detail: `${tasks.length} task(s) need a review note after approved changes.`,
    };
  return {
    tab: "requests",
    title: "Ready for the next client request",
    detail:
      "Your current agreement is preserved. New requests start as proposals.",
  };
}
