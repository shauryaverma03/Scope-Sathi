# ScopeSathi QA audit — 15 October 2026

Latest improvement pass: [16 October hackathon QA report](HACKATHON_QA_REPORT.md) records 88 tests, current service probes, developer fixes and open release checks. Entries below describe earlier QA snapshots.

[Documentation home](README.md)

## Result and limits

73 automated tests pass. TypeScript/production build, live Firestore persistence and live Firebase invitation fixture checks pass. The production dependency audit reports zero known vulnerabilities at this run.

This covers API workflows, failure paths, roles, component rendering, code inspection and disposable live fixtures. It is **not a completed browser end-to-end audit**: browser automation was previously policy-blocked. Real Google popup sign-in, current desktop/mobile interactions, screen-reader use, public deployment and recipient inbox delivery remain unverified in this run.

No user baseline was modified by testing. Temporary live fixtures were removed. The main mail worker was stopped during the expanded invitation fixture run, and fixture email delivery was disabled. No test emails, commits, pushes, payments or deployments were performed.

## Bug register

| ID | Severity | Reproduction / observed result | Fix and verification |
|---|---|---|---|
| QA-001 | Medium | Repeated uploads and local extraction consumed the shared eight-request AI budget. HTTP regression reproduced 429 on the seventh additional local attempt. | Separate 30/min document/manual budget and 8/min AI budget. Regression exhausts AI quota, then performs ten local extractions successfully. |
| QA-002 | Medium | Rendering a pending manual request for viewer/editor exposed editable controls, although the backend rejected saves. Regression failed before the fix. | Editing now requires reviewer permission and pending status. Reviewer/editor/viewer rendering regression passes. |
| QA-003 | High | State inspection: task-plan preview in A could retain titles after switching to B with shared REQ IDs. Settings and request filters also retained state. | Project-keyed Tasks, Requests, Settings and request form reset drafts. Revoked writers cannot retain a task creation preview. Build checked; browser interaction pending. |
| QA-004 | Medium | Configured Gemini exposed only AI submission for new change requests, blocking manual recovery on provider failure. | Added explicit Manual review selection, correctly labelled no-AI output. HTTP regression proves pending clarification and unchanged baseline/versions; rendered recovery option verified. |
| QA-005 | Low | Source inspection: submit remained enabled during revised-document upload, allowing submission of old text. | Disabled and guarded submission while uploading. Build checked; slow-upload browser interaction pending. |
| QA-006 | Medium | Removing access revoked the project's invitation but could leave its notification pending; a deleted project also left stale queue eligibility. | Inbox reconciles against the authoritative project. Mail worker checks project, invitation state and expiry. Unit tests cover revoked/missing/deleted/expired cases; live inbox fixture verifies access removal displays revoked. No SMTP delivery claim. |
| QA-007 | Medium | A live guest-checkout probe was classified as an addition despite mandatory sign-in. Valid evidence did not guarantee correct classification. | Strengthened the general obligation-versus-addition rule. Follow-up live probe identified modification of REQ-001. Broader model accuracy still needs evaluation. |

QA-001 and QA-002 have failing-before/passing-after regressions. QA-003 and QA-005 are code-inspection findings, not browser reproductions. QA-007 is a model-quality improvement, not a guarantee that prompt changes eliminate semantic mistakes.

## Feature coverage

