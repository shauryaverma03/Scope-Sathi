import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { mailTrigger } from "../server/mail-trigger";
import {
  publicAppURL,
  invitationEmail,
  welcomeEmail,
  accessEmail,
  membershipEmail,
} from "../server/email";
import { deployment } from "../shared/deployment";

test("cloud email links use the deployed origin; invalid overrides do not fall back", () => {
  const keys = ["APP_MODE", "GOOGLE_CLOUD_PROJECT", "APP_PUBLIC_URL"];
  const before = keys.map((k) => process.env[k]);
  try {
    process.env.APP_MODE = "google";
    process.env.GOOGLE_CLOUD_PROJECT = "scopesathi";
    delete process.env.APP_PUBLIC_URL;
    assert.equal(publicAppURL(), deployment.origin);
    for (const mail of [
      welcomeEmail("User"),
      accessEmail("Project", "viewer"),
      membershipEmail("Project", "Owner", "reviewer"),
      invitationEmail("Project", "Owner", "editor", "invite / 1"),
    ]) {
      assert.ok(mail.html.includes(deployment.origin));
      assert.ok(mail.text.includes(deployment.origin));
      assert.doesNotMatch(mail.text, /localhost|127\.0\.0\.1/);
    }
    assert.ok(
      invitationEmail("Project", "Owner", "editor", "invite / 1").text.includes(
        "?invitation=invite%20%2F%201",
      ),
    );
    process.env.APP_PUBLIC_URL = "https://custom.example/path";
    assert.equal(publicAppURL(), "https://custom.example");
    for (const invalid of [
      "http://localhost:5173",
      "https://user:pass@example.com",
      "invalid",
      "",
    ]) {
      process.env.APP_PUBLIC_URL = invalid;
      assert.equal(publicAppURL(), "");
    }
    delete process.env.APP_PUBLIC_URL;
    process.env.APP_MODE = "firebase";
    assert.equal(publicAppURL(), "");
    process.env.APP_MODE = "google";
    process.env.GOOGLE_CLOUD_PROJECT = "other-project";
    assert.equal(publicAppURL(), "");
  } finally {
    keys.forEach((key, i) =>
      before[i] === undefined
        ? delete process.env[key]
        : (process.env[key] = before[i]),
    );
  }
});

test("scheduled mail requires verified OIDC audience and the exact permitted service account", async () => {
  const keys = [
    "APP_MODE",
    "GOOGLE_CLOUD_PROJECT",
    "APP_PUBLIC_URL",
    "MAIL_TRIGGER_SERVICE_ACCOUNT",
  ];
  const before = keys.map((k) => process.env[k]);
  try {
    process.env.APP_MODE = "google";
    process.env.GOOGLE_CLOUD_PROJECT = "scopesathi";
    process.env.APP_PUBLIC_URL = deployment.origin;
    const identity =
      "scopesathi-mail-scheduler@scopesathi.iam.gserviceaccount.com";
    process.env.MAIL_TRIGGER_SERVICE_ACCOUNT = identity;
    let delivered = 0;
    let verified = 0;
    let claims = { email: identity, email_verified: true };
    let verificationFails = false;
    let senderReady = true;
    let deliverySucceeds = true;
    const handler = mailTrigger(
      async (token, audience) => {
        verified++;
        assert.equal(token, "signed-token");
        assert.equal(audience, deployment.origin);
        if (verificationFails) throw new Error("bad signature or audience");
        return claims;
      },
      async () => {
        delivered++;
        return deliverySucceeds;
      },
      () => senderReady,
    );
    async function call(authorization?: string) {
      let status = 200;
      const response = {
        status(code: number) {
          status = code;
          return this;
        },
        json() {
          return this;
        },
      };
      await handler(
        { headers: { authorization } } as Request,
        response as Response,
        () => {},
      );
      return status;
    }
    assert.equal(await call(), 401);
    assert.equal(verified, 0);
    claims = { email: "user@example.com", email_verified: true };
    assert.equal(await call("Bearer signed-token"), 403);
    claims = { email: identity, email_verified: false };
    assert.equal(await call("Bearer signed-token"), 403);
    claims = { email: identity, email_verified: true };
    verificationFails = true;
    assert.equal(await call("Bearer signed-token"), 403);
    assert.equal(delivered, 0);
    verificationFails = false;
    senderReady = false;
    assert.equal(await call("Bearer signed-token"), 503);
    assert.equal(delivered, 0);
    senderReady = true;
    assert.equal(await call("Bearer signed-token"), 200);
    assert.equal(delivered, 1);
    deliverySucceeds = false;
    assert.equal(await call("Bearer signed-token"), 503);
    delete process.env.MAIL_TRIGGER_SERVICE_ACCOUNT;
    assert.equal(await call("Bearer signed-token"), 503);
  } finally {
    keys.forEach((key, i) =>
      before[i] === undefined
        ? delete process.env[key]
        : (process.env[key] = before[i]),
    );
  }
});
