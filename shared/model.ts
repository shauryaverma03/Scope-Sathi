import { z } from "zod";
export const text = z.string().trim().min(1).max(2000);
export const RequirementSchema = z.object({
  id: z.string().min(1).max(60),
  category: z
    .enum(["feature", "constraint", "acceptance", "exclusion"])
    .optional(),
  text,
  quote: text,
});
export type Requirement = z.infer<typeof RequirementSchema>;
export const FindingSchema = z.object({
  id: z.string().min(1).max(60),
  kind: z.enum([
    "addition",
    "modification",
    "removal",
    "clarification",
    "no_change",
  ]),
  title: z.string().min(1).max(150),
  requirementId: z.string().max(60),
  currentQuote: z.string().max(2000),
  requestQuote: text,
  proposedText: z.string().max(2000),
  reason: text,
  questions: z.array(z.string().min(1).max(500)).max(8),
  taskIds: z.array(z.string().max(60)).max(15),
});
export const AnalysisSchema = z.object({
  summary: z.string().min(1).max(1500),
  findings: z.array(FindingSchema).min(1).max(15),
});
export type Finding = z.infer<typeof FindingSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export const IntakeSchema = z.object({
  goal: z.string().trim().max(2000).default(""),
  users: z.string().trim().max(1500).default(""),
  features: z.string().trim().max(4000).default(""),
  deliverables: z.string().trim().max(1500).default(""),
  constraints: z.string().trim().max(1500).default(""),
  acceptance: z.string().trim().max(2000).default(""),
  excluded: z.string().trim().max(1500).default(""),
});
export type Intake = z.infer<typeof IntakeSchema>;
export const emptyIntake = (): Intake => IntakeSchema.parse({});
export type RevisionRound = {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
};
export type RevisionPolicy = {
  currency?: "INR" | "USD" | "EUR" | "GBP";
  rateMinor?: number;
  clientEmail?: string;
  includedRounds: number | null;
  definition: string;
};
export const defaultPolicy = (): RevisionPolicy => ({
  includedRounds: null,
  definition:
    "A round groups related client requests. It counts once when a new-scope change in that round is approved. Corrections, rejected requests, clarification and no-change decisions do not count.",
});
export function isScopeChange(r: ChangeRequest) {
  return r.analysis.findings.some((f) =>
    ["addition", "modification", "removal"].includes(f.kind),
  );
}
export function revisionSummary(p: Project) {
  const approved = p.requests.filter(
    (r) => r.status === "approved" && isScopeChange(r),
  );
  const roundIds = [
    ...new Set(
      approved
        .filter((r) => (r.category || "new_scope") === "new_scope")
        .map((r) => r.roundId || r.id),
    ),
  ];
  const limit = p.revisionPolicy?.includedRounds ?? null;
  return {
    submitted: p.requests.length,
    approvedChanges: approved.length,
    rejected: p.requests.filter((r) => r.status === "rejected").length,
    clarification: p.requests.filter((r) => r.status === "clarification")
      .length,
    used: roundIds.length,
    remaining: limit === null ? null : Math.max(0, limit - roundIds.length),
    beyond: limit === null ? 0 : Math.max(0, roundIds.length - limit),
    roundIds,
  };
}
export function needsSeparateAgreement(
  p: Project,
  roundId: string,
  category: string,
  findings: Finding[],
) {
  const summary = revisionSummary(p);
  return (
    category === "new_scope" &&
    findings.some((f) =>
      ["addition", "modification", "removal"].includes(f.kind),
    ) &&
    p.revisionPolicy?.includedRounds !== null &&
    p.revisionPolicy?.includedRounds !== undefined &&
    summary.used >= p.revisionPolicy.includedRounds &&
    !summary.roundIds.includes(roundId)
  );
}
export function normalizeProject(p: Project): Project {
  p.intake ||= emptyIntake();
  p.revisionPolicy ||= defaultPolicy();
  p.rounds ||= [];
  p.quotes ||= [];
  p.invitations ||= [];
  for (const r of p.requests) {
    r.category ||= "new_scope";
    r.roundId ||= r.id;
    if (!p.rounds.some((q) => q.id === r.roundId))
      p.rounds.push({
        id: r.roundId,
        name: r.title,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
      });
  }
  return p;
}
export type Role = "reviewer" | "editor" | "viewer";
export type Actor = { uid: string; email: string; name: string };
export type Task = {
  description?: string;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  id: string;
  title: string;
  requirementIds: string[];
  status: "todo" | "in_progress" | "done" | "needs_review";
};
export type Version = {
  number: number;
  requirements: Requirement[];
  approvedAt: string;
  approvedBy: string;
  reason: string;
};
export type ChangeRequest = {
  id: string;
  title: string;
  source: string;
  text: string;
  createdAt: string;
  createdBy: string;
  baselineVersion: number;
  analysis: Analysis;
  engine: string;
  status: "pending" | "approved" | "rejected" | "clarification";
  category?: "new_scope" | "correction";
  roundId?: string;
  separateAgreement?: string;
  reviewNote?: string;
  decidedBy?: string;
  decidedAt?: string;
};
export type Event = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
};
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
export type Project = {
  id: string;
  name: string;
  client: string;
  description: string;
  ownerId: string;
  ownerEmail: string;
  memberEmails: string[];
  members: Record<string, Role>;
  revision: number;
  createdAt: string;
  intake: Intake;
  revisionPolicy: RevisionPolicy;
  rounds: RevisionRound[];
  quotes?: RoundQuote[];
  invitations: Invitation[];
  brief: string;
  requirements: Requirement[];
  versions: Version[];
  requests: ChangeRequest[];
  tasks: Task[];
  events: Event[];
};
export type Config = {
  mode: "demo" | "firebase" | "google";
  storage: "local" | "firestore";
  ai: "manual" | "gemini" | "vertex";
  model: string;
  email?: { configured: boolean; message: string };
  database?: {
    state: "local" | "checking" | "connected" | "error";
    message: string;
  };
  firebase?: Record<string, string>;
};
export const SAMPLE_BRIEF = `Customers must sign in with an email address and password before checkout.\nThe store must support a product catalogue with search and category filters.\nSigned-in customers must be able to view their order history.\nPayments must be processed through the payment provider selected by the client.\nThe admin must be able to update product availability and prices.`;
export const SAMPLE_REQUEST =
  "Can customers also check out without creating an account? They should receive an email confirmation and a link to track their order.";

