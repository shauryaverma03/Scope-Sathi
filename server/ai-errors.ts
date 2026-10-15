import { AppError } from "./domain.js";
export function aiFailure(status: number) {
  const reason =
    status === 402
      ? "The AI provider reported a billing or payment restriction. The project owner must check billing and service spending controls. Manual review remains available."
      : status === 504 || status === 499
        ? "Gemini analysis timed out. Retry later; the brief and existing draft are preserved."
        : status === 503
          ? "Gemini is temporarily busy. Retry later; the brief and existing draft are preserved."
          : status === 404
            ? "The configured Gemini model or generation endpoint is unavailable."
            : status === 401 || status === 403
              ? "Gemini access was denied. Check the configured service credentials, restrictions and project permissions."
              : status === 429
                ? "Gemini quota or rate limit was reached. Check the model quota in the configured Google service."
                : status === 400
                  ? "Gemini rejected the request format. Check model support for structured output."
                  : "Gemini could not return a valid analysis. Check model access and configuration.";
  return new AppError(
    status === 429 ? 429 : [402, 499, 503, 504].includes(status) ? 503 : 502,
    reason + " No decision has been applied.",
  );
}
