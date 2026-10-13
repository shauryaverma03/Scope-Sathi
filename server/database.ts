import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
export type DatabaseStatus = {
  state: "local" | "checking" | "connected" | "error";
  message: string;
};
let status: DatabaseStatus = {
  state: "checking",
  message: "Checking Firestore access…",
};
let pending: Promise<DatabaseStatus> | undefined;
let checkedAt = 0;
export function databaseFailure() {
  status = {
    state: "error",
    message:
      "Firestore could not confirm this operation. Check backend credentials and database permissions. No local fallback was used.",
  };
  checkedAt = 0;
}
export async function databaseStatus(
  enabled: boolean,
  force = false,
): Promise<DatabaseStatus> {
  if (!enabled)
    return {
      state: "local",
      message: "Projects are stored on this Mac. Firestore is not selected.",
    };
  if (pending) return pending;
  if (!force && Date.now() - checkedAt < 15000) return status;
  pending = Promise.resolve().then(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (
        !process.env.K_SERVICE &&
        !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
        !existsSync(
          join(
            homedir(),
            ".config/gcloud/application_default_credentials.json",
          ),
        )
      ) {
        throw new Error("Admin credential not configured");
      }
      // Resolve credentials before creating a Firestore gRPC client. A missing
      // ADC must become a status error, not a background client rejection.
      await Promise.race([
        (async () => {
          await getApp().options.credential?.getAccessToken();
          await getFirestore().collection("projects").limit(1).get();
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 8000);
        }),
      ]);
      status = {
        state: "connected",
        message:
          "Firestore read access verified. Saves wait for the database to confirm each write.",
      };
    } catch {
      status = {
        state: "error",
        message:
          "Firestore is not connected. Configure a Firebase Admin credential for this local backend, then check again. Your local originals are retained.",
      };
    } finally {
      if (timer) clearTimeout(timer);
      checkedAt = Date.now();
      pending = undefined;
    }
    return status;
  });
  return pending;
}
