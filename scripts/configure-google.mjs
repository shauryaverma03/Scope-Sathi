import { createInterface } from "node:readline/promises";
import { readFile, writeFile } from "node:fs/promises";
const rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  console.log(
    "Configure your existing Google Cloud/Firebase project. No cloud resources are created.",
  );
  const project = (await rl.question("Google Cloud project ID: ")).trim();
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project))
    throw new Error("Use a valid project ID, not the display name.");
  const model = (
    await rl.question("Vertex AI model ID (from your project’s Model Garden): ")
  ).trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(model))
    throw new Error("Provide a valid model ID.");
  const config = JSON.parse(
    await rl.question(
      "Paste the public Firebase web config as one-line JSON: ",
    ),
  );
  if (
    config.projectId !== project ||
    !config.apiKey ||
    !config.authDomain ||
    !config.appId
  )
    throw new Error(
      "Firebase config must include matching projectId, apiKey, authDomain and appId.",
    );
  let old = "";
  try {
    old = await readFile(".env", "utf8");
  } catch {}
  if (
    old &&
    (await rl.question(".env exists. Replace it? Type yes: ")) !== "yes"
  )
    throw new Error("Existing .env preserved.");
  await writeFile(
    ".env",
    `APP_MODE=google\nPORT=8080\nGOOGLE_CLOUD_PROJECT=${project}\nGOOGLE_CLOUD_LOCATION=global\nGEMINI_MODEL=${model}\nFIREBASE_WEB_CONFIG=${JSON.stringify(config)}\n`,
    { mode: 0o600 },
  );
  await writeFile(
    ".firebaserc",
    JSON.stringify({ projects: { default: project } }, null, 2) + "\n",
  );
  console.log(
    "Saved .env and .firebaserc. See docs/GOOGLE_SETUP.md for authentication and deployment.",
  );
} finally {
  rl.close();
}
