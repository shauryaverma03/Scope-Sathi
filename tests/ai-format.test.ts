import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { AnalysisSchema } from "../shared/model";
import { providerSchema, sourceQuote } from "../server/ai-format";

test("provider schema preserves types, required fields and enums; Zod still enforces bounds", () => {
  const schema = providerSchema(z.toJSONSchema(AnalysisSchema));
  assert.equal(schema.type, "object");
  assert.ok(schema.required.includes("findings"));
  assert.ok(
    schema.properties.findings.items.properties.kind.enum.includes(
      "modification",
    ),
  );
  assert.equal(schema.properties.findings.maxItems, undefined);
  assert.equal(
    schema.properties.findings.items.properties.title.maxLength,
    undefined,
  );
  assert.equal(
    AnalysisSchema.safeParse({ summary: "", findings: [] }).success,
    false,
  );
});

test("PDF quote recovery restores exact source whitespace but rejects changed evidence", () => {
  const source =
    "R1. Customers must sign in before\ncheckout. Guest checkout is not\nincluded.";
  const quote = source.replace(/\s+/g, " ");
  assert.equal(sourceQuote(source, quote), source);
  const invented = "Customers may use guest checkout.";
  assert.equal(sourceQuote(source, invented), invented);
  assert.equal(source.includes(sourceQuote(source, invented)), false);
  assert.equal(
    sourceQuote("Use [a+b].\nThen continue.", "Use [a+b]. Then continue."),
    "Use [a+b].\nThen continue.",
  );
});
