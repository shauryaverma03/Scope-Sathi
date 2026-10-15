# Live Cloud Run deployment and email setup

[Documentation home](README.md)

Live application: **[Open ScopeSathi](https://scopesathi-api-112358672382.europe-west1.run.app)**.

The owner completed the first successful GitHub build and browser sign-in on 15 October 2026. This is evidence of deployment and authentication, not proof of hosted SMTP or every live AI workflow. The changes described here still need to be pushed and deployed after local verification.

| Setting | Current deployment / intended release setting |
| --- | --- |
| Project | `scopesathi` |
| Service / region | `scopesathi-api` / `europe-west1` |
| Source | `shauryaverma03/Scope-Sathi`, branch `main`, root `/Dockerfile` |
| Runtime identity | `scopesathi-runtime@scopesathi.iam.gserviceaccount.com` |
| Billing / scaling | Request-based, service minimum 0, service maximum 1 |
| Requests | Concurrency 20, timeout 60 seconds |
| Starting resources | 1 vCPU, 512 MiB; verify actual deployed resources and load before increasing |
| Vertex configuration | `global`, model `gemini-3.5-flash-lite`; verify project access and live response |

## Runtime environment

Cloud Run → scopesathi-api → Containers → Variables & Secrets:

```text
APP_MODE=google
GOOGLE_CLOUD_PROJECT=scopesathi
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-3.5-flash-lite
APP_PUBLIC_URL=https://scopesathi-api-112358672382.europe-west1.run.app
EMAIL_LOCAL_TEST=false
```

Keep the existing `FIREBASE_WEB_CONFIG` value as the complete Firebase web JSON. Do not substitute a bare API key. Cloud Run supplies `PORT`. Do not upload a local `.env`, Admin JSON key, or `GOOGLE_APPLICATION_CREDENTIALS` path from your Mac. The attached runtime identity uses ADC. Runtime roles: Cloud Datastore User, Firebase Authentication Viewer, and Agent Platform/Vertex AI User. Grant Secret Manager Secret Accessor on the specific SMTP secret only when configuring mail.

The known scopesathi installation has a safe default public origin in code for google mode only. Explicit `APP_PUBLIC_URL` overrides it; invalid values fail closed. Other installations and local modes must supply their own public URL. Keep the explicit variable so a future domain migration is deliberate.

## Update the live site

1. Review local changes and run `npm run build` and the relevant tests.
2. Commit and push to `main` yourself. Never stage `.env`, `.data`, private keys or password files.
3. Cloud Build → History: find the build for the new commit SHA. Wait for Pull, Build, Push and Deploy to succeed.
4. Cloud Run → Revision History: confirm the new revision receives traffic. Open the same live URL and refresh.
5. If a build fails, inspect that build's logs. Retry build retries that source commit; it does not fetch a later unbuilt commit. A new push creates a new build. Cloud Run Redeploy alone does not rebuild the repository.

GitHub pushes update code, not the ignored local `.env` or Secret Manager values. Existing runtime variables and secret references must remain configured in Cloud Run. Environment/secret changes require a new Cloud Run revision. Do not overwrite the container image with a placeholder.

For the earlier `developerconnect.gitRepositoryLinks.fetchReadToken` error, inspect the build's Execution details and grant `roles/developerconnect.readTokenAccessor` to that exact build identity, preferably scoped to the linked repository. The build identity and application runtime identity serve different purposes.

## Configure hosted email without exposing the password

This release prepares hosted sending; it does not enable it automatically or send test messages. In-app invitations work without SMTP.

1. In Secret Manager, create a secret named `scopesathi-smtp-password`. Paste the Gmail **app password** privately into its secret value. Do not put it in GitHub, chat, a screenshot, or an ordinary runtime variable.
2. On that secret's Permissions tab, grant **Secret Manager Secret Accessor** to `scopesathi-runtime@scopesathi.iam.gserviceaccount.com`. No project-wide secret permission is needed.
3. In Cloud Run Variables & Secrets, add `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER` equal to the actual sender address, `EMAIL_FROM` equal to `ScopeSathi <that-same-address>`, and the public URL above.
4. Choose **Reference a secret**. Variable name: `SMTP_PASS`; secret: `scopesathi-smtp-password`; choose a specific version such as `1`.
5. Keep `EMAIL_ENABLED=false` until you have reviewed existing `mailOutbox` jobs and configured the Scheduler below. Enabling it can release waiting welcome/access emails and active invitations. Revoked/expired invitations are cancelled. Failed/uncertain submissions are not automatically retried.

All welcome, invitation, membership and accepted-access templates generate links using the public origin at send time, so queued payloads do not retain a localhost link. The invitation link includes an encoded invitation ID; the recipient must still sign in with the matching Google account and accept explicitly.

## Scheduled mail with scale-to-zero

Cloud Run request-based CPU is not a reliable host for a timer after an HTTP response. On Cloud Run, this release disables the local polling loop and supplies an authenticated endpoint:

```text
POST https://scopesathi-api-112358672382.europe-west1.run.app/api/internal/mail/drain
```

The endpoint verifies a Google-signed OIDC token, its audience and verified service-account email before processing at most **one eligible message** in the request. It cannot be called using an ordinary signed-in user's Firebase token. Firestore transactions claim each job; interrupted/ambiguous SMTP submissions are preserved for manual review. This is not exactly-once inbox delivery.

Owner setup, after deploying this code:

1. Create a separate service account: `scopesathi-mail-scheduler` in project `scopesathi`. Do not generate a key or grant database/AI roles to it.
2. Add `MAIL_TRIGGER_SERVICE_ACCOUNT=scopesathi-mail-scheduler@scopesathi.iam.gserviceaccount.com` to Cloud Run. Its audience is the origin in `APP_PUBLIC_URL`.
3. Enable Cloud Scheduler API and create one HTTP job, for example `scopesathi-mail-drain`, in `europe-west1`.
4. Frequency: `*/5 * * * *`, timezone `Asia/Kolkata`. This means one invocation every five minutes, and at most one message per invocation; a backlog can take longer. It wakes the service and incurs applicable Scheduler, Cloud Run, Firestore and SMTP usage.
5. Target URL: the full drain endpoint above. Method: **POST**. Authentication: **Add OIDC token**. Service account: `scopesathi-mail-scheduler@scopesathi.iam.gserviceaccount.com`. Audience: **`https://scopesathi-api-112358672382.europe-west1.run.app`**, without the endpoint path or query.
6. Use a 60-second attempt deadline. Retain the Google-managed Cloud Scheduler service agent role; never grant that service-agent role to your runtime account. The person creating the job must be allowed to act as the chosen scheduler identity. The application route verifies identity even though the Cloud Run service permits public browser access.
7. Review queued recipients; then set `EMAIL_ENABLED=true` and deploy the environment change. Only use **Run now** when you intend to send an eligible queued message. No email was sent by preparing these instructions.
8. Inspect execution status and `mailOutbox` statuses. A 200 means the batch scan completed, not necessarily that a message existed or reached an inbox. 401/403 means authentication failed; 503 means configuration, busy-worker or queue-processing failure. A job marked `failed`/`uncertain` needs manual review, not blind replay.

Disable sending with `EMAIL_ENABLED=false` and pause the Scheduler job if needed. A job already submitting SMTP cannot be recalled. Do not use unauthenticated uptime pings as an email trigger.

## Authentication and costs

Keep `scopesathi-api-112358672382.europe-west1.run.app` in Firebase Authentication → Settings → Authorized domains. For a custom domain, add the new hostname and change `APP_PUBLIC_URL`; update the Scheduler target and OIDC audience together.

The owner created a ₹200 monthly alerts-only budget and ₹100 Cloud Run and Gemini API caps. Verify the actual budget scopes/status in Billing. **Vertex AI/Agent Platform needs its own cap**: the Gemini Developer API cap does not cover it. Cloud Build, Artifact Registry, Firestore, Secret Manager, Scheduler and networking are separate potential costs. Alerts do not stop usage; spend-cap enforcement can lag and can interrupt the demo. Neither a ₹1,000 prepayment nor maximum one instance is a monetary ceiling.

## Release verification

- Landing footer and workspace sidebar help controls render correctly after the latest commit is deployed.
- Sign in, load/save a test project, refresh and confirm persistence.
- Upload the six-feature Sunday Store brief, explicitly analyse, verify evidence and approve only after review.
- Verify a real Vertex AI response; configured model text alone is not connectivity evidence.
- Using intended test recipients, verify welcome and invitation links point to the live hostname, acceptance requires the correct identity, and revoked invitations cannot grant access.
- Verify Scheduler authentication and SMTP in the live environment before claiming hosted email works.

Official references: [continuous deployment](https://docs.cloud.google.com/run/docs/continuous-deployment), [request-based CPU](https://docs.cloud.google.com/run/docs/configuring/billing-settings), [Scheduler OIDC authentication](https://docs.cloud.google.com/scheduler/docs/http-target-auth), [Secret Manager integration](https://docs.cloud.google.com/run/docs/configuring/services/secrets).
