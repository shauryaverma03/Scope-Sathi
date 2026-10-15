import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import type { Config } from "../shared/model";
let user: User | null = null;
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token = user ? await user.getIdToken() : null;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const res = await fetch(`/api${path}`, {
    signal: AbortSignal.timeout(55000),
    method,
    headers,
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  if (res.status === 204) return undefined as T;
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      "The application server is unavailable. Check that it is running and try again.",
    );
  }
  if (!res.ok) throw new Error([data.error, ...(data.details || [])].join(" "));
  return data;
}
export function setupAuth(
  config: Config,
  callback: (user: User | null) => void,
) {
  const auth = getAuth(
    getApps().length ? getApp() : initializeApp(config.firebase!),
  );
  return onAuthStateChanged(auth, (u) => {
    user = u;
    callback(u);
  });
}
export async function login(remember = false) {
  await setPersistence(
    getAuth(),
    remember ? browserLocalPersistence : browserSessionPersistence,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      signInWithPopup(getAuth(), new GoogleAuthProvider()),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "The sign-in window did not finish. Open this app in Safari or Chrome, allow pop-ups, and try again.",
              ),
            ),
          60000,
        );
      }),
    ]);
  } catch (error: any) {
    const messages: Record<string, string> = {
      "auth/popup-blocked":
        "Allow pop-ups for this app, or open it in Safari or Chrome and try again.",
      "auth/popup-closed-by-user":
        "Sign-in was cancelled. You can try again when ready.",
      "auth/unauthorized-domain":
        "Add this host to Firebase Authentication's authorized domains, then retry.",
      "auth/operation-not-allowed":
        "Enable Google in Firebase Authentication → Sign-in method.",
      "auth/network-request-failed":
        "Google sign-in could not connect. Check your internet connection and retry.",
    };
    throw new Error(
      messages[error.code] ||
        error.message ||
        "Google sign-in failed. Please try again.",
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export const logout = () => signOut(getAuth());
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
