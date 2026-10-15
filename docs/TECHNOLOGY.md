# Technology decisions: why and how

[Documentation home](README.md)

| Technology | Why used | How used / boundary |
| --- | --- | --- |
| React 19 | Interactive review UI | Components manage forms, comparisons, navigation and notifications |
| TypeScript | Shared contracts and earlier type errors | Client/server/shared code checked by tsc; runtime input still validated separately |
| Vite 6 | Local development and static bundling | Proxies /api in development; outputs dist for Express/Hosting |
| Node.js 22+ and Express 5 | One understandable backend | Async routes enforce identity, domain rules and storage |
| Firebase Authentication | Avoid storing passwords | Google popup returns ID tokens; backend validates verified Google identity |
| Firebase Admin SDK | Trusted server access | Token verification, account lookup and Firestore; private credentials never in browser |
| Cloud Firestore | Persistent shared state and atomic updates | Project transactions, users, notifications and mailOutbox |
| Google Gen AI SDK | Structured requirement analysis | Developer API in configured firebase mode; Vertex AI in google mode |
| Zod 4 | Validate untrusted input and model output | Request schemas, model JSON and runtime type checks |
| Multer | Bounded multipart intake | In-memory single-file upload capped at 2 MB |
| pdf-parse | Extract selectable PDF text | Parser reads text then is destroyed; no OCR |
| Nodemailer / Gmail SMTP | Styled transactional email | TLS SMTP submission with HTML and plain-text bodies |
| Helmet | Browser security headers | CSP, frame/object policies and popup-compatible opener policy |
| express-rate-limit | Bound request frequency | Socket ingress, user, analysis, invitations and connection budgets |
| dotenv | Local configuration | Loads ignored .env on backend |
| lucide-react | Consistent UI symbols | Icons throughout workspace |
| Node test runner / tsx | Test TypeScript without separate compilation | Domain and HTTP tests; optional live fixtures |
| Docker | Reproducible deployment packaging | Multi-stage Node build and runtime image |
| Cloud Run | Deployed frontend/API hosting | Serves Express + built React using attached service account |
| Firebase Hosting | Optional Google frontend address | Static dist and API rewrite to Cloud Run |
| GitHub and Cloud Build | Versioned changes with automated container releases | Pushes to main trigger a build/deploy; tests must be run before push or added as a CI step |
| Artifact Registry | Store the built container image | Build publishes images that Cloud Run revisions run; retained images can have storage costs |
| Secret Manager | Keep SMTP credentials outside Git and image layers | Runtime references a specific secret version; cloud setup required |
| Cloud Scheduler | Wake a mail batch while Cloud Run has request CPU | Planned authenticated five-minute HTTP schedule, one eligible job per invocation; cloud job setup required |
| google-auth-library | Verify the mail caller independently from browser users | Google-signed OIDC signature, audience and verified exact service-account email checks |
| Antigravity | Development tool named by project author | Not a production request dependency; no runtime integration is implied |

The repository also uses concurrently for local dev processes, Prettier for formatting, React's Vite plugin and package type definitions. package-lock.json pins the dependency tree; the grpc override should be reconsidered during Firebase upgrades.

## Why no direct browser database writes?

Central backend checks preserve reviewer authorization, quote validation and concurrent-edit protection. The supplied Firestore rules deny direct client access. Admin bypasses these rules, so application checks and IAM remain essential.

## Why optional AI?

The agreement must remain reviewable even without model credentials. Manual review and exact evidence remain useful; the app never labels prepared examples as live analysis.

## Why no Cloud Storage dependency?

The current product retains extracted text, not original uploaded files. No upload bucket is used despite a storageBucket field in Firebase's public configuration.

## Service status

Library presence and a stack illustration do not prove service connectivity. Settings probes Firestore; live AI needs credentials/model access; SMTP submission is not proof of inbox delivery. Cloud Run is deployed and browser loading/sign-in were verified by the owner; Firebase Hosting remains optional. Hosted email and Vertex calls need independent verification. See [current release setup](CLOUD_RUN_RELEASE.md). See [validation](VALIDATION.md).

## Infrastructure decisions

The [deployment rationale](DEPLOYMENT_DECISIONS.md) expands this table with every selected console setting and why it exists: instance bounds, concurrency versus rate limits, default utilization targets, request-based CPU, startup boost, region, public ingress, disabled VPC/session-affinity/mesh options, encryption, service accounts, budget alerts, service caps and release rollback. The [release guide](CLOUD_RUN_RELEASE.md) contains the actual setup procedure.
