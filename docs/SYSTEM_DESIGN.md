# ScopeSathi backend protection

Requests pass through security headers, generated request IDs, an ingress rate limit, JSON size validation, verified authentication, per-user limits, project authorization and transactional revision checks.

## Limits

| Operation | Budget per backend instance |
| --- | --- |
| API ingress, before authentication | 600 requests/minute per socket IP |
| Authenticated API | 100 requests/minute per user |
| AI analysis | 8 requests/minute per user |
| Document upload and explicit manual/local preparation | 30 requests/minute per user |
| Invitation attempts | 10 requests/hour per user |
| Session initialization | 10 requests/minute per user |
| Forced connection checks | 6 requests/minute per user |

429 responses include Retry-After. Clients should wait and preserve their inputs rather than automatically replay mutations. Limits count unsuccessful attempts too.

The rate-limit store is in memory: counters reset on restart and are not shared across replicas. These protections are not global billing caps. A distributed store or gateway policy is required before scaling global quotas across multiple instances. Forwarded IP headers are deliberately not trusted; behind a proxy the ingress budget can be shared by multiple users. Configure a verified proxy boundary before changing this policy; never blindly trust arbitrary forwarded headers.

## Observability and lifecycle

Each API request receives a server-generated X-Request-ID and a structured completion log containing its route template, method, status and duration. Bodies, authorization headers, email addresses and query strings are excluded. Invalid JSON returns 400 rather than an internal server failure. API responses are not cached.

HTTP header reception is limited to 15 seconds, incoming requests to 60 seconds, and idle keep-alive to 5 seconds. These are transport limits, not cancellation of database or AI work. Shutdown stops accepting connections and allows 10 seconds for requests to drain.

Existing safeguards remain: bounded JSON/uploads, verified Google identity, owner/reviewer permissions, human approval, source quote validation, optimistic revisions and Firestore transactions. No automatic retries of non-idempotent writes were introduced.

## Remaining deployment works

Use platform monitoring and alerting and a distributed limiter before multiple replicas. The authenticated mail batch endpoint is implemented for Cloud Run; deploying its code does not create a Scheduler job or SMTP secret. Local polling remains process-bound. No infrastructure or paid service is provisioned by these changes.

## Cloud Run release configuration

The deployed service is `scopesathi-api` in `europe-west1`, with request-based billing, service min 0/max 1, concurrency 20 and a 60-second request timeout. These settings control capacity, not total spending. Firebase/Firestore data persists independently of container lifetime; in-memory rate counters reset on restart. The hosted mail worker is invoked through a Google OIDC-authenticated Scheduler request and processes one eligible message per invocation, instead of relying on background polling after a response. Scheduler and SMTP setup are pending until the owner applies and verifies them. See [release operations](CLOUD_RUN_RELEASE.md).
