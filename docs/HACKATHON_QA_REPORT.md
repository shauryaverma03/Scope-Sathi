# Hackathon readiness QA and developer fixes

Reviewed **16 October 2026**. Scope: local repository, isolated HTTP tests, synthetic Firestore workflow, public live-service health/config reads, and bounded model probes. This is not a claim that every feature has passed an interactive production walkthrough.

## Release assessment

**Local automated verification passes. Hosted AI, hosted email and interactive browser/print verification remain release checks.** Existing Cloud Run code is separate from this unpushed local change. No cloud IAM, billing, Scheduler, SMTP configuration, deployment, real-client project or outgoing message was changed.

## Implemented improvements

Latest local follow-up (after commit `a022223`): source-passage navigation and client guidance are now formatted and regression-tested; traceability includes saved reviewer and current/stale round consent. An optional validated public recording link, blank human-evaluation protocol and illustrated proposal draft complete the submission materials. No recording or human-study result has been invented.

| Improvement | Behavior |
| --- | --- |
| Client change report | Preview saved findings, evidence, historical wording, current linked tasks, decision and round quote; print or save PDF through the browser |
| Report privacy | Decision notes excluded by default; member lists, invoice references and internal activity logs omitted; React escapes content |
| Wording comparison | Bounded word diff preserves both texts and marks additions/deletions; historical reports use the request's baseline version |
| Traceability | Inspect saved request → requirement → decision → currently linked work; new approvals record their resulting version explicitly |
| Next action | Guides users toward a baseline, stale comparison, question, client quote response, pending decision or affected task |
| Worked example | Public, interactive explanation; explicitly no live AI, no data saved and no authorization bypass |
| AI provenance | Server-owned provider/model/prompt/schema version, timestamp, duration and available token counts; no confidence percentage |
| AI context precedence | Current approved requirements explicitly outrank superseded wording in the original brief |
| Notification polling | Pauses in hidden tabs, refreshes when visible, prevents overlapping automatic polls and discards late effect responses |
| Release checks | GitHub CI verifies tests/build; Docker packaging also requires tests to pass |
| Evaluation tooling | 32 synthetic cases, project-level held-out split, optional simple-prompt comparison, honest failure and metric reporting |

## Executed checks

| Area | Evidence / result |
| --- | --- |
| Automated regression suite | 91 tests passed, zero failed/skipped in the latest follow-up; includes isolated HTTP and server-rendered UI checks |
| TypeScript and production bundle | Pass; dependency annotation warnings are non-fatal |
| Production dependency audit | Previous QA session: zero known vulnerabilities reported by `npm audit --omit=dev`; not rerun for this follow-up or a security guarantee |
| Firestore | Previous QA session: disposable create, baseline, request, quote, client acceptance, approval, invoice-reference, amendment, task update, outsider denial and fresh-process read pass; fixture cleaned up. Not repeated for this follow-up |
| Public deployed health | `ok: true`, `mode: google` |
| Public deployed configuration | Firestore `connected`, AI `vertex`, model `gemini-3.5-flash-lite`; email sender `configured: false` |
| Developer API model quality | Blocked: initial 32 attempted calls returned HTTP 402; no validated responses or accuracy result |
| Provider-failure stop guard | Repeated run planned 16 cases but stopped after the first billing failure |
| Local ADC Vertex probe | Blocked: one synthetic call returned HTTP 403; does not test Cloud Run's separate runtime identity |
| Evaluation dry run | Plans calls without sending them; synthetic labels/splits and score handling tested |
| Documentation | Local targets, image references, code fences and diff whitespace checked |
| Proposal PDF | Three pages, architecture image, embedded fonts and all rendered pages visually inspected; draft labels preserve pending checks |

Follow-up regressions verify exact retained-text line ranges, repeated matches, missing evidence and HTML escaping; client-only guidance and stale quote handling; optional recording URLs reject non-HTTPS, credentials and lookalike domains. Source navigation is not included in client reports, so whole source documents are not added to the export. These checks do not exercise actual browser scrolling or external video access.

## Feature coverage

| Feature family | Automated / service coverage | Still requires interactive verification |
| --- | --- | --- |
| Google identity and project permissions | Missing/forged tokens, verified-session handling, roles, isolation and access revocation | Real popup sign-in/out, persistence and multiple real accounts on the new release |
| Intake, text and PDF extraction | Drafts, frozen intake, limits, real text-PDF fixtures, metadata cleanup, numbered clauses, invalid uploads | File-picker interaction, unfamiliar layouts, live model extraction; scanned PDF OCR is unsupported |
| AI review | Schema, quotes, references, ambiguity gates, timeouts, model metadata and failure messages | Successful hosted model requests, semantic evaluation and usefulness |
| Proposals and decisions | No silent mutation; stale revision/baseline, duplicate decisions, reviewer authorization, multiple findings and preserved versions | Complete two-account interaction on deployed revision |
| Task impact | Linked-work flags, task planning, edit/status rules, required review notes | Narrow-screen board and keyboard actions |
| Revision rounds and pricing | Allowance, grouping, corrections, current consent, fixed accepted rates, client permissions and invoice prerequisites | Designated-client consent through actual Google sessions |
| Invitations and notifications | Identity, expiry, acceptance, revocation, templates and queue/authorization tests | Hosted Scheduler/SMTP delivery and recipient inbox; no outgoing mail tested |
| History and exports | Preserved history, structured exports and component rendering | Actual downloads and print-to-PDF pages |
| New report and traceability | Historical baseline, task links, stale quote labels, default note exclusion and escaped HTML | Browser print margins/page breaks, focus restoration and mobile layout |
| Tour and worked example | Rendering and labeled sample behavior; source-reviewed focus/scroll handling | All steps, Escape/Tab and mobile presentation |
| Backend protections | Origin rejection, limits, retry metadata, schemas, upload bounds and concurrent revisions | Sustained load, distributed quotas and operational recovery |

