import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { databaseStatus } from "../server/database";
test(
  "missing Firestore credential reports a setup error without creating a failing client",
  {
    skip:
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      existsSync(
        join(homedir(), ".config/gcloud/application_default_credentials.json"),
      ),
  },
  async () => {
    const status = await databaseStatus(true, true);
    assert.equal(status.state, "error");
    assert.match(status.message, /credential/);
    assert.equal((await databaseStatus(false)).state, "local");
  },
);
