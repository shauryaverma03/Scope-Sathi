# Submission and three-minute demonstration

[Documentation home](README.md) · [Evaluation](AI_EVALUATION.md) · [QA report](HACKATHON_QA_REPORT.md)

ScopeSathi helps freelancers and small software teams decide how a client request affects agreed work. Its distinctive sequence connects exact evidence, clarification, client consent where required, reviewer approval, version history and task impact.

## Prepare the demonstration

Use a disposable project and synthetic brief. Verify model access in the deployed app before recording. Use a second consenting Google account if showing client consent. Do not expose credentials, personal billing screens, unrelated projects or recipient emails. Never present the built-in worked example as live AI.

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:20 | Clear target user and client request | Requests arrive after an agreement; teams need a traceable decision |
| 0:20–0:45 | Brief, reviewed extraction and baseline | Gemini structures text; a person confirms the agreement |
| 0:45–1:25 | An unfamiliar request, exact evidence and wording diff | Show a real live analysis, its affected requirement and unresolved questions |
| 1:25–1:50 | Resolve questions; optional current quote acceptance | Client commercial consent and reviewer scope approval are separate |
| 1:50–2:20 | Approve; inspect version and affected task | Earlier wording survives; affected work needs explicit review |
| 2:20–2:40 | Traceability and printable change report | Show the artifact a client can inspect and save |
| 2:40–3:00 | Architecture, verified results and limitations | Cloud Run, Firebase, Firestore and Vertex; measured evidence only |

This is a recording script, not a claim that a video has been recorded. Do not include a placeholder video link. After recording, publish the permitted public video and add its actual URL near the README's live-app link.

## Proposal PDF content

A [three-page illustrated draft](../output/pdf/ScopeSathi-Hackathon-Proposal-2026-10-16.pdf) is prepared, including target user, workflow, architecture, tradeoffs and current verification limits. It is a draft, not a completed submission. Regenerate after results change with `python3 scripts/create-proposal.py` (requires ReportLab and Ubuntu-R/Ubuntu-B fonts; set `PROPOSAL_FONT_DIR` to their directory if outside the bundled runtime). Inspect regenerated pages before publishing.

Describe the target user, one concrete problem, the end-to-end solution, why GenAI is useful, the evidence/approval boundary, architecture, measured evaluation results, operating tradeoffs, differentiation and next steps. Identify **Future of Work & Enterprise Productivity**. Verify current requirements in the event dashboard and [official challenge page](https://aibuildercup.com/themes.html).

Explain why an ordinary prompt plus a spreadsheet lacks the connected authorization, revision checks, client consent and persistent task/decision trail demonstrated here. Do not claim legal determination, payment collection, measured savings, production scale, or model accuracy that has not been tested.

## Release order

1. Resolve all applicable blockers in the QA report.
2. Review the diff and run `npm test` and `npm run build`.
3. Commit and push the intended changes to `main`; the Docker build now runs tests before packaging, and the GitHub verification workflow provides another check.
4. Verify Cloud Build's commit and new Cloud Run revision. A successful local build does not deploy these files.
5. Complete desktop/mobile, two-account and print-to-PDF checks on that revision.
6. Record the demo and add the real video/proposal URLs to the submission.

No deployment, video publication or competition submission is performed by preparing this guide.
