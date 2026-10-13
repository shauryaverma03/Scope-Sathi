# API reference

[Documentation home](README.md) · Source of truth: server/index.ts

All paths below start with /api. Google modes require Authorization: Bearer <Firebase ID token>, except health and config. Demo uses a loopback-only actor. JSON request bodies are capped at 350 KB. Do not embed tokens in URLs.

## Routes

| Method / path | Purpose |
| --- | --- |
| GET /health | Process health and runtime mode; not proof of database connectivity |
| GET /config | Public client config and actual connection status; no private keys |
| GET /connection | Authenticated forced connection check |
| POST /session | Initialize welcome/access notifications |
| GET /notifications | Current user's inbox |
| POST /notifications/:notificationId/decision | Accept or decline an invitation |
| GET /projects | List accessible projects |
| POST /projects | Create from name, client, description |
| GET /projects/:id | Load an accessible project |
| DELETE /projects/:id | Owner-only deletion |
| POST /projects/:id/document | Multipart file field; PDF/TXT text extraction |
| POST /projects/:id/extract | Extract draft requirements from brief |
| POST /projects/:id/intake | Save structured intake and optional brief |
| POST /projects/:id/baseline | Approve initial requirements and brief |
| POST /projects/:id/revision-policy | Owner updates includedRounds and definition |
| POST /projects/:id/rounds | Create a named round |
| POST /projects/:id/requests | Submit title, source, text, category, roundId |
| POST /projects/:id/requests/:requestId/reanalyse | Reanalyse pending request |
| POST /projects/:id/requests/:requestId/proposal | Save reviewed findings/grouping |
| POST /projects/:id/requests/:requestId/decision | Approve/reject/clarify with note and optional separateAgreement |
| POST /projects/:id/tasks | Create title and requirementIds |
| PATCH /projects/:id/tasks/:taskId | Update title, requirementIds and status |
| POST /projects/:id/members | Owner invitation; email, role, allowUnregistered |
| DELETE /projects/:id/members | Owner removes member by email |
| GET /projects/:id/invitations | Owner sees invitation delivery state |
| POST /projects/:id/invitations/:invitationId/revoke | Owner revokes pending invite |
| GET /migration | Preview explicit local-to-Firestore migration |
| POST /migration | Import one id and fingerprint from preview |
| POST /sample | Prepared local demo only |

Project edits generally require revision. Initial create, extraction/document reads and owner deletion have different contracts; follow the schemas in index.ts rather than assuming all routes are interchangeable.

## Example task update

```json
{
  "revision": 4,
  "title": "Review guest checkout",
  "requirementIds": ["REQ-001"],
  "status": "needs_review"
}
```

Use the revision returned by the last project response. After 409, reload and reconcile input rather than blindly retrying.

## Errors

| Status | Meaning / action |
| --- | --- |
| 400 | Invalid JSON/schema/upload or invalid domain input; correct input |
| 401 | Missing/expired session; sign in |
| 403 | Role/origin/access denied; do not retry as a different identity |
| 404 | Missing project/route |
| 409 | Stale revision, unresolved decision or unmet workflow prerequisite |
| 413 | Oversized body, brief or project |
| 429 | Rate limit; respect Retry-After |
| 500 | Unconfirmed operation; inspect state before retrying |
| 502 | Invalid/unavailable Gemini analysis |
| 503 | Database or identity service unavailable |

Responses generally expose error and optionally details. Every API request has X-Request-ID; malformed JSON and new limiter responses also include requestId in JSON. It is not yet a universal error-body field. Log route templates rather than bodies or tokens. See [limits](SYSTEM_DESIGN.md).

No general idempotency-key API exists. Revision checks protect many mutations, and invitation/welcome transactions provide specific deduplication. Avoid automatic replay of project creation, mail actions or ambiguous writes.
