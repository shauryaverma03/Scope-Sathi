// Gemini accepts a subset of JSON Schema. Bounds remain enforced by Zod
// after generation; avoid sending complex nested bounds to the provider.
export function providerSchema(value: unknown): any {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            ![
              "$schema",
              "minLength",
              "maxLength",
              "minItems",
              "maxItems",
            ].includes(key),
        )
        .map(([key, child]) => [key, providerSchema(child)]),
    );
  }
  return value;
}

// Restore PDF whitespace only. Never repair paraphrased words, punctuation or
// missing evidence; those still fail exact-source validation.
export function sourceQuote(source: string, quote: string): string {
  const trimmed = quote.trim();
  if (!trimmed || source.includes(trimmed)) return trimmed;
  const escaped = trimmed
    .split(/\s+/)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return source.match(new RegExp(escaped.join("\\s+")))?.[0] ?? trimmed;
}
