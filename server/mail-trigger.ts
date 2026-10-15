import type { RequestHandler } from "express";
import { OAuth2Client } from "google-auth-library";
import { deliverQueuedMail, emailReady, publicAppURL } from "./email";

type Claims = { email?: string; email_verified?: boolean };
type Verify = (token: string, audience: string) => Promise<Claims | undefined>;
const oidc = new OAuth2Client();

// The app is publicly reachable, so verify the Scheduler identity in the app.
// Firebase user tokens and a caller-supplied email header are not sufficient.
export function mailTrigger(
  verify: Verify = async (token, audience) =>
    (await oidc.verifyIdToken({ idToken: token, audience })).getPayload(),
  deliver = () => deliverQueuedMail(1),
  ready = emailReady,
): RequestHandler {
  return async (req, res) => {
    const expected = process.env.MAIL_TRIGGER_SERVICE_ACCOUNT;
    const audience = publicAppURL();
    if (process.env.APP_MODE !== "google" || !expected || !audience) {
      res
        .status(503)
        .json({ error: "Scheduled email delivery is not configured." });
      return;
    }
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) {
      res.status(401).json({ error: "Scheduler identity required." });
      return;
    }
    try {
      const claims = await verify(token, audience);
      if (!claims?.email_verified || claims.email !== expected)
        throw new Error();
    } catch {
      res.status(403).json({ error: "Scheduler identity was not verified." });
      return;
    }
    if (!ready() || !(await deliver())) {
      res
        .status(503)
        .json({
          error:
            "Email delivery is not ready. Check backend configuration and queue status.",
        });
      return;
    }
    res.json({ ok: true, batchLimit: 1 });
  };
}
