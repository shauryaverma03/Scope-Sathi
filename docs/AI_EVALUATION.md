# AI evaluation and reproducibility

[Documentation home](README.md) · [QA report](HACKATHON_QA_REPORT.md)

The repository includes **32 synthetic change-review cases** across shopping, appointments, events and an agency website. Shopping and booking are calibration projects; events and the studio are held out as validation projects. Do not tune prompts against validation results and continue calling them held out. Version the dataset if it is reused for tuning.

Cases cover addition, modification, removal, already-included work, ambiguity, changing an exclusion, multiple findings and embedded instructions. Booking includes an original 30-minute agreement that was amended to 45 minutes, to exercise precedence of current approved scope over historical context. Labels are explicit test annotations, not established real-world ground truth.

## Run safely

`npm run eval:ai` prints a plan and makes **no model calls**. For a controlled run with privately configured credentials:

```sh
# Held-out set: 32 generation calls with comparison, before SDK retries.
npm run eval:ai -- --live --split validation --limit 16 --baseline --out .data/validation.json

# A distinct Vertex installation requires its own ADC, project, model access and billing.
npm run eval:ai -- --live --provider vertex --split validation --limit 1 --out .data/vertex-probe.json
```

These calls can incur provider charges. The runner never saves a project, sends email, changes `.env`, changes billing, or provisions resources. Setup, access, quota and billing errors stop the run; pending cases remain unattempted. It returns a nonzero exit code for failures or label mismatches. Keep raw reports private until inspected, even though these inputs are synthetic.

Each generation call permits up to two SDK transport attempts for selected transient errors, so a complete 32-call comparison can attempt up to 64 provider requests. A plan reports both counts; they are not a guaranteed token or monetary cap.

## What gets measured

- Exact agreement on finding kind and requirement reference, with no extra findings; required clarification cases must contain a question.
- Finding precision/recall **on schema- and evidence-validated responses**, plus a separate response-failure count and exact-match rate across attempts.
- Median and p95 duration of validated responses; no latency result is invented when every call fails.
- Provider-reported input/output tokens when available; missing usage is not treated as a complete cost estimate.
- Exact quote/reference validation and an unchanged-project check.
- Model, provider, prompt/schema version and completion time for successful calls.

The optional simple-prompt comparison uses the same model, schema and safety instruction, but a simpler task prompt. This is a limited comparison of prompts, not a benchmark against every competing product. Automatic scoring does not judge the relevance of a quote, faithful preservation of every obligation, useful clarification, or real-user productivity. Review the generated findings manually and record label disagreements before making an accuracy claim.

## Current results — 16 October 2026

**No usable model-quality score was obtained in this QA session.** The first Developer API run attempted 16 validation cases and a comparison for each; all 32 calls returned provider HTTP 402. After adding explicit billing-error handling and an early-stop guard, a repeat stopped after one failed call. One separate local-credential Vertex probe returned 403. These are provider/setup failures, not 0% semantic accuracy, and they do not establish whether the deployed Cloud Run runtime identity works.

Local schema, scoring, evidence, metadata and approval regression checks pass. The current live app reports Vertex configured and Firestore connected, but an authenticated live Vertex request must still be verified. See [the QA report](HACKATHON_QA_REPORT.md). Do not publish superiority, accuracy or time-savings claims from this blocked run.

## Real-user evaluation

Use the [human-review and usability worksheet](HUMAN_EVALUATION.md) to record semantic relevance, proposal rewrites, label disagreements and a paired manual/app comparison. It contains no invented results.

Use permissioned, anonymized examples and compare manual review with ScopeSathi. Record time to locate the relevant agreement, missed changes, false alarms, reviewer edits and clarification usefulness. Keep any small convenience sample clearly labeled as preliminary. No user-study results are supplied by this implementation.
