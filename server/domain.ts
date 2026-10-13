import {
  emptyIntake,
  defaultPolicy,
  needsSeparateAgreement,
  type Intake,
} from "../shared/model.js";
import { randomUUID } from "node:crypto";
import type {
  Actor,
  Project,
  Requirement,
  Analysis,
  Finding,
  ChangeRequest,
  Role,
} from "../shared/model.js";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const ensure = (
  condition: unknown,
  status: number,
  message: string,
): asserts condition => {
  if (!condition) throw new AppError(status, message);
};
export const now = () => new Date().toISOString();
export function role(p: Project, a: Actor): Role | undefined {
  return p.ownerId === a.uid ? "reviewer" : p.members[a.email.toLowerCase()];
}
export function access(p: Project, a: Actor, write = false, review = false) {
  const r = role(p, a);
  if (!r) throw new AppError(404, "Project not found.");
  if ((write && r === "viewer") || (review && r !== "reviewer"))
    throw new AppError(403, "Your project role does not allow this action.");
}
export function event(p: Project, a: Actor, action: string, detail: string) {
  p.events.unshift({
    id: randomUUID(),
    at: now(),
    actor: a.name || a.email,
    action,
    detail,
  });
}
export function createProject(
  a: Actor,
  name: string,
  client: string,
  description: string,
): Project {
  return {
    id: randomUUID(),
    name,
    client,
    description,
    ownerId: a.uid,
    ownerEmail: a.email,
    memberEmails: [a.email],
    members: { [a.email]: "reviewer" },
    revision: 0,
    createdAt: now(),
    intake: emptyIntake(),
    revisionPolicy: defaultPolicy(),
    rounds: [],
    invitations: [],
    brief: "",
    requirements: [],
    versions: [],
    requests: [],
    tasks: [],
    events: [],
  };
}
const includes = (hay: string, needle: string) =>
  hay.includes(needle.trim()) && needle.trim().length > 0;
