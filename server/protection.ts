import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";

export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const started = performance.now();
  res.locals.requestId = requestId;
  res.set("X-Request-ID", requestId);
  res.set("Cache-Control", "no-store");
  res.on("finish", () => console.info(JSON.stringify({
    event: "http_request", requestId, method: req.method,
    route: req.route?.path ?? "unmatched", status: res.statusCode,
    durationMs: Math.round(performance.now() - started),
  })));
  next();
};

export function makeLimit(limit: number, windowMs: number, perUser = false) {
  return rateLimit({
    limit, windowMs,
    ...(perUser ? { keyGenerator: (_req, res) => res.locals.actor.uid } : {}),
    standardHeaders: "draft-8", legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
      error: "Too many requests. Wait before trying again.",
      requestId: res.locals.requestId,
    }),
  });
}
