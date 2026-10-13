import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { makeLimit, requestContext } from "../server/protection.js";

test("ingress rejects excess requests despite spoofed forwarded IPs and returns retry metadata", async () => {
  const app = express();
  app.use(requestContext, makeLimit(2, 60000));
  app.get("/", (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const address = server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}/`;
    const first = await fetch(url);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("cache-control"), "no-store");
    const second = await fetch(url);
    assert.notEqual(first.headers.get("x-request-id"), second.headers.get("x-request-id"));
    const blocked = await fetch(url, { headers: { "X-Forwarded-For": "8.8.8.8" } });
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.get("retry-after"));
    assert.equal((await blocked.json()).requestId, blocked.headers.get("x-request-id"));
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