export function validateRequirements(brief: string, reqs: Requirement[]) {
  if (!reqs.length) throw new AppError(400, "Add at least one requirement.");
  if (new Set(reqs.map((r) => r.id)).size !== reqs.length)
    throw new AppError(400, "Requirement IDs must be unique.");
  for (const r of reqs)
    if (!includes(brief, r.quote))
      throw new AppError(
        422,
        `The source quote for ${r.id} was not found in the brief. Please use an exact passage.`,
      );
}
export function validateAnalysis(
  p: Project,
  input: string,
  analysis: Analysis,
) {
  if (
    new Set(analysis.findings.map((f) => f.id)).size !==
    analysis.findings.length
  )
    throw new AppError(
      422,
      "Analysis contained duplicate finding IDs. Please try again.",
    );
  const changed = new Set<string>();
  for (const f of analysis.findings) {
    if (!includes(input, f.requestQuote))
      throw new AppError(
        422,
        "An AI quote could not be verified in the new request. Please try again.",
      );
    if (!f.requirementId && f.currentQuote.trim())
      throw new AppError(
        422,
        "A baseline quote must reference an approved requirement.",
      );
    const req = p.requirements.find((r) => r.id === f.requirementId);
    if (f.requirementId && (!req || !includes(req.text, f.currentQuote)))
      throw new AppError(
        422,
        "An AI baseline reference could not be verified. Please try again.",
      );
    if (["modification", "removal"].includes(f.kind) && !req)
      throw new AppError(
        422,
        "A changed requirement must reference the approved baseline.",
      );
    if (["addition", "modification"].includes(f.kind) && !f.proposedText.trim())
      throw new AppError(422, "A proposed requirement is missing.");
    if (f.taskIds.some((id) => !p.tasks.some((t) => t.id === id)))
      throw new AppError(422, "An AI task reference could not be verified.");
    if (["modification", "removal"].includes(f.kind)) {
      if (changed.has(f.requirementId))
        throw new AppError(
          422,
          "Multiple changes target the same requirement. Split the request for review.",
        );
      changed.add(f.requirementId);
    }
  }
}
export function approveBaseline(
  p: Project,
  a: Actor,
  brief: string,
  requirements: Requirement[],
) {
  access(p, a, true, true);
  if (p.versions.length)
    throw new AppError(
      409,
      "An approved baseline already exists. Submit a change request instead.",
    );
  validateRequirements(brief, requirements);
  p.brief = brief;
  p.requirements = structuredClone(requirements);
  p.versions.push({
    number: 1,
    requirements: structuredClone(requirements),
    approvedAt: now(),
    approvedBy: a.email,
    reason: "Initial baseline approved",
  });
  event(
    p,
    a,
    "Baseline approved",
    `${requirements.length} requirements are now the agreed scope.`,
  );
}
export function addRequest(p: Project, a: Actor, request: ChangeRequest) {
  access(p, a, true);
  if (!p.versions.length) throw new AppError(409, "Approve a baseline first.");
  if (request.baselineVersion !== p.versions.length)
    throw new AppError(
      409,
      "The baseline changed during analysis. Run analysis again.",
    );
  validateAnalysis(p, request.text, request.analysis);
  p.requests.unshift(request);
  event(p, a, "Request analysed", request.title);
}
export function saveProposal(
  p: Project,
  a: Actor,
  id: string,
  findings: Finding[],
) {
  access(p, a, true, true);
  const request = p.requests.find((r) => r.id === id);
  if (!request) throw new AppError(404, "Request not found.");
  if (request.status !== "pending")
    throw new AppError(409, "This request already has a decision.");
  if (request.baselineVersion !== p.versions.length)
    throw new AppError(
      409,
      "Reanalyse against the current baseline before editing.",
    );
  validateAnalysis(p, request.text, { ...request.analysis, findings });
  request.analysis.findings = structuredClone(findings);
  event(p, a, "Proposal edited", request.title);
}
export function decide(
  p: Project,
  a: Actor,
  id: string,
  decision: "approved" | "rejected" | "clarification",
  note: string,
  findings?: Finding[],
  separateAgreement = "",
) {
  access(p, a, true, true);
  const r = p.requests.find((r) => r.id === id);
  if (!r) throw new AppError(404, "Request not found.");
  if (r.status !== "pending")
    throw new AppError(409, "This request already has a decision.");
  if (decision === "approved") {
    if (r.baselineVersion !== p.versions.length)
      throw new AppError(
        409,
        "This analysis uses an older baseline. Reanalyse the request before approving.",
      );
    if (findings) {
      if (
        findings.length !== r.analysis.findings.length ||
        findings.some((f, i) => f.id !== r.analysis.findings[i].id)
      )
        throw new AppError(400, "Finding IDs cannot be changed.");
      r.analysis.findings = findings;
    }
    validateAnalysis(p, r.text, r.analysis);
    if (
      r.analysis.findings.some(
        (f) => f.kind === "clarification" || f.questions.length > 0,
      )
    )
      throw new AppError(
        409,
        "Resolve clarification findings and open questions before approving. Edit the proposal, or request clarification.",
      );
    let updated = structuredClone(p.requirements);
    const affected = new Set<string>();
    for (const f of r.analysis.findings) {
      if (f.kind === "addition")
        updated.push({
          id: `REQ-${randomUUID().slice(0, 8)}`,
          text: f.proposedText,
          quote: f.requestQuote,
        });
      if (f.kind === "modification")
        updated = updated.map((q) =>
          q.id === f.requirementId
            ? { ...q, text: f.proposedText, quote: f.requestQuote }
            : q,
        );
      if (f.kind === "removal")
        updated = updated.filter((q) => q.id !== f.requirementId);
      if (["addition", "modification", "removal"].includes(f.kind)) {
        for (const id of f.taskIds) affected.add(id);
        if (f.requirementId)
          for (const task of p.tasks)
            if (task.requirementIds.includes(f.requirementId))
              affected.add(task.id);
      }
    }
    if (!updated.length)
      throw new AppError(400, "A baseline must keep at least one requirement.");
    const changed = r.analysis.findings.some((f) =>
      ["addition", "modification", "removal"].includes(f.kind),
    );
    if (changed) {
      if (
        needsSeparateAgreement(
          p,
          r.roundId || r.id,
          r.category || "new_scope",
          r.analysis.findings,
        ) &&
        separateAgreement.trim().length < 10
      )
        throw new AppError(
          409,
          "The included revision allowance is exhausted. Record the separate agreement before approving this round.",
        );
      if (separateAgreement.trim())
        r.separateAgreement = separateAgreement.trim();
      p.requirements = updated;
      p.versions.push({
        number: p.versions.length + 1,
        requirements: structuredClone(updated),
        approvedAt: now(),
        approvedBy: a.email,
        reason: note,
      });
      for (const t of p.tasks)
        if (affected.has(t.id)) t.status = "needs_review";
    }
  }
  r.status = decision;
  r.reviewNote = note;
  r.decidedBy = a.email;
  r.decidedAt = now();
  event(p, a, `Request ${decision}`, `${r.title} — ${note}`);
}

export function saveIntake(p: Project, a: Actor, intake: Intake) {
  access(p, a, true);
  if (p.versions.length)
    throw new AppError(
      409,
      "The intake is preserved with the approved baseline. Submit a change request instead.",
    );
  p.intake = structuredClone(intake);
  event(
    p,
    a,
    "Client intake saved",
    "Project goal, users, deliverables and boundaries recorded.",
  );
}
export function setRevisionPolicy(
  p: Project,
  a: Actor,
  includedRounds: number | null,
  definition: string,
) {
  if (p.ownerId !== a.uid)
    throw new AppError(
      403,
      "Only the owner can change the revision allowance.",
    );
  p.revisionPolicy = { includedRounds, definition };
  event(
    p,
    a,
    "Revision allowance updated",
    `${includedRounds === null ? "No limit" : includedRounds + " included rounds"}. ${definition}`,
  );
}
