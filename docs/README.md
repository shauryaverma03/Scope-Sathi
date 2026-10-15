# ScopeSathi documentation

**Clarity before commitment.** What the product does, why its components exist, and how to operate it.

![ScopeSathi home page](images/home.jpg)

Deployment links updated on **16 October 2026**. The owner verified public loading/sign-in on 15 October; hosted email and live AI require separate checks. Screenshots are actual earlier development captures using demonstration data; they do not establish current cloud connectivity.

| Guide | Contents |
| --- | --- |
| [Owner release steps](OWNER_RELEASE_STEPS.md) | Remaining deployment, account setup and manual checks |
| [Hackathon QA report](HACKATHON_QA_REPORT.md) | Executed checks, developer fixes and open release blockers |
| [AI evaluation](AI_EVALUATION.md) | Synthetic dataset, held-out scoring and blocked live results |
| [Submission walkthrough](SUBMISSION_WALKTHROUGH.md) | Three-minute recording script and release checklist |
| [Product guide](PRODUCT_GUIDE.md) | Illustrated intake, approvals, revision rounds, tasks and onboarding |
| [Deployment decisions](DEPLOYMENT_DECISIONS.md) | Every cloud setting, its reason, tradeoffs, costs, verification and growth plan |
| [Architecture](ARCHITECTURE.md) | Components, trust boundaries, sequences and tradeoffs |
| [Technology decisions](TECHNOLOGY.md) | Why and how each major library/service is used |
| [Data model](DATA_MODEL.md) | Collections, aggregates, history and migration |
| [API reference](API.md) | Endpoints, identity, revisions and errors |
| [AI workflow](AI_WORKFLOW.md) | Gemini, manual mode, exact quotes and human review |
| [Security and operations](SECURITY_OPERATIONS.md) | Roles, secrets, recovery and production gaps |
| [System protections](SYSTEM_DESIGN.md) | Rate limits, logging, timeouts and shutdown |
| [Local Firebase setup](FREE_SETUP.md) | Local backend with Google services |
| [Email setup](EMAIL_SETUP.md) | Sender, invitations and delivery states |
| [Live release and hosted email](CLOUD_RUN_RELEASE.md) | Current Cloud Run URL, update workflow, SMTP secrets and scheduled delivery |
| [Google deployment](GOOGLE_SETUP.md) | Cloud Run, Hosting, IAM and limitations |
| [Configuration](CONFIGURATION.md) | Modes and environment variables |
| [QA audit and bug register](QA_REPORT.md) | Reproductions, fixes, feature coverage and remaining release checks |
| [Validation](VALIDATION.md) | Test coverage and historical verification |
| [Contributing](CONTRIBUTING.md) | Checks, screenshots and safe publication |

Implemented does not mean configured. Past service verification must be repeated after environment changes. Deployment files are not evidence of a successful public deployment. See [image provenance](images/README.md).

## Visual architecture

![ScopeSathi cloud architecture and pending mail setup](images/cloud-architecture.png)

*Start with the [architecture explanation](ARCHITECTURE.md), [scaling decisions](DEPLOYMENT_DECISIONS.md#how-autoscaling-behaves-here), or [illustrated release steps](CLOUD_RUN_RELEASE.md#update-the-live-site). Generated illustration; see [image provenance](images/README.md).*

## Revision pricing

[Configure the allowance and cost meter](REVISION_PRICING.md): client consent, scope approval, fixed accepted rates and invoice references.
