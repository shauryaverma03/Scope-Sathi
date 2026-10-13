# Validation record

## Latest summary — documentation reviewed 14 October 2026

The entries below are chronological historical records; older configuration limitations may have been resolved by later entries. They do not establish the state of another installation.

- Latest backend-protection run: 39 automated tests passed and production build passed. The malformed-JSON assertion was subsequently verified in the six-test API suite.
- Earlier live Firestore and invitation fixture checks are recorded below; they were not rerun for this documentation update.
- A styled local Gmail test was previously received by the project author. Template screenshots are previews, not delivery receipts. End-to-end delivery must be checked for each deployment.
- Public Cloud Run/Firebase Hosting deployment and live Gemini analysis remain unverified here.
- This documentation update checks relative links, screenshot files and consistency against source. It does not claim a new production security audit or load test.

See [system protections](SYSTEM_DESIGN.md), [image provenance](images/README.md) and [documentation index](README.md).

Initial local verification: 11 October 2026.

## Automated checks

`npm test` covers:

1. Proposals do not mutate approved requirements or task status.
2. Open questions block approval.
3. Resolved approval creates a new version, preserves the previous version and flags tasks.
4. Rejection/clarification leave baseline and tasks intact.
5. Editors/viewers cannot approve; outsiders cannot read project data.
6. A request cannot receive a second terminal decision.
7. Stale-baseline analysis cannot be approved.
8. Fabricated request quotes, baseline quotes and task references fail validation.
9. The initial baseline cannot be overwritten.
10. Arbitrary local-demo input is labelled manual clarification, never live AI.
11. Explicitly linked tasks are flagged even when AI omits their IDs.
12. Conflicting changes to the same requirement are rejected.
13. HTTP end-to-end request/approval workflow and concurrent write rejection.
14. New project, text upload, extraction, baseline creation and deletion.
15. Foreign browser origin rejection and invalid input errors.
16. Refusal to run the demo on Cloud Run.

`npm run build` checks TypeScript and bundles the production client.

## Browser walkthrough

- Created the Sunday Store sample project.
- Submitted the guest-checkout example.
- Verified the original source and incoming-request evidence.
- Verified approval was disabled while an open question remained.
- Edited the wording to include a 24-hour tracking link, resolved the question and recorded a decision.
- Approved the change and visibly verified baseline v2.
- Verified the checkout task moved to needs review while unrelated tasks retained their statuses.
- Inspected narrow/mobile and desktop breakpoint layouts.

## Not verified yet

No Google Cloud project was available. Actual Google sign-in, Firestore transactions against the managed service, Vertex AI responses, Cloud Build, Cloud Run deployment and Firebase Hosting remain unverified until configuration is supplied. Local tests use local storage, not the Firestore emulator. Prepared sample output is not a measure of model accuracy.

## Model evaluation before submission

Prepare 20-30 labelled examples from permitted, anonymised client briefs (or clearly labelled synthetic data). Reserve unseen cases. Include ambiguous requests, proposals, duplicate asks, conflicting instructions and baseline amendments. Compare against manual review and a simple Gemini prompt. Record false positives, misses, semantic evidence correctness, review time and unapproved mutation count. Report actual results; do not claim measured time savings until tested.

Dependency verification: the production dependency audit reports no known vulnerabilities after updating the Google SDKs and overriding the Firebase package's older `@grpc/grpc-js` dependency with the compatible 1.14.x line. The override should be reviewed on future Firebase upgrades. Dependency auditing does not establish application security.

Additional API check: a valid generated text PDF is uploaded and its expected text verified after extraction.

## Free Firebase adaptation — 2026-10-11

- 23 automated tests pass. Production build passes.
- Added tests for free-mode startup without paid services, missing/forged token rejection, disabled-session lookup handling, long-brief extraction without truncation, manual multi-finding approvals, persistent identity isolation, viewer restrictions and access revocation.
- Browser-tested in isolated local data: arbitrary CSV-export request → manual proposal → save → approve → linked order-history task marked needs_review. Reload preserved the outcome.
- Main preview now uses APP_MODE=firebase and requires Google sign-in. Its backend health is healthy. The embedded-browser popup did not complete sign-in; real account login remains user-dependent. Added clear popup failure/timeout guidance.
- Current storage is local, isolated from demo data. Firestore mode is implemented but not verified against scopesathi because Admin credentials were not supplied.
- Gemini Developer API support is implemented, but no private API key/model was supplied; live analysis remains unverified. The manual workflow makes no AI claims.

## Structured intake and revision upgrade

- 33 automated tests pass; TypeScript and production build pass.
- Tests cover intake freezing, saved brief drafts, grouping, corrections/no-change exclusion, owner-only policy changes, separate agreements for exhausted allowance, multi-requirement findings, ambiguous/fabricated evidence, legacy defaults and canonical migration hashes.
- Browser checks: each empty tab has distinct content; Settings shows account/connections without a project; client intake saves, converts to a brief, extracts editable requirements and approves a baseline; zero allowance blocks approval until separate agreement is entered.
- Firestore selected explicitly per user request. No Admin credential/ADC is available. Actual database writes, migration, direct browser rule deployment and live Gemini remain unverified; no silent local fallback.
- Current Firebase rules file denies direct client access. Its deployed state must be checked in the Firebase console when credentials are provided.

## Firestore credential verification

Live Firestore integration checks now pass: create, baseline, request, approval, task update, backend outsider rejection and fresh-process read. Both the API and Vite proxy report connected. Anonymous database reads are rejected. Deployed rule-source inspection was unavailable. No local user projects were migrated or deleted; only the generated temporary test project was removed. Gemini live analysis remains unverified.

## Loading, verified invitations and transactional mail

37 automated tests and build pass. Live Firestore/Auth fixture tests passed for verified account lookup, pending access denial, wrong-account acceptance rejection, one-time acceptance, revocation, welcome deduplication and waiting-setup email status. Test records/accounts were removed. No actual emails were sent: sender/public app URL are not configured. Existing permissions are preserved and role notices are added on login.

Live tests also verified duplicate legacy membership synchronization creates one role notice. Mail templates were rendered in a browser; loading preview typography and animation were verified. Main preview reports Firestore connected and email delivery not configured.
