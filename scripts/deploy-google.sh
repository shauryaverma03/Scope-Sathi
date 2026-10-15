#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PROJECT_ID:?Set PROJECT_ID to an existing configured Google Cloud project}"
: "${GEMINI_MODEL:?Set GEMINI_MODEL to a supported Vertex AI model ID}"
: "${FIREBASE_WEB_CONFIG:?Set FIREBASE_WEB_CONFIG to the public Firebase web config JSON}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-scopesathi-api}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-scopesathi-runtime@${PROJECT_ID}.iam.gserviceaccount.com}"
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
const publicURL=process.env.APP_PUBLIC_URL || (process.env.PROJECT_ID === 'scopesathi' ? 'https://scopesathi-api-112358672382.europe-west1.run.app' : '');
if(!publicURL)throw new Error('Set APP_PUBLIC_URL for this installation.');
const url=new URL(publicURL);
if(url.protocol!=='https:' || url.username || url.password || ['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('APP_PUBLIC_URL must be a public HTTPS origin.');
const env={APP_MODE:'google',GOOGLE_CLOUD_PROJECT:process.env.PROJECT_ID,GOOGLE_CLOUD_LOCATION:'global',GEMINI_MODEL:process.env.GEMINI_MODEL,FIREBASE_WEB_CONFIG:JSON.stringify(firebase),APP_PUBLIC_URL:url.origin,EMAIL_LOCAL_TEST:'false'};
writeFileSync(process.argv[2],JSON.stringify(env));
JS
# Update the named settings only; preserve SMTP variables and secret bindings.
ENV_UPDATES=$(node --input-type=module - "$ENV_FILE" <<'JS'
import {readFileSync} from 'node:fs';
const env=JSON.parse(readFileSync(process.argv[2],'utf8'));
const delimiter='__SCOPESATHI_ENV__';
if(Object.values(env).some(v=>v.includes(delimiter)))throw new Error('Reserved delimiter in configuration');
process.stdout.write('^'+delimiter+'^'+Object.entries(env).map(([k,v])=>k+'='+v).join(delimiter));
JS
)
gcloud run deploy "$SERVICE" --project "$PROJECT_ID" --region "$REGION" \
  --source . --service-account "$SERVICE_ACCOUNT" \
  --update-env-vars "$ENV_UPDATES" --memory 512Mi --cpu 1 \
  --min-instances 0 --max-instances 1 --concurrency 20 --timeout 60 \
  --allow-unauthenticated
printf '\nCloud Run deployment complete. Add its hostname to Firebase Auth authorized domains.\n'
printf 'Firebase Hosting is optional; see docs/GOOGLE_SETUP.md.\n'
