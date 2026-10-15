import { z } from "zod";
import { RequirementSchema } from "../shared/model.js";
import { AppError } from "./domain.js";
export const Category = z.enum([
  "feature",
  "constraint",
  "acceptance",
  "exclusion",
]);
export const ExtractionSchema = z.object({
  requirements: z
    .array(RequirementSchema.extend({ category: Category }))
    .min(1)
    .max(30),
  summary: z.string().min(1).max(1200),
  questions: z.array(z.string().min(1).max(500)).max(8),
  context: z
    .array(
      z.object({
        quote: z.string().min(1).max(2000),
        reason: z.string().min(1).max(300),
      }),
    )
    .max(40),
});
export type Extraction = z.infer<typeof ExtractionSchema>;
type Line = { text: string; start: number; end: number };
const heading =
  /^(?:project context|project brief|requirements?(?: and boundaries)?|required features|features|functional requirements|acceptance(?: criteria| and revision policy)?|excluded work(?: and revisions)?|constraints|deliverables|intended users|project goal)$/i;
const label = /^(?:R(?:EQ)?[- ]?\d+[.:)]|\d+[.)]|[-*•])\s+/i;
const metadata =
  /^(?:goal|intended users|users|deliverables?|initial agreement|synthetic client|client labels|this document|this brief)\s*[:/-]/i;
