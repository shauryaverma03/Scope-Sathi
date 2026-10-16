# Owner steps to finish release verification

[QA report](HACKATHON_QA_REPORT.md) · [Cloud Run and email setup](CLOUD_RUN_RELEASE.md)

The local changes have not been committed, pushed or deployed by this task. Existing cloud health and database checks are not proof that the new features are live.

## 1. Review and push the changes

From the ScopeSathi repository, inspect `git status` and the diff. Run `npm test` and `npm run build`. Review the new QA report before pushing. Keep `.env`, private keys, raw local logs and SMTP credentials out of Git.

Suggested commit message: `feat: add evidence review reports, traceability and evaluation QA`.

The earlier improvements are present in commit `a022223`; inspect only the new working diff before making the next commit. Review the [proposal draft](../output/pdf/ScopeSathi-Hackathon-Proposal-2026-10-16.pdf) for current status and event requirements before submitting it.

Commit the intended source/documentation changes and push to the connected `main` branch. GitHub Actions will verify tests/build. Cloud Build will package the image, run the Docker test gate and deploy if successful. Open **Cloud Build → History**, select the newest build and verify its commit SHA. If it fails, inspect the failing step; use **Retry build** only after correcting the cause.

## 2. Verify the new Cloud Run revision

Open **Cloud Run → scopesathi-api → Revision History**. Confirm the intended new application revision receives traffic and has a successful build. Open the live URL and refresh the page. Check the worked-example button, Overview's next action and traceability, and a request's **Preview client report**. Console redeployment of an old image does not build new GitHub code.

## 3. Verify live AI before changing account settings

Sign in, create a disposable project and analyze a synthetic brief. Approve a baseline, submit an unfamiliar request, inspect evidence/questions, resolve it and verify approval/version/task impact. No model setting can replace this end-to-end check.

If it fails, use the error and Cloud Run request logs to distinguish:

| Symptom | Owner check |
| --- | --- |
| Access denied / 403 | Cloud Run **Security → Service account** should use the intended `scopesathi-runtime` account. In IAM, verify its existing `roles/aiplatform.user` grant, which may be displayed as Agent Platform User / Vertex AI User. Check Vertex AI API access, project/model availability and relevant organization restrictions. Do not solve this by granting Owner/Editor or publishing a private key. |
| Billing/payment / 402 | Check the provider/project actually used by the failing call, its active billing and applicable spending control. A Developer API failure is not automatically a failure of hosted Vertex. Do not disable all cost controls just to clear the message. |
| Quota / 429 | Inspect the selected service/model quota; wait for the indicated retry period or adjust a deliberately chosen limit. |
| Model/endpoint unavailable | Confirm the exact configured model is available to that project and location. Change configuration deliberately, then test again. |
| Timeout/busy | Preserve the draft, retry later or use the explicit manual path. Do not claim manual output came from Gemini. |

The QA session's local Developer API returned 402 and its local ADC Vertex probe returned 403. **Those probes did not use the Cloud Run runtime identity.** The public live configuration reports Vertex selected and Firestore connected; only your signed-in live test establishes actual model execution there.

After access works, rerun [the held-out evaluation](AI_EVALUATION.md) in an authorized environment with the correct provider credentials. Do not copy the production runtime key to a laptop. Inspect results before publishing quality claims.

## 4. Finish email only if advertising hosted delivery

The public live app reported `email.configured=false` during QA. Follow the exact [SMTP secret setup](CLOUD_RUN_RELEASE.md#configure-hosted-email-without-exposing-the-password) and [authenticated Scheduler instructions](CLOUD_RUN_RELEASE.md#scheduled-mail-with-scale-to-zero).

Use Secret Manager for the SMTP app password, grant runtime access only to the needed secret, configure the expected Scheduler OIDC identity/audience, and review queued recipients before enabling sending. Use a consenting test account to check an invitation, its deep link and recipient inbox. A `sent` queue state means SMTP submission, not guaranteed inbox delivery. No test email was sent by this development task.

## 5. Complete the interactive walkthrough

On desktop and mobile, verify sign-in/out, session persistence, project switching with unsaved edits, upload errors, evidence review, viewer/editor/reviewer boundaries, client quote acceptance, approval and task review. Check Tab/Escape and focus restoration in the tour, worked example, review and report preview. Save a report as PDF and inspect page breaks; verify default note exclusion. Download the existing JSON/CSV exports and inspect their content.

Use two consenting accounts for role/consent tests. The automated Firestore fixture verifies service behavior using synthetic actors; it does not substitute for Google popup sessions. Record failures in the QA report and reproduce before changing code.

## 6. Record and submit

Use the [three-minute recording script](SUBMISSION_WALKTHROUGH.md), prepare the proposal PDF, and add actual public video/proposal links. Replace pending status with evidence only after the corresponding check succeeds. Keep unsupported features and unmeasured capacity explicit.

After recording:

1. Upload the real demonstration to YouTube, Vimeo or Google Drive and allow viewing by your intended evaluators. Test access while signed out.
2. In Cloud Run, edit the service's **Variables & Secrets** and add `DEMO_VIDEO_URL` with the full HTTPS recording URL. Deploy the configuration change on the current application image. For local preview, add it to ignored `.env` and restart the API.
3. Open the signed-out home page and check **Watch the three-minute demo** opens the intended recording. Invalid or missing URLs hide the link; do not use a placeholder.
4. Add the same real URL to README and the event form. Application configuration does not edit GitHub or submit the form.
5. Fill the [human-evaluation worksheet](HUMAN_EVALUATION.md) after actual observations, then update the QA record with results and limitations.
