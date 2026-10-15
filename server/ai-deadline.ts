import { AppError } from "./domain.js";

export async function withAIDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  milliseconds = 40000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AppError(
          503,
          "Gemini took too long. Retry analysis or choose Prepare without AI. Your brief and draft are unchanged.",
        ),
      );
      controller.abort();
    }, milliseconds);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => work(controller.signal)),
      deadline,
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
