import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertRecipient,
  assertAccept,
  type Invitation,
} from "../server/invitations";
import {
  welcomeEmail,
  invitationEmail,
  accessEmail,
  membershipEmail,
  escapeHTML,
  mailJob,
  publicAppURL,
} from "../server/email";
const target = {
  uid: "reviewer",
  email: "reviewer@example.com",
  emailVerified: true,
  disabled: false,
  providerData: [{ providerId: "google.com" }],
};
const invite: Invitation = {
  id: "invite",
  uid: "reviewer",
  email: "reviewer@example.com",
  role: "reviewer",
  inviter: "Owner",
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  state: "pending",
};
test("only verified enabled Google accounts can receive project invitations", () => {
  assertRecipient(target, "reviewer@example.com");
  for (const invalid of [
    { ...target, emailVerified: false },
    { ...target, disabled: true },
    { ...target, email: "other@example.com" },
    { ...target, providerData: [] },
  ])
    assert.throws(
      () => assertRecipient(invalid, "reviewer@example.com"),
      /verified Google account/,
    );
});
test("acceptance is bound to both UID and verified email, with expiry and one-time decision", () => {
  const a = {
    uid: "reviewer",
    email: "reviewer@example.com",
    name: "Reviewer",
  };
  assertAccept(invite, a);
  assert.throws(
    () => assertAccept(invite, { ...a, uid: "outsider" }),
    /account that received/,
  );
  assert.throws(
    () => assertAccept(invite, { ...a, email: "other@example.com" }),
    /account that received/,
  );
  for (const state of ["accepted", "declined", "revoked"] as const)
    assert.throws(() => assertAccept({ ...invite, state }, a), /already/);
  assert.throws(
    () =>
      assertAccept(
        { ...invite, expiresAt: new Date(Date.now() - 1).toISOString() },
        a,
      ),
    /expired/,
  );
});
test("branded email templates include roles, next steps, plain text and escaped user content", () => {
  const welcome = welcomeEmail("<script>", "https://app.example.com");
  assert.ok(welcome.html.includes("&lt;script&gt;"));
  assert.ok(!welcome.html.includes("<script>"));
  assert.match(welcome.text, /Capture the client brief/);
  for (const role of ["reviewer", "editor", "viewer"] as const) {
    const email = invitationEmail(
      "A & B <project>",
      "Owner <name>",
      role,
      "id",
      "https://app.example.com",
    );
    assert.match(email.text, new RegExp(role));
    assert.ok(email.html.includes("A &amp; B &lt;project&gt;"));
    assert.match(email.html, /only after acceptance/);
    assert.ok(email.html.includes("https://app.example.com/?invitation=id"));
    assert.match(accessEmail("Project", role).text, /accepted/);
    assert.match(membershipEmail("Project","Owner",role).text,/granted you/);
  }
  assert.equal(escapeHTML("\"'<>"), "&quot;&#39;&lt;&gt;");
});
test("email queue does not claim submission when sender or public URL is missing", () => {
  const before = process.env.APP_PUBLIC_URL;
  process.env.APP_PUBLIC_URL = "http://127.0.0.1:5173";
  assert.equal(publicAppURL(), "");
  assert.equal(
    mailJob("user@example.com", "welcome", { name: "User" }).status,
    "waiting_setup",
  );
  if (before === undefined) delete process.env.APP_PUBLIC_URL;
  else process.env.APP_PUBLIC_URL = before;
});

test("signup invitations require the matching verified-session email", () => {
  const pending = { ...invite, uid: "" };
  assert.doesNotThrow(() => assertAccept(pending, { uid: "new-user", email: invite.email, name: "New user" }));
  assert.throws(() => assertAccept(pending, { uid: "new-user", email: "wrong@example.com", name: "Wrong user" }), /Google account/);
});
