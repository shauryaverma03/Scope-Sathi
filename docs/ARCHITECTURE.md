# ScopeSathi architecture

## Request path

Browser → Firebase Google sign-in → Firebase ID token in Authorization header → Cloud Run API verifies token and revocation → project membership/role check → validated action → Firestore transaction.

For AI work: authorised request → current approved baseline and existing tasks → Vertex AI Gemini structured JSON → Zod validation → exact passage/ID checks → save a pending request. No AI tool can update the baseline or grant permissions.

For approval: reviewer + current project revision + current baseline version + resolved questions → apply reviewed changes → append baseline snapshot → flag linked tasks → append decision event, all in one transaction. Concurrent requests with an old revision receive 409. AI analysis occurs outside transactions to avoid repeated model calls on transaction retry.

## State transitions

- Project without baseline → extraction draft (browser only) → explicit reviewer approval → baseline version 1.
- New request → pending.
- Pending → approved / rejected / clarification (terminal decision).
- Pending on an older baseline → reanalysis → pending against current baseline.
- Clarification response → a new request, preserving the earlier decision.
- Approved scope change → a new immutable-by-workflow version and affected tasks marked `needs_review`.
- Reviewer/editor confirms task wording and status → normal task workflow.

## Permission boundaries

Owner controls membership and deletion. Reviewer approves baselines and changes. Editor creates requests and manages tasks. Viewer only reads/exports. Verified Google account emails bind invitations to users. No invitations are emailed. Direct browser Firestore access is denied by rules; backend Admin SDK permissions require application-level checks.

Local demo has one loopback-only actor and JSON persistence. It is refused on Cloud Run or when NODE_ENV=production. It does not offer actual collaborative authentication or live AI. Known sample analysis is labelled as such; unknown requests require manual clarification.

## Limits to address before production

- One project per Firestore document (700 KB application cap). Move requests/events/versions to subcollections and add pagination for growth.
- Per-instance in-memory rate limits. Add distributed per-user/project budgets and an edge rate limiter for broad public deployment.
- AI source substring checks establish that a quote exists, not that the interpretation is correct. Evaluate semantic accuracy on held-out examples.
- The app does not infer approvals from client messages, determine contractual authority, estimate prices, or modify source code.
- Original uploads are discarded after text extraction; retain permitted documents in Cloud Storage only if a later feature requires originals.
- PDF parsing happens in-process and is limited to 2 MB. Harden parser isolation, malware handling and compute limits before accepting arbitrary public uploads at scale.
- No live Google Cloud deployment or model call has been verified until project credentials and infrastructure are supplied.
