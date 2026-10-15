import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { cleanExtract, validateExtraction } from "../server/extraction";
import { extract } from "../server/ai";
import { z } from "zod";
const original =
  "SCOPESATHI / Clarity before commitment 1\nSUNDAY STORE / CLIENT BRIEF\nOnline Store Requirements\nProject context\nGoal: launch a store.\nRequired features\nR1. Customers must sign in before\ncheckout. Guest checkout is excluded.\nR2. Customers must see only their own orders.\nAcceptance criteria\nA signed-in customer can complete checkout.\nExcluded work and revisions\nNative mobile apps and inventory integrations are excluded.\n-- 1 of 1 --";
test("cleanup groups wrapped clauses, removes PDF metadata, preserves exact sources and categories", () => {
  const result = cleanExtract(original);
  assert.equal(result.requirements.length, 2);
  assert.ok(
    result.requirements.every(
      (r) => !/^SCOPESATHI|SUNDAY|Project context|--/.test(r.text),
    ),
  );
  assert.match(result.requirements[0].text, /before checkout/);
  assert.ok(result.requirements[0].quote.includes("\n"));
  assert.ok(result.context.some((c) => c.quote.includes("complete checkout")));
  assert.ok(
    result.context.some((c) => c.quote.includes("inventory integrations")),
  );
  assert.ok(result.context.some((c) => c.quote.startsWith("Goal:")));
  validateExtraction(original, result);
});
test("duplicate clauses are visible in context and empty metadata is not a baseline", () => {
  const result = cleanExtract(
    "Required features\nR1. Customers must search products.\nR2. Customers must search products.",
  );
  assert.equal(result.requirements.length, 1);
  assert.ok(result.context.some((c) => c.reason.includes("Duplicate")));
  assert.throws(
    () => cleanExtract("SUNDAY STORE\nRequirements\n-- 1 of 1 --"),
    /No actionable/,
  );
});
test("Gemini output is schema/evidence validated, failures never switch to local output", async () => {
  const valid = cleanExtract(original);
  const mock = async <T>(schema: z.ZodType<T>, _contents: string) =>
    schema.parse(valid);
  assert.equal((await extract(original, true, mock)).requirements.length, 2);
  const fake = {
    ...valid,
    requirements: [{ ...valid.requirements[0], quote: "Invented requirement" }],
  };
  await assert.rejects(
    extract(original, true, async <T>(schema: z.ZodType<T>) =>
      schema.parse(fake),
    ),
    /source quote|unverified/,
  );
  await assert.rejects(
    extract(original, true, async () => {
      throw new Error("Synthetic model failure");
    }),
    /Synthetic model failure/,
  );
});
test("real sample PDFs no longer turn headings/footer into requirements", async () => {
  for (const path of [
    "output/pdf/Sunday-Store-Client-Brief.pdf",
    "output/pdf/ScopeSathi-Demo-Client-Brief.pdf",
  ]) {
    const parser = new PDFParse({ data: await readFile(path) });
    try {
      const text = (await parser.getText()).text;
      const result = await extract(text, false);
      if (path.endsWith("/Sunday-Store-Client-Brief.pdf")) {
        assert.equal(result.requirements.length, 6);
        assert.ok(
          result.requirements[0].text.includes(
            "Guest checkout is not included",
          ),
        );
        assert.ok(
          result.requirements[2].text.includes("another customer's orders"),
        );
        assert.ok(
          result.context.some((c) =>
            c.quote.includes("Core pages remain usable"),
          ),
        );
      }
      assert.ok(
        result.requirements.filter((r) => r.category === "feature").length ===
          6,
        JSON.stringify({ path, count: result.requirements.length }),
      );
      assert.ok(
        result.requirements.every(
          (r) =>
            !/^SCOPESATHI|SUNDAY|--|Project context|Online Store Requirements/.test(
              r.text,
            ),
        ),
      );
      assert.ok(result.requirements.some((r) => r.text.includes("catalogue")));
      assert.ok(
        [...result.context, ...result.requirements].some((c) =>
          c.quote.includes("excluded"),
        ),
      );
    } finally {
      await parser.destroy();
    }
  }
});

test("numbered feature validation rejects split clauses, missing features and extra cards", () => {
  const result = cleanExtract(original);
  assert.throws(
    () =>
      validateExtraction(original, {
        ...result,
        requirements: result.requirements.slice(0, 1),
      }),
    /numbered feature/,
  );
  assert.throws(
    () =>
      validateExtraction(original, {
        ...result,
        requirements: [
          ...result.requirements,
          { ...result.requirements[0], id: "REQ-003" },
        ],
      }),
    /numbered feature/,
  );
});

test("short imperative clauses stay visible rather than becoming document headings", () => {
  const result = cleanExtract(
    "Required features\nEnable login\nSupport product search",
  );
  assert.equal(result.requirements.length, 1);
  assert.match(result.requirements[0].text, /Enable login/);
  assert.match(result.requirements[0].text, /Support product search/);
});

test("AI metadata clauses are rejected instead of being presented as scope", () => {
  const data = cleanExtract(original);
  data.requirements = [
    {
      id: "REQ-001",
      text: "SUNDAY STORE / CLIENT BRIEF",
      quote: "SUNDAY STORE / CLIENT BRIEF",
      category: "feature",
    },
  ];
  assert.throws(
    () => validateExtraction(original, data),
    /metadata|numbered feature/,
  );
});