function noise(text: string) {
  return (
    heading.test(text) ||
    /^[-–]*\s*(?:page\s*)?\d+\s*(?:of|\/)\s*\d+\s*[-–]*$/i.test(text) ||
    /^[A-Z][A-Z0-9 ]{2,}\s*\/\s*[^.!?]+$/.test(text) ||
    (/^[A-Z0-9 /-]{3,70}$/.test(text) &&
      !/\b(must|shall|should|required|excluded|cannot)\b/i.test(text)) ||
    /^SCOPESATHI\s*[/|]/i.test(text)
  );
}
function category(text: string, section: string): z.infer<typeof Category> {
  if (
    /^(?:customers|signed-in customers|users|administrators|store administrators)\b.*\b(?:must|shall|should)\b/i.test(
      text,
    ) &&
    /features|requirements/i.test(section)
  )
    return "feature";
  if (
    /\b(excluded|out of scope|not included)\b/i.test(text) ||
    /excluded/i.test(section)
  )
    return "exclusion";
  if (/^Acceptance:/i.test(text) || /acceptance/i.test(section))
    return "acceptance";
  if (/^Constraint:/i.test(text) || /constraints/i.test(section))
    return "constraint";
  return "feature";
}
export function cleanExtract(brief: string): Extraction {
  const lines: Line[] = [];
  let start = 0;
  for (const raw of brief.split("\n")) {
    const text = raw.trim();
    const offset = raw.indexOf(text);
    if (text)
      lines.push({ text, start: start + offset, end: start + raw.length });
    start += raw.length + 1;
  }
  const blocks: { start: number; end: number; section: string }[] = [];
  const context: Extraction["context"] = [];
  let active: { start: number; end: number; section: string } | undefined;
  let section = "";
  function flush() {
    if (active) {
      blocks.push(active);
      active = undefined;
    }
  }
  for (const line of lines) {
    if (noise(line.text)) {
      flush();
      if (heading.test(line.text)) section = line.text;
      if (context.length < 40 && line.text.length <= 2000)
        context.push({
          quote: brief.slice(line.start, line.end).trim(),
          reason:
            "Document heading, branding or page marker; retained as context.",
        });
      continue;
    }
    if (
      metadata.test(line.text) ||
      /^(?:Client labels|This document|This brief)\b/i.test(line.text) ||
      /^(?:One|Five|\d+)\s+(?:approved |included |free )?(?:new-scope )?revision rounds?\b/i.test(
        line.text,
      )
    ) {
      flush();
      // Wraps remain in this context block until the next paragraph/label.
      active = { start: line.start, end: line.end, section: "context" };
      continue;
    }
    const previous = active ? brief.slice(active.start, active.end).trim() : "";
    const gap = active ? brief.slice(active.end, line.start) : "";
    const newParagraph =
      label.test(line.text) ||
      /^(?:Acceptance|Constraint|Excluded work):/i.test(line.text) ||
      /\n\s*\n/.test(gap) ||
      (/[.!?]$/.test(previous) && active?.section !== "context");
    if (newParagraph) flush();
    if (!active) active = { start: line.start, end: line.end, section };
    else active.end = line.end;
  }
  flush();
  // A labelled feature section defines its own granularity. Supporting sections
  // remain visible as context rather than becoming extra feature cards.
  const explicitFeatures = blocks.filter(
    (b) =>
      /^required features$/i.test(b.section) &&
      /^R\d+[.:)]\s/i.test(brief.slice(b.start, b.end).trim()),
  );
  const numberedFeatures = explicitFeatures.length >= 2;
  const requirements: Extraction["requirements"] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const raw = brief.slice(block.start, block.end).trim();
    if (
      block.section === "context" ||
      (numberedFeatures && !explicitFeatures.includes(block))
    ) {
      if (context.length < 40 && raw.length <= 2000)
        context.push({
          quote: raw,
          reason:
            "Supporting agreement: background, acceptance, exclusions or revision policy. Review alongside the numbered features.",
        });
      continue;
    }
    // Unlabelled document titles are context, not actionable clauses.
    if (
      !label.test(raw) &&
      !/[.!?:]/.test(raw) &&
      raw.split(/\s+/).length < 8 &&
      !/^(?:use|support|allow|enable|provide|create|add|remove|display|send|prevent|require|no|do not)\b/i.test(
        raw,
      )
    ) {
      if (context.length < 40)
        context.push({
          quote: raw,
          reason: "Short document title or heading.",
        });
      continue;
    }
    let offset = 0;
    while (offset < raw.length) {
      let end = Math.min(offset + 2000, raw.length);
      if (end < raw.length) {
        const space = raw.lastIndexOf(" ", end);
        if (space > offset) end = space;
      }
      const quote = raw.slice(offset, end).trim();
      offset = end;
      if (!quote) continue;
      const text = quote.replace(label, "").replace(/\s+/g, " ").trim();
      const key = text.toLowerCase();
      if (seen.has(key)) {
        if (context.length < 40)
          context.push({
            quote,
            reason: "Duplicate clause; retained once in requirements.",
          });
        continue;
      }
      seen.add(key);
      requirements.push({
        id: "REQ-" + String(requirements.length + 1).padStart(3, "0"),
        text,
        quote,
        category: category(text, block.section),
      });
    }
  }
  if (!requirements.length)
    throw new AppError(
      400,
      "No actionable clauses found. Add required features or use Gemini for semantic extraction. The original brief is unchanged.",
    );
  if (requirements.length > 30)
    throw new AppError(
      400,
      "This brief has more than 30 requirement sections. Combine related clauses; the original brief is unchanged.",
    );
  return {
    requirements,
    summary:
      "Local document cleanup grouped wrapped clauses and separated headings/background. No AI analysis was performed; review coverage and wording.",
    questions: [
      "Are all required features, constraints and exclusions represented? Confirm before approval.",
    ],
    context,
  };
}
export function validateExtraction(brief: string, data: Extraction) {
  const grouped =
    /^required features\s*$/im.test(brief) && /^R\d+[.:)]\s/im.test(brief)
      ? cleanExtract(brief)
      : undefined;
  const numbered =
    grouped &&
    grouped.requirements.length >= 2 &&
    grouped.requirements.every((r) => /^R\d+[.:)]\s/i.test(r.quote));
  if (numbered) {
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    const matches = data.requirements.map((r) =>
      grouped.requirements.findIndex(
        (g) => normalize(g.quote) === normalize(r.quote),
      ),
    );
    if (
      data.requirements.length !== grouped.requirements.length ||
      matches.some((i) => i < 0) ||
      new Set(matches).size !== matches.length
    )
      throw new AppError(
        422,
        "The analysis did not preserve the numbered feature clauses. Retry; no baseline was changed.",
      );
  }
  if (
    data.requirements.some((r) => noise(r.quote.trim()) || noise(r.text.trim()))
  )
    throw new AppError(
      422,
      "Extraction treated document metadata as requirements. Retry or review locally; no baseline was changed.",
    );
  const quotes = [
    ...data.requirements.map((r) => r.quote),
    ...data.context.map((c) => c.quote),
  ];
  if (quotes.some((q) => !brief.includes(q.trim())))
    throw new AppError(
      422,
      "Extraction returned an unverified source passage. No baseline was changed.",
    );
  if (
    new Set(
      data.requirements.map((r) =>
        r.text.toLowerCase().replace(/\s+/g, " ").trim(),
      ),
    ).size !== data.requirements.length
  )
    throw new AppError(
      422,
      "Extraction returned duplicate requirements. Review or retry; no baseline was changed.",
    );
}
