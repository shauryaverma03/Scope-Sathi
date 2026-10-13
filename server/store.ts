import { normalizeProject } from "../shared/model.js";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import type { Actor, Project } from "../shared/model.js";
import { access, AppError } from "./domain.js";
const directory = resolve(
  process.env.SCOPESATHI_DATA_DIR ||
    (process.env.APP_MODE === "firebase" ? ".data/firebase-local" : ".data"),
);
const file = join(directory, "projects.json");
let queue: Promise<unknown> = Promise.resolve();
async function localRead(): Promise<Record<string, Project>> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e: any) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
}
async function localWrite(data: Record<string, Project>) {
  await mkdir(directory, { recursive: true });
  const tmp = join(directory, "projects.tmp");
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, file);
}
function serial<T>(f: () => Promise<T>): Promise<T> {
  const next = queue.then(f, f);
  queue = next.catch(() => {});
  return next;
}
function checkSize(p: Project) {
  if (Buffer.byteLength(JSON.stringify(p)) > 700000)
    throw new AppError(
      413,
      "This prototype project reached its storage limit. Export your history and start a new project.",
    );
}
export function createStore(google: boolean) {
  const collection = () => getFirestore().collection("projects");
  return {
    async list(a: Actor) {
      const all = google
        ? (
            await collection()
              .where("memberEmails", "array-contains", a.email)
              .get()
          ).docs.map((d) => d.data() as Project)
        : Object.values(await localRead());
      return all
        .map(normalizeProject)
        .filter((p) => p.ownerId === a.uid || p.members[a.email])
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async get(id: string, a: Actor) {
      const p = google
        ? ((await collection().doc(id).get()).data() as Project | undefined)
        : (await localRead())[id];
      if (!p) throw new AppError(404, "Project not found.");
      normalizeProject(p);
      access(p, a);
      return p;
    },
    async create(p: Project) {
      checkSize(p);
      if (google) await collection().doc(p.id).create(p);
      else
        await serial(async () => {
          const data = await localRead();
          data[p.id] = p;
          await localWrite(data);
        });
      return p;
    },
    async update(
      id: string,
      a: Actor,
      revision: number,
      mutate: (p: Project) => void,
    ) {
      const change = (p: Project | undefined) => {
        if (!p) throw new AppError(404, "Project not found.");
        normalizeProject(p);
        access(p, a);
        if (p.revision !== revision)
          throw new AppError(
            409,
            "This project changed in another window. Refresh before trying again.",
          );
        mutate(p);
        p.revision++;
        checkSize(p);
        return p;
      };
      if (google)
        return getFirestore().runTransaction(async (tx) => {
          const ref = collection().doc(id);
          const p = change((await tx.get(ref)).data() as Project | undefined);
          tx.set(ref, p);
          return p;
        });
      return serial(async () => {
        const data = await localRead();
        const p = change(data[id]);
        data[id] = p;
        await localWrite(data);
        return p;
      });
    },
    async delete(id: string, a: Actor) {
      if (google) {
        await getFirestore().runTransaction(async (tx) => {
          const ref = collection().doc(id);
          const p = (await tx.get(ref)).data() as Project | undefined;
          if (!p || p.ownerId !== a.uid)
            throw new AppError(403, "Only the project owner can delete it.");
          tx.delete(ref);
        });
      } else
        await serial(async () => {
          const data = await localRead();
          if (!data[id] || data[id].ownerId !== a.uid)
            throw new AppError(403, "Only the project owner can delete it.");
          delete data[id];
          await localWrite(data);
        });
    },
  };
}
