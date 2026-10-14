import { requestContext, makeLimit } from "./protection.js";
import {
  sessionWelcome,
  syncExistingMemberships,
  invite,
  inbox,
  invitationDecision,
  revokeInvitation,
  invitationStatuses,
} from "./invitations.js";
import { deliverQueuedMail, emailReady } from "./email.js";
import { databaseStatus, databaseFailure } from "./database.js";
import { previewMigration, importProject } from "./migration.js";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import {
  RequirementSchema,
  IntakeSchema,
  FindingSchema,
  SAMPLE_BRIEF,
  type Actor,
  type Project,
} from "../shared/model.js";
import {
  AppError,
  createProject,
  access,
  event,
  approveBaseline,
  addRequest,
  decide,
  saveProposal,
  saveIntake,
  setRevisionPolicy,
  proposeRoundQuote,
  respondRoundQuote,
  recordInvoice,
  now,
} from "./domain.js";
import { checkFirebaseSession } from "./auth.js";
import { createStore } from "./store.js";
import { extract, analyse } from "./ai.js";
const mode = process.env.APP_MODE || "demo";
const google = mode !== "demo";
const cloud = mode === "google";
const firestore =
  cloud || (mode === "firebase" && process.env.STORAGE_BACKEND === "firestore");
const liveAI =
  cloud ||
  (mode === "firebase" &&
    !!process.env.GEMINI_API_KEY &&
    !!process.env.GEMINI_MODEL);
const engine = liveAI
  ? process.env.GEMINI_MODEL!
  : mode === "demo"
    ? "Prepared sample / manual review"
    : "Manual review · no AI calls";
if (!["demo", "firebase", "google"].includes(mode))
  throw new Error("APP_MODE must be demo, firebase or google.");
if (!cloud && (process.env.K_SERVICE || process.env.NODE_ENV === "production"))
  throw new Error(
    "Local modes cannot be deployed. Use APP_MODE=google for cloud deployment.",
  );
