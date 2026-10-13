# ScopeSathi — free development setup

The app supports Firebase Spark without Cloud Run or Vertex AI. The backend runs on your Mac. No billing upgrade is needed for this setup. Firebase and Gemini free quotas still apply.

## Current configuration

- `APP_MODE=firebase`: Google sign-in required; anonymous demo access disabled.
- `STORAGE_BACKEND=firestore`: Firestore is selected. The Admin credential is now configured and Firestore access has been verified. If access fails later, Settings shows a connection error and project operations fail visibly. No local fallback is used. The existing `.data/firebase-local/projects.json` remains available for explicit migration.
- Manual analysis: extract brief text into editable requirements, approve the baseline, submit requests, edit/save findings, resolve questions, approve/reject/ask for clarification, review affected tasks, export scope/history/CSV and manage members.
- Google ID tokens are signature/audience/expiry verified; Firebase account lookup validates session status when Admin credentials are unavailable. Verified Google accounts only. Every route checks project membership and role.

Start with `npm run dev`, open http://127.0.0.1:5173 and choose Continue with Google. The original prepared demo remains available with APP_MODE=demo; its data is separate.

## Enable Firestore on Spark

1. Keep the existing `(default)` Firestore database. Do not enable public/test rules. The backend uses Admin access; direct browser access stays denied by `firestore.rules`.
2. In Firebase Project settings → Service accounts → Firebase Admin SDK, create a private key only if you do not already have one. Save the JSON securely outside the repository. Never paste it in chat, upload it, or commit it.
3. From the project folder, run `npm run firestore:configure -- /absolute/path/to/the-key.json`. The script validates the scopesathi project and Firestore read access, then saves only the credential file path in local `.env`. It never copies the key into frontend code.
4. Restart the backend. Sign in, open Settings and check the connection. Run `npm run test:firestore` for a temporary-record integration check covering writes, history, task updates, outsider rejection and fresh-process reads. It removes only its own temporary test project. Then create a project through the app and confirm it appears in Firestore’s `projects` collection.

The key's service account needs Firestore access and Firebase Authentication user lookup access. ADC can be used instead of a key. Local projects are not silently migrated; export them before changing storage. The UI reports the configured storage explicitly, and failures remain visible.

## Optional live Gemini on the free tier

1. Open https://aistudio.google.com/apikey and use a project on the free tier. Do not link billing to this project if you want free-tier-only usage.
2. Put `GEMINI_API_KEY=...` only in local `.env`. This is a different key from Firebase's public web configuration. Never use a VITE_ variable or paste the key into chat.
3. Set `GEMINI_MODEL` to an available text model with free-tier access in your AI Studio project. Check https://ai.google.dev/gemini-api/docs/pricing and your project's limits.
4. Restart the backend. Configured requests now use the Gemini Developer API, not Vertex AI. No automatic paid fallback is implemented. Quota or access failures leave scope unchanged.

Free-tier availability depends on region/model/account and has limits. Google documents that free-tier inputs may be used to improve its products: use sample/non-sensitive briefs until you review the applicable terms. Without a key, manual review remains fully available and is explicitly labeled.

## Team access

The owner invites viewers, editors or reviewers by Google email in project settings. Pending invitations grant no access; recipients accept with the matching verified account. A configured sender queues a branded invitation email; otherwise the in-app notice remains available. Unknown addresses require owner confirmation. Both users must reach the same backend to share projects. Localhost on another laptop points to that laptop, not this Mac. Public deployment is a separate task; do not expose the demo server. See [email setup](EMAIL_SETUP.md).

## Checks

Run `npm test` and `npm run build`. Automated tests cover approval invariants, source quote validation, concurrent edits, upload parsing, manual proposals and auth rejection. Real Google sign-in, Firestore persistence and live Gemini still require the corresponding user/account setup and must be tested separately.

## Explicit migration

After Firestore connects, Settings → Copy existing local projects → Preview migration shows owned project names and counts. Select Copy and verify for each ready item. Existing cloud records are never overwritten. Unchanged duplicates are marked already copied; different records with the same ID are conflicts. Local files are not deleted. A changed local record requires a fresh preview. No migration runs automatically.

## Revision rounds

The project owner sets the included allowance and round definition. Related requests select a shared round when submitted; reviewers can correct the category and grouping before approval. Each approved new-scope round counts once. Corrections, rejected requests, clarification and no-change decisions do not consume allowance. New rounds beyond the allowance require a recorded separate agreement; the app never charges the client. Lowering a policy preserves history.

## Verified connection

The Admin credential path is configured in the local environment. Live Firestore tests passed for create, baseline approval, request submission, decision, task update, outsider rejection and fresh-process persistence. The temporary verification record was removed. Local preview connection checks report connected. Anonymous database reads are rejected. Deployed security-rule contents could not be inspected with the available permissions; confirm the deny-all rules in the Firebase console. Existing local projects remain unmigrated. Gemini remains manual until its separate API key is configured.
