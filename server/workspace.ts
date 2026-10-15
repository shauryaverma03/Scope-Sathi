import { randomUUID } from "node:crypto";
import { access, addRequest, AppError, event, now } from "./domain.js";
import type { Actor, Project } from "../shared/model.js";
export function proposeAmendment(
  p: Project,
  a: Actor,
  v: {
    requirementId: string;
    kind: "modification" | "removal";
    proposedText: string;
    message: string;
    category: "correction" | "new_scope";
  },
) {
  access(p, a, true);
  const requirement = p.requirements.find((r) => r.id === v.requirementId);
  if (!requirement) throw new AppError(404, "Approved requirement not found.");
  if (
    v.kind === "modification" &&
    v.proposedText.trim() === requirement.text.trim()
  )
    throw new AppError(400, "The proposed wording is unchanged.");
  const id = randomUUID(),
    roundId = randomUUID(),
    createdAt = now();
  const request = {
    id,
    roundId,
    title: (v.kind === "removal" ? "Remove " : "Edit ") + requirement.id,
    source: "Reviewed requirement amendment",
    text: v.message,
    category: v.category,
    createdAt,
    createdBy: a.email,
    baselineVersion: p.versions.length,
    engine: "Explicit amendment · no AI calls",
    status: "pending" as const,
    analysis: {
      summary:
        "A team member proposed an explicit amendment. The approved baseline remains unchanged until reviewer approval.",
      findings: [
        {
          id: "F-" + randomUUID().slice(0, 8),
          kind: v.kind,
          title: (v.kind === "removal" ? "Remove " : "Amend ") + requirement.id,
          requirementId: requirement.id,
          currentQuote: requirement.text,
          requestQuote: v.message,
          proposedText: v.kind === "removal" ? "" : v.proposedText,
          reason:
            "Review the supplied amendment explanation and exact source before deciding.",
          questions: [],
          taskIds: p.tasks
            .filter((t) => t.requirementIds.includes(requirement.id))
            .map((t) => t.id)
            .slice(0, 15),
        },
      ],
    },
  };
  addRequest(p, a, request);
  p.rounds.push({
    id: roundId,
    name: request.title,
    createdAt,
    createdBy: a.email,
  });
  event(
    p,
    a,
    "Requirement amendment proposed",
    requirement.id + "; " + v.category + ". Previous versions preserved.",
  );
}
export function draftTasks(
  p: Project,
  a: Actor,
  items: { title: string; requirementId: string }[],
) {
  access(p, a, true);
  if (!p.versions.length)
    throw new AppError(409, "Approve a baseline before planning tasks.");
  if (new Set(items.map((i) => i.requirementId)).size !== items.length)
    throw new AppError(400, "Select each requirement once.");
  for (const item of items) {
    if (!p.requirements.some((r) => r.id === item.requirementId))
      throw new AppError(400, "Unknown requirement.");
    if (p.tasks.some((t) => t.requirementIds.includes(item.requirementId)))
      throw new AppError(
        409,
        "A selected requirement already has linked work. Refresh the task preview.",
      );
  }
  for (const item of items)
    p.tasks.push({
      id: "TASK-" + randomUUID().slice(0, 8),
      title: item.title,
      requirementIds: [item.requirementId],
      status: "todo",
    });
  event(
    p,
    a,
    "Task plan created",
    items.length +
      " requirement-linked tasks created from a reviewed preview. No AI estimates.",
  );
}
