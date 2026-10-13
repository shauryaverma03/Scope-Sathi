#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PROJECT_ID:?Set PROJECT_ID to an existing configured Google Cloud project}"
: "${GEMINI_MODEL:?Set GEMINI_MODEL to a supported Vertex AI model ID}"
: "${FIREBASE_WEB_CONFIG:?Set FIREBASE_WEB_CONFIG to the public Firebase web config JSON}"
REGION="${REGION:-asia-south1}"
SERVICE_ACCOUNT="scope-sathi-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
command -v gcloud >/dev/null || { echo 'Install the Google Cloud CLI first.'; exit 1; }
# Requires prior project, billing, API, Firestore, Auth and IAM setup. No IAM
# grants or API enablement are hidden inside this deployment command.
npm ci --no-audit --no-fund
npm run build
npm test
ENV_FILE=$(mktemp)
trap 'rm -f "$ENV_FILE"' EXIT
export PROJECT_ID GEMINI_MODEL FIREBASE_WEB_CONFIG
node --input-type=module - "$ENV_FILE" <<'JS'
import {writeFileSync} from 'node:fs';
const firebase=JSON.parse(process.env.FIREBASE_WEB_CONFIG);
if(firebase.projectId!==process.env.PROJECT_ID)throw new Error('Project IDs do not match.');
const env={APP_MODE:'google',GOOGLE_CLOUD_PROJECT:process.env.PROJECT_ID,GOOGLE_CLOUD_LOCATION:'global',GEMINI_MODEL:process.env.GEMINI_MODEL,FIREBASE_WEB_CONFIG:JSON.stringify(firebase)};
writeFileSync(process.argv[2],JSON.stringify(env));
JS
gcloud run deploy scope-sathi --project "$PROJECT_ID" --region "$REGION" --source . --service-account "$SERVICE_ACCOUNT" --env-vars-file "$ENV_FILE" --memory 1Gi --cpu 1 --min-instances 0 --max-instances 2 --concurrency 20 --timeout 60 --allow-unauthenticated
printf '\nCloud Run deployment complete. Add its hostname to Firebase Auth authorized domains.\n'
printf 'Firebase Hosting is optional; see docs/GOOGLE_SETUP.md.\n'
