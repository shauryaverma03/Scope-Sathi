# Security and operations

[Documentation home](README.md) · [System protections](SYSTEM_DESIGN.md)

## Access boundaries

| Action | Owner | Reviewer | Editor | Viewer |
| --- | --- | --- | --- | --- |
| Read/export accessible project | Yes | Yes | Yes | Yes |
| Submit requests, manage tasks | Yes | Yes | Yes | No |
| Approve baseline, review proposals/decisions | Yes | Yes | No | No |
| Membership, deletion, revision policy | Yes | No | No | No |

Check server/domain.ts and route-level checks for exact actions. UI visibility is not authorization. Tokens must represent enabled, verified Google accounts; project membership is checked on the backend. Client Firestore rules deny direct access; Admin authorization depends on IAM and application checks.

## Existing controls

Helmet supplies CSP and browser headers. Mutations reject foreign browser origins. JSON/upload limits, Zod validation and source checks bound inputs. Optimistic revision checks stop lost updates. Invitations use verified identity, expiry and explicit acceptance. Generated request IDs connect errors to structured status/duration logs. See the dedicated limits guide for per-instance caveats.

## Secrets and repository publication

Keep Admin keys and SMTP password files outside the repository. Only their paths/configuration belong in ignored .env. VITE-prefixed variables are public build input: never use them for private credentials. Ignore rules do not untrack files or erase Git history.

Before publishing, inspect git diff --cached and staged filenames. If a secret has already been published, revoke/rotate it and handle repository history separately; deleting its current file alone is insufficient.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Login works, Firestore fails | Backend ADC/Admin credential and IAM; Google user sign-in is separate |
| Unauthorized domain | Firebase authorized hostname matches the actual app host |
| 409 on save | Reload latest revision, reconcile edits, then resubmit |
| 429 | Wait for Retry-After; do not loop retries |
| Invalid JSON | Fix request encoding; server returns 400 |
| Email waiting_setup | Sender, EMAIL_ENABLED, URL or explicit local-test configuration |
| Email sent but missing | SMTP accepted only; check spam/provider delivery |
| Email uncertain | Inspect sender/provider before retry; duplicate delivery is possible |
| Backend works locally, not hosted | Production mode, ADC roles, model access and server port |
| Upload has no text | Scanned PDF needs OCR outside the app |

Do not resolve failures by opening Firestore rules, suppressing permission checks or silently switching storage.

## Operations checklist

Use platform metrics for request errors/latency, process restarts, Firestore failures and outbox age. Current logs supply request metadata; there is no implemented monitoring dashboard, alert pipeline or metrics endpoint. /api/health reports process health, not database readiness.

Back up data using an explicitly chosen infrastructure policy and verify restores in isolation. User exports do not include every collection. No automatic backup/restore schedule is implemented. Shutdown drains HTTP connections for up to ten seconds; it does not guarantee completion of an in-flight mail job.

## Before scaling

Introduce shared rate budgets, bounded concurrency for expensive work, parser isolation, paginated reads and a durable triggered email worker. The existing timer may pause on scale-to-zero hosting. Add retention/purge policies for notifications and mail records. Evaluate AI accuracy with held-out cases. No Redis, Cloud Tasks, circuit breaker, distributed tracing or automatic scaling policy beyond deployment settings is claimed as implemented.