| Area | Evidence | Result / limit |
|---|---|---|
| Startup and modes | Demo/Firebase startup, production refusal of local modes, missing credential handling | Automated pass |
| Identity and roles | Missing/forged tokens, disabled sessions, outsider denial, owner/reviewer/editor/viewer checks | Automated/live backend pass; real popup untested |
| Projects | Create/list/read/update/delete, identity isolation, stale revisions | HTTP/store/live persistence pass |
| Intake and scope | Drafts, structured intake, exact quotes, explicit approval, immutable versions | Automated pass |
| Uploads | Sunday Store PDF/TXT, unsupported extension, fake PDF, empty/oversized uploads | HTTP pass; failures preserve project |
| Extraction | Six complete features, separate headings/footer, wrapped boundaries, no implicit approval | HTTP and live Gemini pass |
| AI resilience | Deadline, stalled cancellation-resistant transport, schema/source validation, manual recovery | Automated pass; provider uptime not guaranteed |
| Requests and decisions | Multiple findings, change kinds, stale baseline, reanalysis, question gate, reject/clarify, reviewer permissions | Automated pass; interpretation requires review |
| Tasks | Plan validation, requirement links, affected-task flags, review notes, obsolete links | Domain/API/component pass; project-switch browser test pending |
| Pricing | Included rounds, grouping, corrections, separate agreement, client consent, stale quotes, invoice prerequisites | Automated/live Firestore pass; no payment collection |
| Collaboration | Account lookup, matching recipient, pending denial, expiry/revocation, welcome deduplication, access removal | Unit/live Firebase pass |
| Email | Escaping, styled/plain-text templates, queue states, stale-invitation guards | Unit/live state pass; SMTP/inbox untested |
| History and exports | Preserved versions, reasons, JSON/CSV source inspection, archive regions | Component/source/domain checks; download interaction untested |
| Protections | Origin rejection, retry headers, malformed JSON, size limits, concurrency, secret isolation | Automated pass; instance-local limits |
| Onboarding/layout | Tour/focus/storage and recent spacing fixes inspected | Current visual/keyboard/mobile walkthrough pending |

## Live AI observations

Model: gemini-3.5-flash-lite. The original synthetic Sunday Store PDF returned six source-validated requirements. A vague “Make checkout easier.” request produced clarification. Analysis left the in-memory project unchanged. The first specific checkout request exposed QA-007; after strengthening the instruction, a follow-up identified a modification targeting REQ-001 and retained review questions.

These are smoke checks, not an accuracy benchmark. A labelled held-out set is still needed for conflicting briefs, multilingual input, embedded malicious instructions and larger projects. Scanned PDFs still require external OCR.

## Re-run and evidence

Run npm test and npm run build from the repository root. In this workspace use TMPDIR="$PWD/.data/runtime-tmp" before each command.

Live persistence: npm run test:firestore. Invitation fixtures: npm run test:invitations, **with the main API/mail worker stopped first**. The fixture disables delivery only in its own process; independent mail workers must not consume temporary records.

Local logs: .data/qa-tests.log, .data/qa-build.log, .data/qa-firestore.log, .data/qa-invitations.log and .data/qa-dependency-audit.json. The quota and permission reproduction logs retain the original failures. These logs are ignored by Git.

## Remaining release checks

1. On desktop/mobile, test actual sign-in/out, refresh, tour, focus and keyboard navigation.
2. Preview work in A, switch to B and verify draft reset; repeat for settings/delete confirmation and request filters.
3. Simulate slow upload and verify submission remains disabled.
4. Download and inspect baseline/history JSON and task CSV.
5. After deployment, verify authorized domains, invitation deep links and welcome/invitation inbox delivery using consenting test accounts.
6. Evaluate Gemini on held-out labelled requests; keep evidence validation and explicit approval.
7. Configure and verify the supplied authenticated Scheduler mail endpoint before hosted email use; add a shared limiter before scaling. Local polling and rate counters remain process-local.

## Manual-test follow-up: QA-008

The supplied screenshot showed a failed pricing-settings message inside a newly opened change-request dialog. Root cause: every dialog read the same unscoped global error string. Dialogs now record the error sequence at opening and display only failures produced afterward. A repeated identical error from a new submission still appears because errors have distinct sequence numbers. The prior message can remain on its original page; it is not treated as a new request failure. Rendered-component and sequence regressions pass. The paid-round validation itself remains correct: a positive rate needs a finite allowance and a separate designated client with accepted access. Browser interaction remains unverified.

## Deployment-link follow-up — 16 October 2026

The owner verified Cloud Run loading and sign-in on 15 October. This release aligns deployment names, hosting rewrites and email origins; SMTP delivery remains pending cloud secret and Scheduler setup. New tests cover Google OIDC identity rejection, public-origin audience verification, sender readiness and live links across all four email types. No outgoing email or cloud mutation was performed. See [release steps](CLOUD_RUN_RELEASE.md).

Release verification: **57 local tests passed** across mail identity/link checks, extraction, approvals, pricing, persistence and component rendering; production build and deployment-script syntax checks passed. HTTP-listener suites, live SMTP/Scheduler and live Vertex calls were not rerun for this release.