let firebaseConfig: Record<string, string> | undefined;
if (google) {
  for (const key of [
    "GOOGLE_CLOUD_PROJECT",
    "FIREBASE_WEB_CONFIG",
    ...(cloud ? ["GEMINI_MODEL"] : []),
  ])
    if (!process.env[key]) throw new Error(`${key} is required.`);
  firebaseConfig = JSON.parse(process.env.FIREBASE_WEB_CONFIG!);
  if (firebaseConfig?.projectId !== process.env.GOOGLE_CLOUD_PROJECT)
    throw new Error("Firebase and Google Cloud project IDs must match.");
  initializeApp({
    ...(firestore ? { credential: applicationDefault() } : {}),
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });
}
const store = createStore(firestore),
  app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://*.firebaseapp.com",
        ],
        frameSrc: [
          "'self'",
          "https://*.firebaseapp.com",
          "https://accounts.google.com",
        ],
        objectSrc: ["'none'"],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    strictTransportSecurity: cloud ? undefined : false,
  }),
);
app.use("/api", requestContext);
app.use("/api", makeLimit(600, 60000));
app.use(express.json({ limit: "350kb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.get("/api/health", (_req, res) => res.json({ ok: true, mode }));
app.get("/api/config", async (_req, res) =>
  res.json({
    mode,
    model: engine,
    ai: liveAI ? (cloud ? "vertex" : "gemini") : "manual",
    storage: firestore ? "firestore" : "local",
    firebase: firebaseConfig,
    database: await databaseStatus(firestore),
    email: {
      configured: emailReady(),
      message: emailReady()
        ? "Sender configured. Email status is shown for each invitation; inbox delivery is not guaranteed."
        : "Email delivery needs a sender and a public app URL. Notifications remain available in the app.",
    },
  }),
);
// Local demo is loopback-only. Cloud requests always require a verified Firebase token.
app.use("/api", async (req, res, next) => {
  try {
    if (!google) {
      const host = req.hostname;
      if (!["localhost", "127.0.0.1", "[::1]"].includes(host))
        throw new AppError(403, "Local demo only.");
      res.locals.actor = {
        uid: "local-demo",
        email: "demo@scopesathi.local",
        name: "Demo reviewer",
      };
    } else {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) throw new AppError(401, "Sign in to continue.");
      let decoded;
      try {
        decoded = await getAuth().verifyIdToken(token, cloud);
        if (!cloud) await checkFirebaseSession(token, firebaseConfig!.apiKey);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          401,
          "Your sign-in has expired. Please sign in again.",
        );
      }
      if (
        !decoded.email ||
        !decoded.email_verified ||
        decoded.firebase.sign_in_provider !== "google.com"
      )
        throw new AppError(403, "Use a verified Google account.");
      res.locals.actor = {
        uid: decoded.uid,
        email: decoded.email.toLowerCase(),
        name: decoded.name || decoded.email,
      };
    }
    next();
  } catch (e) {
    next(e);
  }
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 100,
    keyGenerator: (_req, res) => res.locals.actor.uid,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a minute." },
  }),
);
// Cross-origin browser mutations are rejected. Firebase Hosting and Cloud Run use same-origin APIs.
app.use("/api", (req, _res, next) => {
  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin) {
      try {
        const localDev =
          !process.env.K_SERVICE &&
          process.env.NODE_ENV !== "production" &&
          ["http://127.0.0.1:5173", "http://localhost:5173"].includes(origin);
        const firebaseOrigins = google
          ? [
              `https://${firebaseConfig!.authDomain}`,
              `https://${process.env.GOOGLE_CLOUD_PROJECT}.web.app`,
              `https://${process.env.GOOGLE_CLOUD_PROJECT}.firebaseapp.com`,
            ]
          : [];
        if (
          !localDev &&
          !firebaseOrigins.includes(origin) &&
          new URL(origin).host !== req.get("host")
        )
          throw new Error();
      } catch {
        return next(
          new AppError(403, "Cross-origin requests are not allowed."),
        );
      }
    }
  }
  next();
});
const aiLimit = rateLimit({
  windowMs: 60000,
  limit: 8,
  keyGenerator: (_req, res) => res.locals.actor.uid,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Analysis limit reached. Wait a minute before trying again.",
  },
});
const invitationLimit = makeLimit(10, 3600000, true);
const connectionLimit = makeLimit(6, 60000, true);
app.use("/api/session", makeLimit(10, 60000, true));
const actor = (res: express.Response) => res.locals.actor as Actor;
const Revision = z.number().int().nonnegative();
const Brief = z.string().trim().min(20).max(16000);
const id = (req: express.Request) => z.uuid().parse(req.params.id);
app.get("/api/connection", connectionLimit, async (_req, res) =>
  res.json(await databaseStatus(firestore, true)),
);
app.get("/api/migration", async (_req, res) => {
  if (!firestore)
    throw new AppError(409, "Select Firestore before previewing migration.");
  if ((await databaseStatus(true)).state !== "connected")
    throw new AppError(503, "Connect Firestore before previewing migration.");
  res.json(await previewMigration(actor(res)));
});
app.post("/api/migration", async (req, res) => {
  if (!firestore)
    throw new AppError(409, "Select Firestore before copying projects.");
  const v = z
    .object({ id: z.uuid(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
    .parse(req.body);
  res.json(await importProject(actor(res), v.id, v.fingerprint));
});
app.use("/api/projects", async (_req, _res, next) => {
  if (firestore && (await databaseStatus(true)).state !== "connected")
    return next(
      new AppError(
        503,
        "Firestore is not connected. Open Settings for the credential setup. No projects were saved locally.",
      ),
    );
  next();
});
app.get("/api/projects", async (_req, res) =>
  res.json(await store.list(actor(res))),
);
app.post("/api/projects", async (req, res) => {
  const v = z
    .object({
      name: z.string().trim().min(2).max(100),
      client: z.string().trim().max(100),
      description: z.string().trim().max(500),
    })
    .parse(req.body);
  const p = createProject(actor(res), v.name, v.client, v.description);
  event(p, actor(res), "Project created", v.name);
  res.status(201).json(await store.create(p));
});
app.post("/api/sample", async (_req, res) => {
  if (google) throw new AppError(404, "Sample seed is only available locally.");
  const a = actor(res);
  const p = createProject(
    a,
    "The Sunday Store",
    "Sunday Studio",
    "A considered shopping experience. Keep every new request aligned with the agreed scope.",
  );
  approveBaseline(
    p,
    a,
    SAMPLE_BRIEF,
    (await extract(SAMPLE_BRIEF, false)).requirements,
  );
  p.tasks = [
    {
      id: "TASK-001",
      title: "Build sign-in and checkout flow",
      requirementIds: ["REQ-001"],
      status: "in_progress",
    },
    {
      id: "TASK-002",
      title: "Create customer order history",
      requirementIds: ["REQ-003"],
      status: "todo",
    },
    {
      id: "TASK-003",
      title: "Build product search and filters",
      requirementIds: ["REQ-002"],
      status: "done",
    },
  ];
  res.status(201).json(await store.create(p));
});
app.get("/api/projects/:id", async (req, res) =>
  res.json(await store.get(id(req), actor(res))),
);
app.delete("/api/projects/:id", async (req, res) => {
  await store.delete(id(req), actor(res));
  res.status(204).end();
});
app.post("/api/projects/:id/extract", aiLimit, async (req, res) => {
  const p = await store.get(id(req), actor(res));
  access(p, actor(res), true);
  if (p.versions.length) throw new AppError(409, "Baseline already approved.");
  const { brief } = z.object({ brief: Brief }).parse(req.body);
  res.json({
    ...(await extract(brief, liveAI)),
    engine: liveAI ? engine : "Local line extraction · review before approval",
  });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});
app.post(
  "/api/projects/:id/document",
  aiLimit,
  upload.single("file"),
  async (req, res) => {
    const p = await store.get(id(req), actor(res));
    access(p, actor(res), true);
    if (!req.file) throw new AppError(400, "Choose a PDF or text file.");
    let text = "";
    if (req.file.originalname.toLowerCase().endsWith(".pdf")) {
      if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-")
        throw new AppError(400, "This is not a valid PDF.");
      const parser = new PDFParse({ data: req.file.buffer });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else if (req.file.originalname.toLowerCase().endsWith(".txt"))
      text = req.file.buffer.toString("utf8");
    else throw new AppError(400, "Use a text PDF or .txt file.");
    if (text.trim().length < 20)
      throw new AppError(
        400,
        "No usable text found. Scanned PDFs need OCR; paste their text instead.",
      );
    if (text.length > 16000)
      throw new AppError(
        413,
        "This prototype accepts up to 16,000 characters. Upload a shorter brief.",
      );
    res.json({ text });
  },
);
app.post("/api/projects/:id/intake", async (req, res) => {
  const v = z
    .object({
      revision: Revision,
      intake: IntakeSchema,
      brief: Brief.optional(),
    })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) => {
      saveIntake(p, actor(res), v.intake);
      if (v.brief) p.brief = v.brief;
    }),
  );
});
app.post("/api/projects/:id/revision-policy", async (req, res) => {
  const v = z
    .object({
      revision: Revision,
      includedRounds: z.number().int().min(0).max(1000).nullable(),
      currency: z.enum(["INR", "USD", "EUR", "GBP"]).default("INR"),
      rateMinor: z.number().int().min(0).max(100000000).default(0),
      clientEmail: z.union([z.email(), z.literal("")]).default(""),
      definition: z.string().trim().min(20).max(1000),
    })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) =>
      setRevisionPolicy(p, actor(res), v.includedRounds, v.definition, {
        currency: v.currency,
        rateMinor: v.rateMinor,
        clientEmail: v.clientEmail.toLowerCase(),
      }),
    ),
  );
});
app.post("/api/projects/:id/quotes", async (req, res) => {
  const v = z
    .object({ revision: Revision, roundId: z.string().min(1).max(60) })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) =>
      proposeRoundQuote(p, actor(res), v.roundId),
    ),
  );
});
app.post("/api/projects/:id/quotes/:quoteId/respond", async (req, res) => {
  const v = z
    .object({ revision: Revision, accept: z.boolean() })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) =>
      respondRoundQuote(p, actor(res), String(req.params.quoteId), v.accept),
    ),
  );
});
app.post("/api/projects/:id/quotes/:quoteId/invoice", async (req, res) => {
  const v = z
    .object({
      revision: Revision,
      reference: z.string().trim().min(3).max(150),
    })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) =>
      recordInvoice(p, actor(res), String(req.params.quoteId), v.reference),
    ),
  );
});
app.post("/api/projects/:id/rounds", async (req, res) => {
  const v = z
    .object({ revision: Revision, name: z.string().trim().min(3).max(100) })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) => {
      access(p, actor(res), true);
      const round = {
        id: randomUUID(),
        name: v.name,
        createdAt: now(),
        createdBy: actor(res).email,
      };
      p.rounds.push(round);
      event(p, actor(res), "Revision round created", v.name);
    }),
  );
});
app.post("/api/projects/:id/baseline", async (req, res) => {
  const v = z
    .object({
      revision: Revision,
      brief: Brief,
      requirements: z.array(RequirementSchema).min(1).max(30),
    })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) =>
      approveBaseline(p, actor(res), v.brief, v.requirements),
    ),
  );
});
app.post("/api/projects/:id/requests", aiLimit, async (req, res) => {
  const v = z
    .object({
      revision: Revision,
      title: z.string().trim().min(3).max(150),
      source: z.string().trim().min(1).max(100),
      category: z.enum(["new_scope", "correction"]).default("new_scope"),
      roundId: z.string().max(60).default(""),
      text: z.string().trim().min(10).max(12000),
    })
    .parse(req.body);
  const p = await store.get(id(req), actor(res));
  access(p, actor(res), true);
  if (!p.versions.length) throw new AppError(409, "Approve a baseline first.");
  if (p.revision !== v.revision)
    throw new AppError(409, "Refresh this project before analysing.");
  if (v.roundId && !p.rounds.some((r) => r.id === v.roundId))
    throw new AppError(400, "Unknown revision round.");
  const analysis = await analyse(p, v.text, liveAI, mode === "demo");
  const request = {
    id: randomUUID(),
    title: v.title,
    source: v.source,
    category: v.category,
    roundId: v.roundId || randomUUID(),
    text: v.text,
    analysis,
    baselineVersion: p.versions.length,
    engine,
    status: "pending" as const,
    createdAt: now(),
    createdBy: actor(res).email,
  };
  res.json(
    await store.update(p.id, actor(res), v.revision, (next) => {
      if (!next.rounds.some((q) => q.id === request.roundId))
        next.rounds.push({
          id: request.roundId,
          name: v.title,
          createdAt: request.createdAt,
          createdBy: actor(res).email,
        });
      addRequest(next, actor(res), request);
    }),
  );
});
app.post(
  "/api/projects/:id/requests/:requestId/reanalyse",
  aiLimit,
  async (req, res) => {
    const v = z.object({ revision: Revision }).parse(req.body);
    const p = await store.get(id(req), actor(res));
    access(p, actor(res), true);
    const r = p.requests.find((r) => r.id === req.params.requestId);
    if (!r) throw new AppError(404, "Request not found.");
    if (r.status !== "pending")
      throw new AppError(409, "Only pending requests can be reanalysed.");
    const analysis = await analyse(p, r.text, liveAI, mode === "demo");
    res.json(
      await store.update(p.id, actor(res), v.revision, (next) => {
        access(next, actor(res), true);
        const target = next.requests.find((q) => q.id === r.id)!;
        if (target.status !== "pending")
          throw new AppError(409, "Request already decided.");
        target.analysis = analysis;
        target.engine = engine;
        target.baselineVersion = next.versions.length;
        event(next, actor(res), "Request reanalysed", r.title);
      }),
    );
  },
);
app.post("/api/projects/:id/requests/:requestId/proposal", async (req, res) => {
  const v = z
    .object({
      revision: Revision,
      findings: z.array(FindingSchema).min(1).max(15),
      category: z.enum(["new_scope", "correction"]).optional(),
      roundId: z.string().max(60).optional(),
    })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) => {
      saveProposal(p, actor(res), String(req.params.requestId), v.findings);
      const request = p.requests.find((r) => r.id === req.params.requestId)!;
      if (v.category) request.category = v.category;
      if (v.roundId) {
        if (!p.rounds.some((q) => q.id === v.roundId))
          throw new AppError(400, "Unknown revision round.");
        request.roundId = v.roundId;
      }
    }),
  );
});
app.post("/api/projects/:id/requests/:requestId/decision", async (req, res) => {
  const v = z
    .object({
      revision: Revision,
      decision: z.enum(["approved", "rejected", "clarification"]),
      note: z.string().trim().min(5).max(1000),
      findings: z.array(FindingSchema).min(1).max(15).optional(),
      separateAgreement: z.string().trim().max(1000).default(""),
    })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) =>
      decide(
        p,
        actor(res),
        String(req.params.requestId),
        v.decision,
        v.note,
        v.findings,
        v.separateAgreement,
      ),
    ),
  );
});
app.post("/api/projects/:id/tasks", async (req, res) => {
  const v = z
    .object({
      revision: Revision,
      title: z.string().trim().min(3).max(200),
      requirementIds: z.array(z.string().max(60)).max(30),
    })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) => {
      access(p, actor(res), true);
      if (v.requirementIds.some((r) => !p.requirements.some((q) => q.id === r)))
        throw new AppError(400, "Unknown requirement.");
      p.tasks.push({
        id: `TASK-${randomUUID().slice(0, 8)}`,
        title: v.title,
        requirementIds: v.requirementIds,
        status: "todo",
      });
      event(p, actor(res), "Task created", v.title);
    }),
  );
});
app.patch("/api/projects/:id/tasks/:taskId", async (req, res) => {
  const v = z
    .object({
      revision: Revision,
      status: z.enum(["todo", "in_progress", "done", "needs_review"]),
      title: z.string().trim().min(3).max(200),
      requirementIds: z.array(z.string().max(60)).max(30),
    })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) => {
      access(p, actor(res), true);
      const t = p.tasks.find((t) => t.id === req.params.taskId);
      if (!t) throw new AppError(404, "Task not found.");
      if (
        v.requirementIds.some((id) => !p.requirements.some((r) => r.id === id))
      )
        throw new AppError(400, "Link only current requirements.");
      t.title = v.title;
      t.status = v.status;
      t.requirementIds = v.requirementIds;
      event(p, actor(res), "Task reviewed", v.title);
    }),
  );
});
app.post("/api/session", async (_req, res) => {
  if (!firestore) return res.json({ welcome: false });
  if ((await databaseStatus(true)).state !== "connected")
    throw new AppError(503, "Connect Firestore before opening notifications.");
  await sessionWelcome(actor(res));
  await syncExistingMemberships(actor(res));
  res.json({ welcome: true });
});
app.get("/api/notifications", async (_req, res) => {
  if (!firestore) return res.json([]);
  if ((await databaseStatus(true)).state !== "connected")
    throw new AppError(503, "Connect Firestore before opening notifications.");
  res.json(await inbox(actor(res)));
});
app.post("/api/notifications/:notificationId/decision", async (req, res) => {
  if (!firestore)
    throw new AppError(
      409,
      "Verified invitations require Firebase and Firestore.",
    );
  const v = z
    .object({ decision: z.enum(["accepted", "declined"]) })
    .parse(req.body);
  res.json(
    await invitationDecision(
      z.uuid().parse(req.params.notificationId),
      actor(res),
      v.decision,
    ),
  );
});
app.post("/api/projects/:id/members", invitationLimit, async (req, res) => {
  if (!firestore)
    throw new AppError(
      409,
      "Verified invitations require Firebase and Firestore.",
    );
  const v = z
    .object({
      revision: Revision,
      allowUnregistered: z.boolean().default(false),
      email: z
        .email()
        .max(254)
        .transform((s) => s.toLowerCase()),
      role: z.enum(["reviewer", "editor", "viewer"]),
    })
    .parse(req.body);
  // Check ownership before looking up another account.
  const p = await store.get(id(req), actor(res));
  if (p.ownerId !== actor(res).uid)
    throw new AppError(403, "Only the owner can invite members.");
  res.json(
    await invite(
      p.id,
      actor(res),
      v.revision,
      v.email,
      v.role,
      v.allowUnregistered,
    ),
  );
});
app.get("/api/projects/:id/invitations", async (req, res) => {
  const p = await store.get(id(req), actor(res));
  if (p.ownerId !== actor(res).uid)
    throw new AppError(
      403,
      "Only the owner can view invitation delivery status.",
    );
  res.json(firestore ? await invitationStatuses(p) : []);
});
app.post(
  "/api/projects/:id/invitations/:invitationId/revoke",
  async (req, res) => {
    if (!firestore)
      throw new AppError(409, "Verified invitations require Firestore.");
    const v = z.object({ revision: Revision }).parse(req.body);
    res.json(
      await revokeInvitation(
        id(req),
        z.uuid().parse(req.params.invitationId),
        actor(res),
        v.revision,
      ),
    );
  },
);
app.delete("/api/projects/:id/members", async (req, res) => {
  const v = z
    .object({
      revision: Revision,
      email: z.email().transform((v) => v.toLowerCase()),
    })
    .parse(req.body);
  res.json(
    await store.update(id(req), actor(res), v.revision, (p) => {
      if (p.ownerId !== actor(res).uid || v.email === p.ownerEmail)
        throw new AppError(403, "Owner access cannot be removed.");
      for (const invitation of p.invitations)
        if (invitation.email === v.email && invitation.state === "pending")
          invitation.state = "revoked";
      delete p.members[v.email];
      p.memberEmails = p.memberEmails.filter((e) => e !== v.email);
      event(p, actor(res), "Access removed", v.email);
    }),
  );
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
const dist = resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve(dist, "index.html")));
}
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (res.headersSent) return _next(err);
    if (err?.type === "entity.parse.failed")
      return res
        .status(400)
        .json({
          error: "Invalid JSON request.",
          requestId: res.locals.requestId,
        });
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: "Please check your input.",
        details: err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .slice(0, 4),
      });
    if (err instanceof AppError)
      return res.status(err.status).json({ error: err.message });
    if (err instanceof multer.MulterError)
      return res.status(400).json({
        error: "File too large or invalid upload. Use one file under 2 MB.",
      });
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "Request too large." });
    if (
      firestore &&
      [7, 16, "PERMISSION_DENIED", "UNAUTHENTICATED"].includes(err?.code)
    )
      return res.status(503).json({
        error:
          "Firestore access is not configured for this backend. Check the Admin credentials and permissions in docs/FREE_SETUP.md. No local fallback was used.",
      });
    if (firestore) databaseFailure();
    console.error("Request failed", err?.name);
    res.status(500).json({
      error:
        "Something went wrong. Your action was not confirmed. Refresh and try again.",
    });
  },
);
if (firestore && emailReady()) {
  const timer = setInterval(() => {
    void deliverQueuedMail();
  }, 15000);
  timer.unref();
  void deliverQueuedMail();
}
const port = Number(process.env.PORT || 8080);
const server = app.listen(port, cloud ? "0.0.0.0" : "127.0.0.1", () =>
  console.log(
    `ScopeSathi API: http://127.0.0.1:${port} (${mode} / ${firestore ? "Firestore" : "local storage"})`,
  ),
);

server.headersTimeout = 15000;
server.requestTimeout = 60000;
server.keepAliveTimeout = 5000;
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
