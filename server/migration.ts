import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { normalizeProject, type Project, type Actor } from "../shared/model.js";
import { AppError } from "./domain.js";
const path = () =>
  resolve(
    process.env.SCOPESATHI_MIGRATION_FILE ||
      ".data/firebase-local/projects.json",
  );
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function fingerprint(p: Project) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(normalizeProject(structuredClone(p)))))
    .digest("hex");
}

async function originals(a: Actor) {
  let data: Record<string, Project>;
  try {
    data = JSON.parse(await readFile(path(), "utf8"));
  } catch (e: any) {
    if (e.code === "ENOENT") return [];
    throw new AppError(
      500,
      "Local projects could not be read; originals were not changed.",
    );
  }
  return Object.values(data)
    .filter((p) => p.ownerId === a.uid && p.ownerEmail === a.email)
    .map(normalizeProject);
}
export async function previewMigration(a: Actor) {
  const projects = await originals(a);
  const items = [];
  for (const p of projects) {
    const existing = await getFirestore()
      .collection("projects")
      .doc(p.id)
      .get();
    items.push({
      id: p.id,
      name: p.name,
      requirements: p.requirements.length,
      versions: p.versions.length,
      requests: p.requests.length,
      tasks: p.tasks.length,
      fingerprint: fingerprint(p),
      state: existing.exists
        ? fingerprint(existing.data() as Project) === fingerprint(p)
          ? "already_copied"
          : "conflict"
        : "ready",
    });
  }
  return {
    items,
    message:
      "Copies preserve IDs and history. Existing cloud projects will not be overwritten. Local originals are retained.",
  };
}
export async function importProject(a: Actor, id: string, expected: string) {
  const p = (await originals(a)).find((p) => p.id === id);
  if (!p) throw new AppError(404, "Owned local project not found.");
  if (fingerprint(p) !== expected)
    throw new AppError(
      409,
      "Local project changed. Preview the migration again.",
    );
  if (Buffer.byteLength(JSON.stringify(p)) > 700000)
    throw new AppError(
      413,
      "Project exceeds the Firestore prototype size limit. Export and shorten it before importing.",
    );
  const ref = getFirestore().collection("projects").doc(p.id);
  await getFirestore().runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (fingerprint(existing.data() as Project) !== expected)
        throw new AppError(
          409,
          "A different cloud project already uses this ID. No overwrite was performed.",
        );
    } else tx.create(ref, p);
  });
  const saved = await ref.get();
  if (!saved.exists || fingerprint(saved.data() as Project) !== expected)
    throw new AppError(
      503,
      "Cloud copy could not be verified. The local original is retained; preview again before retrying.",
    );
  return {
    id: p.id,
    verified: true,
    message: "Firestore copy verified. Local original retained.",
  };
}
