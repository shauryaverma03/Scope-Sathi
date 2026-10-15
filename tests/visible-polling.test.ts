import { test } from "node:test";
import assert from "node:assert/strict";
import { visiblePolling } from "../src/visible-polling";
test("notification polling pauses when hidden, deduplicates in-flight work and discards old-account results", async () => {
  let listener = () => {},
    interval = () => {},
    cancelled = false,
    calls = 0;
  let finish!: (value: string) => void;
  const source = {
    visibilityState: "hidden",
    addEventListener: (_type: string, fn: () => void) => {
      listener = fn;
    },
    removeEventListener: (_type: string, fn: () => void) => {
      assert.equal(fn, listener);
    },
  };
  const rows: string[] = [],
    errors: unknown[] = [];
  const polling = visiblePolling(
    source,
    () => {
      calls++;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    },
    (value) => rows.push(value),
    (error) => errors.push(error),
    (fn) => {
      interval = fn;
      return () => {
        cancelled = true;
      };
    },
  );
  interval();
  await polling.refresh();
  assert.equal(calls, 0);
  source.visibilityState = "visible";
  listener();
  interval();
  await polling.refresh();
  assert.equal(calls, 1);
  finish("first");
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(rows, ["first"]);
  const pending = polling.refresh();
  assert.equal(calls, 2);
  polling.stop();
  finish("old-account");
  await pending;
  assert.deepEqual(rows, ["first"]);
  assert.equal(cancelled, true);
  assert.deepEqual(errors, []);
  await polling.refresh();
  assert.equal(calls, 2);
});
