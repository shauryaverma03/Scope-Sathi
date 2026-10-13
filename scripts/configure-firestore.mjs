import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const file = process.argv[2];
if (!file) {
  console.error(
    "Provide the local path to your downloaded Firebase Admin JSON file. Do not paste its contents.",
  );
  process.exit(1);
}
try {
  const key = JSON.parse(await readFile(resolve(file), "utf8"));
  if (key.type !== "service_account" || key.project_id !== "scopesathi")
    throw new Error(
      "Use an Admin service-account file from the scopesathi project.",
    );
  initializeApp({ credential: cert(key), projectId: "scopesathi" });
  await getFirestore().collection("projects").limit(1).get();
  let env = await readFile(".env", "utf8");
  for (const [name, value] of Object.entries({
    APP_MODE: "firebase",
    STORAGE_BACKEND: "firestore",
    GOOGLE_APPLICATION_CREDENTIALS: JSON.stringify(resolve(file)),
  })) {
    const line = `${name}=${value}`;
    env = new RegExp(`^${name}=.*$`, "m").test(env)
      ? env.replace(new RegExp(`^${name}=.*$`, "m"), () => line)
      : env + "\n" + line;
  }
  await writeFile(".env", env, { mode: 0o600 });
  console.log(
    "Firestore read access verified. Configuration saved. Restart the backend, then create a test project to verify writes. No local projects were migrated.",
  );
} catch {
  console.error(
    "Firestore setup failed. Check the file belongs to scopesathi and the account has Firestore access. No successful connection is claimed.",
  );
  process.exitCode = 1;
}
