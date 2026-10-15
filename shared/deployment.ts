// Public deployment metadata only. Never place credentials in this module.
export const deployment = {
  project: "scopesathi",
  service: "scopesathi-api",
  region: "europe-west1",
  origin: "https://scopesathi-api-112358672382.europe-west1.run.app",
  runtimeAccount: "scopesathi-runtime@scopesathi.iam.gserviceaccount.com",
} as const;
