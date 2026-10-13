# Connect ScopeSathi to Google Cloud

This guide describes the intended **google-mode deployment**, not a completed public deployment. A local installation can already use Firebase/Firestore independently. Inspect Settings for its actual connection state. React, Express and other open-source libraries are not separate hosting providers. See [architecture](ARCHITECTURE.md) and [configuration](CONFIGURATION.md).

## 1. Create your project

1. Open https://console.firebase.google.com/ and select the existing **scopesathi** project. Only create a project for a genuinely separate installation. Record its **project ID**, which differs from the display name. Use program credits only if actually provided.
2. Link billing for Cloud Run and Vertex AI. Set a budget alert in Cloud Billing. An alert is not a spending cap. No billing account is created or changed by this repository.
3. In Firebase Authentication, enable **Google** sign-in and select a support email. Add `localhost` and `127.0.0.1` to Authorized domains if you will test live authentication locally.
4. Create the default Cloud Firestore database in **production mode**. Choose your data location deliberately (for example a suitable India region); location is a project infrastructure choice, not a UI setting.
5. Under Project settings, register a web app. Copy its **public Firebase config** (apiKey, authDomain, projectId, appId, etc.). This config is intentionally sent to browsers; never put service-account private keys into it.
6. Enable Vertex AI and choose a currently available Gemini model supporting structured JSON output in your project. Model availability changes; `GEMINI_MODEL` is explicit rather than pinned to an ageing model. The SDK uses the `global` Vertex AI endpoint by default; choose a regional endpoint if you have residency requirements.

## 2. Configure the app

From this project directory:

```sh
npm run cloud:configure
```

This asks for the project ID, model ID and Firebase config, then writes ignored `.env` and project selection `.firebaserc`. It does not create cloud resources or send keys anywhere. Do not put secrets in `VITE_*` variables.

For local cloud-connected development, install the official Google Cloud CLI and authenticate with Application Default Credentials. Firebase Admin's end-user ADC caveat applies: prefer impersonating your runtime service account rather than copying a private key file. Follow Google's Firebase Admin setup documentation below. In Cloud Run, ADC uses the attached service account automatically.

Run `npm run dev` after configuring credentials. Use the same hostname that you authorised in Firebase Authentication. Local demo mode needs no Google account or credentials.

## 3. Prepare Google infrastructure (once)

Install the official Google Cloud CLI: https://cloud.google.com/sdk/docs/install

Set `PROJECT_ID` in your shell to your own project, and then:

```sh
gcloud auth login
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com aiplatform.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com --project "$PROJECT_ID"
gcloud iam service-accounts create scope-sathi-runtime --display-name 'ScopeSathi runtime' --project "$PROJECT_ID"
```

Grant this runtime service account the following project roles:

- `roles/datastore.user`: backend Firestore access.
- `roles/aiplatform.user`: Gemini requests through Vertex AI.
- `roles/firebaseauth.viewer`: user lookup for revoked-token verification.

Use the IAM console or the following pattern for each role:

```sh
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:scope-sathi-runtime@${PROJECT_ID}.iam.gserviceaccount.com" --role roles/datastore.user
```

The person/build identity deploying must also have the Cloud Run source-deployment, build and service-account-use permissions required by Google's source deployment guide. These depend on your organisation's policies; the deploy script does not grant broad roles or change IAM automatically.

Deploy deny-all direct-client Firestore rules. All app access is through the authenticated backend:

```sh
npx firebase-tools deploy --only firestore:rules --project "$PROJECT_ID"
```

The globally installed Firebase binary on this machine failed with an architecture error during initial inspection. Use a compatible Node-based `npx firebase-tools` installation, or reinstall the official CLI, rather than relying on that binary.

## 4. Deploy Cloud Run

Set these environment variables in your terminal (public config only):

```sh
export PROJECT_ID='your-project-id'
export GEMINI_MODEL='your-supported-model-id'
export FIREBASE_WEB_CONFIG='{"apiKey":"public-config-value","authDomain":"your-project.firebaseapp.com","projectId":"your-project-id","appId":"your-web-app-id"}'
bash scripts/deploy-google.sh
```

The script runs build and unit tests, then deploys via Cloud Build/Artifact Registry to **Cloud Run**, region `asia-south1`, using the dedicated runtime service account. The service serves both the React app and `/api`. It scales to zero with a two-instance ceiling; this reduces exposure but does not impose a monetary cap. Vertex AI requests still incur usage charges. The local demo is hard-blocked on Cloud Run.

The service URL must accept public browser traffic, but all project/API endpoints require Firebase ID tokens and enforce project membership and roles. Add the returned Cloud Run hostname to Firebase Auth authorised domains. Verify Google sign-in and one real Gemini request before calling the deployment complete.

## 5. Optional Firebase Hosting address

Cloud Run already serves the app. If you prefer a `web.app` URL:

1. Keep the service name `scope-sathi`. Update the rewrite region in `firebase.json` if you changed `REGION`.
2. Run `npm run build`.
3. Run `npx firebase-tools deploy --only hosting --project "$PROJECT_ID"`.
4. Verify sign-in and API calls through the Hosting URL. Firebase Hosting imposes a 60-second request limit; Gemini calls are bounded to 45 seconds in this app.

Teammates sign in with verified Google accounts. The owner invites their exact account email and role in Project settings. They must accept before gaining new access. Branded emails require the sender configuration described in [email setup](EMAIL_SETUP.md).

## Email deployment gap

The deployment script does not configure SMTP secrets or APP_PUBLIC_URL. Configure those separately through a secret store and the actual HTTPS app URL; disable EMAIL_LOCAL_TEST. The current 15-second polling worker is not a durable scheduler. Request-based CPU and scale-to-zero can delay mail indefinitely when no requests arrive. Before relying on hosted notifications, implement a durable triggered worker or deliberately provision continuously running processing with its cost implications. No such infrastructure is automatically created by this repository.

## Data and current limits

- Firestore stores project records, extracted source text, requests, tasks, decisions and immutable-by-workflow version snapshots.
- Original PDFs are processed in memory and discarded. Cloud Storage is intentionally unnecessary for the current workflow; there is no unimplemented upload bucket to configure.
- Inputs: PDFs/text up to 2 MB, extracted briefs up to 16,000 characters; new requests up to 12,000 characters.
- Prototype persistence uses one Firestore document per project, capped at 700 KB. Split into subcollections and paginated reads before large-team production use.
- Rate limits are per process. Before broad public use, add distributed quotas / Google Cloud abuse protection, cost monitoring and dedicated model evaluation.
- Project deletion removes its application record and history. Any separately enabled Google backups/retention policies are managed outside the app.

## Official references

- Firebase web setup: https://firebase.google.com/docs/web/setup
- Firebase Admin / ADC: https://firebase.google.com/docs/admin/setup
- Verified ID tokens: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Google Gen AI SDK: https://googleapis.github.io/js-genai/
- Cloud Run source deployment: https://cloud.google.com/run/docs/deploying-source-code
- Firebase Hosting with Cloud Run: https://firebase.google.com/docs/hosting/cloud-run
