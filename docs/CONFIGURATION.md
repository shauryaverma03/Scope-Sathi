# Configuration reference

[Documentation home](README.md)

Keep private values in ignored .env locally or a deployment secret store. Never copy a configured .env over an existing installation. .env.example is a placeholder template.

| Variable | Purpose and handling |
| --- | --- |
| APP_MODE | demo, firebase or google; google required in production |
| PORT | Backend listen port; Vite proxy reads the configured port |
| STORAGE_BACKEND | firestore enables cloud persistence in firebase mode; google always uses Firestore |
| SCOPESATHI_DATA_DIR | Explicit local data directory, useful for isolated tests |
| GOOGLE_CLOUD_PROJECT | Project ID, not display name; must match Firebase config |
| FIREBASE_WEB_CONFIG | Public Firebase client JSON; intentionally sent to browser |
| GOOGLE_APPLICATION_CREDENTIALS | Path to private Admin JSON outside repository; omit with suitable ADC |
| GOOGLE_CLOUD_LOCATION | Vertex location; defaults to global |
| GEMINI_MODEL | Explicit available model; required in google mode |
| GEMINI_API_KEY | Private Developer API credential for firebase mode |
| EMAIL_ENABLED | Enables the backend mail worker |
| EMAIL_LOCAL_TEST | Allows local firebase-mode mail without public URL; not a production option |
| APP_PUBLIC_URL | Reachable HTTPS application address for email links |
| SMTP_HOST, SMTP_PORT | Sender host/port; Gmail setup uses TLS on 465 |
| SMTP_USER, SMTP_PASS | Private SMTP account and app password |
| EMAIL_FROM | Sender identity shown in mail |
| NODE_ENV, K_SERVICE | Runtime deployment signals; reject local modes in production |

## Three separate identities

1. Firebase web config identifies the client project; it is not a server secret.
2. Firebase Google sign-in identifies the human making a request.
3. Backend ADC/Admin credentials authorize server database access.

Successful browser login does not prove backend Firestore access. A Gmail app password is a fourth, separate credential and cannot replace any of these.

## Setup helpers

- npm run firestore:configure -- /absolute/private/key.json checks Firestore and saves the path.
- npm run email:configure -- sender@example.com /absolute/private/password.txt https://your-app.example configures SMTP.
- npm run cloud:configure prepares cloud-mode configuration; review before changing an existing local setup.

Restart after changing backend configuration. Check Settings, then verify a real save and reload. Do not infer a successful connection from an environment variable being present. No documentation command activates billing automatically.
