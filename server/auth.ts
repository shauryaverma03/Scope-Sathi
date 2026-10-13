import { AppError } from "./domain.js";
// Account lookup validates session status without distributing an Admin key.
// Token signature, audience and expiry are separately checked by the Admin SDK.
export async function checkFirebaseSession(
  token: string,
  apiKey: string,
  request: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await request(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    throw new AppError(
      503,
      "Google sign-in could not be verified. Check your connection and retry.",
    );
  }
  if (!response.ok)
    throw new AppError(
      401,
      "Your sign-in has expired or been disabled. Please sign in again.",
    );
  const data = await response.json();
  if (!data.users?.[0] || data.users[0].disabled)
    throw new AppError(401, "Please sign in again.");
}