export type RoundQuote = {
  id: string;
  roundId: string;
  currency: string;
  amountMinor: number;
  clientEmail: string;
  scope: string;
  requestIds: string[];
  state: "proposed" | "accepted" | "declined" | "superseded";
  createdAt: string;
  createdBy: string;
  decidedAt?: string;
  decidedBy?: string;
  invoiceReference?: string;
  invoicedAt?: string;
  acceptedAt?: string;
};
export function roundScope(p: Project, roundId: string) {
  return JSON.stringify(
    p.requests
      .filter(
        (r) =>
          (r.roundId || r.id) === roundId &&
          (r.status === "pending" || r.status === "approved") &&
          (r.category || "new_scope") === "new_scope" &&
          isScopeChange(r),
      )
      .map((r) => ({
        id: r.id,
        text: r.text,
        findings: r.analysis.findings
          .map((f) => ({
            id: f.id,
            kind: f.kind,
            title: f.title,
            requirementId: f.requirementId,
            currentQuote: f.currentQuote,
            requestQuote: f.requestQuote,
            proposedText: f.proposedText,
            reason: f.reason,
            questions: [...f.questions].sort(),
            taskIds: [...f.taskIds].sort(),
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}
export function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
    minor / 100,
  );
}

export type ExtractionResult = {
  requirements: Requirement[];
  summary: string;
  questions: string[];
  context: { quote: string; reason: string }[];
  engine: string;
};
