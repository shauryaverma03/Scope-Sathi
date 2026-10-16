# Human review and user-benefit worksheet

[Evaluation method](AI_EVALUATION.md) · [Release checks](OWNER_RELEASE_STEPS.md)

This is an unfilled protocol, not evidence of accuracy or time saved. Automatic exact-label scoring cannot establish that an interpretation or clarification is useful.

## Semantic review

1. Run the held-out split only after model access works. Save provider, model, prompt version, commit, run date and case IDs.
2. Have a reviewer inspect the brief, current baseline, request and expected labels before seeing model output. Record label disagreements; have a second reviewer resolve them and retain original and adjudicated labels. Do not tune prompts on held-out briefs.
3. Reveal the output and fill one record per case. Keep failed calls in the denominator for reliability; report semantic scores separately on valid responses.

Copy this blank record for each case:

| Field | Observation to enter |
| --- | --- |
| Run / case / reviewer ID | Anonymized identifiers |
| Provider / model / prompt / commit | Exact configuration and source revision |
| Brief / baseline version | Evidence used for the decision |
| Expected kinds and requirement IDs | Independent labels; note adjudication |
| Actual kinds and requirement IDs | Include extra or missing findings |
| Evidence exists | Yes/no for each quote; retained-text line reference |
| Evidence supports interpretation | Yes/partly/no, with reason; existence alone is insufficient |
| Obligation preserved | Yes/no; identify lost or invented commitments |
| Clarification useful | Yes/partly/no/not applicable, with reason |
| Reviewer correction | None/minor wording/major semantic; retain before/after |
| Final decision | Accept proposal/edit/reject/clarify, with reason |
| Failure / latency / usage | Actual error, duration and available token counts |

Report missed changes, false alarms, wrong requirement matches, major edits and failures. Publish attempted and valid case counts, sample selection and disagreements. Do not turn a small synthetic benchmark into a calibrated confidence percentage.

## Preliminary usability study

Recruit consenting freelancers or small-team reviewers. Use synthetic cases or explicitly permitted, anonymized material. Give each participant two comparable cases: one manual review and one ScopeSathi review. Alternate method order and swap cases across participants to reduce practice effects. Reveal expected answers only after completion.

Tasks: locate the agreement, classify the request, find a missing obligation, ask a useful question, explain the decision to a client, then find the resulting version/task. For client-consent testing, use a second consenting account and distinguish quote acceptance from scope approval.

| Participant / case | Method and order | Time to agreement | Total review time | Missed obligations / false alarms | Major rewrites | Clarification usefulness | Friction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fill after observation | Manual or ScopeSathi | Actual seconds | Actual seconds | Counts and reasons | Count | Participant explanation | Observed behavior |

Keep consent records and identifiable recordings private. Share permissioned feedback and aggregated observations only. Describe this as a preliminary convenience sample, report sample size and limitations, and do not claim market validation or savings before collecting results.