Browser automation was unavailable in this workspace following an earlier browser-control policy rejection. No alternate browser automation route was used. Server-rendered component checks and HTTP tests do not substitute for a browser walkthrough; those checks remain explicitly open.

## Findings and developer fixes

| ID | Finding | Resolution / regression |
| --- | --- | --- |
| HQA-01 | No client-readable change artifact | Added report preview and print styling; saved content only, with note opt-in |
| HQA-02 | A report could incorrectly show today's amended clause as the old agreement | Reads the version referenced by the request; missing historical data is labeled; tested after approval |
| HQA-03 | Model-suggested task IDs alone omit deterministically linked work | Unions explicit task IDs with requirement links, matching approval impact; tested with omitted model task IDs |
| HQA-04 | Nested report keyboard events could reach the underlying dialog | Preview traps focus locally and stops key propagation; interactive verification remains open |
| HQA-05 | Successful analysis did not retain model-run provenance | Server assigns validated metadata; forged model-supplied provenance is overwritten; tested |
| HQA-06 | HTTP 402 surfaced as a generic analysis failure | Distinct billing/payment recovery message preserves draft and manual path; tested |
| HQA-07 | Initial evaluator repeated account-level failures | Added early stop for billing/access/quota/model-availability failures; observed one-call stop after fix |
| HQA-08 | Deployed image build did not run tests | Added Docker test gate and GitHub verification workflow; no hosted CI execution claimed before push |
| HQA-09 | Reanalysis checked an outdated project revision only after generation | Added revision preflight before spending a model call; transaction check remains authoritative |
| HQA-10 | Original brief can contain superseded obligations | Added current-baseline precedence instruction and synthetic amended-agreement fixture; semantic live verification remains blocked |
| HQA-11 | New metadata return typing initially broke the injectable extraction test contract | Preserved the extraction generator contract; TypeScript and extraction regressions pass |
| HQA-12 | A new fresh-process assertion assumed the oldest request was first; amendments are prepended | Fixture now checks the original request and amendment by their baseline versions, verifying result versions 2 and 3 separately |

## Open release checks

1. **Hosted AI:** owner confirms a fresh authenticated request on the deployed app, then deploys and tests this new revision. Local 402/403 do not identify the deployed account's exact failure state. Inspect the relevant provider's billing, API access, model availability and runtime permissions before rerunning evaluation. No permission or spending cap was relaxed.
2. **Email:** live app reports sender unconfigured. Follow [release setup](CLOUD_RUN_RELEASE.md), review recipients and verify Scheduler/SMTP before advertising hosted delivery. Pending in-app notifications do not require SMTP.
3. **Interactive QA:** desktop/mobile, two-account consent, tour, project switching, downloads and report printing. Use a disposable project and the checklist above.
4. **Evaluation:** rerun held-out cases after provider access works, manually judge evidence relevance and wording preservation, and publish actual results. Blocked calls are not an accuracy score.
5. **Submission evidence:** record the actual three-minute demo and supply the proposal PDF. No video, user study, load benchmark or verified production SLA was created by this task.

The prototype still uses whole-project storage and process-local rate limits. Pagination, distributed quotas, backup/retention operations and higher mail throughput are growth work, not completed claims. See [system design](SYSTEM_DESIGN.md) and [submission script](SUBMISSION_WALKTHROUGH.md).

## Reproduce

```sh
npm test
npm run build
npm audit --omit=dev
npm run eval:ai
# Requires privately configured Admin credentials; creates/deletes a disposable fixture:
npm run test:firestore
```

[Machine-readable results](qa-results-2026-10-16.json). Local evidence logs are ignored by Git: `.data/qa-hackathon-tests.log`, `.data/qa-hackathon-build.log`, `.data/qa-hackathon-audit.json`, `.data/qa-ai-validation.json`, `.data/qa-ai-preflight.json`, `.data/qa-hackathon-firestore.log`, and `.data/qa-vertex-probe.json`. In this macOS workspace, set `TMPDIR="$PWD/.data/runtime-tmp"` when running Node tests.

For the remaining account and deployment operations, follow [owner release steps](OWNER_RELEASE_STEPS.md).
