// Public deployment metadata only. Never place credentials in this module.
/** Optional public recording. Reject credentials, non-HTTPS and lookalike hosts. */
export function publicDemoVideo(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return undefined;
    if (
      ![
        "youtube.com",
        "www.youtube.com",
        "youtu.be",
        "vimeo.com",
        "www.vimeo.com",
        "drive.google.com",
      ].includes(url.hostname)
    )
      return undefined;
    if (url.pathname === "/") return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export const deployment = {
  project: "scopesathi",
  service: "scopesathi-api",
  region: "europe-west1",
  origin: "https://scopesathi-api-112358672382.europe-west1.run.app",
  runtimeAccount: "scopesathi-runtime@scopesathi.iam.gserviceaccount.com",
} as const;
