import "dotenv/config";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { extract, analyse } from "../server/ai.js";
import { createProject, approveBaseline } from "../server/domain.js";
const [keyPath, model] = process.argv.slice(2);
if (!keyPath || !model || !/^gemini-[a-zA-Z0-9.-]+$/.test(model)) {
  console.error(
    "Usage: npm run ai:configure -- /absolute/path/private-key.txt [model]. Supply a file path, never a key.",
  );
  process.exit(1);
}
try {
  const key = (await readFile(keyPath, "utf8")).trim();
  if (!key || /\s/.test(key)) throw new Error("key-file");
  process.env.APP_MODE = "firebase";
  process.env.GEMINI_API_KEY = key;
  process.env.GEMINI_MODEL = model;
  const brief =
    "SYNTHETIC TEST BRIEF\nRequirements\nCustomers must sign in before checkout.\nCustomers must see only their own order history.\nCSV exports are excluded.\n-- 1 of 1 --";
  const result = await extract(brief, true);
  console.log("Gemini extraction verified; checking change analysis…");
  if (
    result.requirements.some((r) =>
      /^(Requirements|SYNTHETIC TEST BRIEF|--)/i.test(r.text),
    )
  )
    throw new Error("metadata-output");
  const p = createProject(
    {
      uid: "probe",
      email: "probe@scopesathi.invalid",
      name: "Synthetic setup probe",
    },
    "Gemini setup probe",
    "",
    "",
  );
  approveBaseline(
    p,
    {
      uid: "probe",
      email: "probe@scopesathi.invalid",
      name: "Synthetic setup probe",
    },
    brief,
    result.requirements,
  );
  const analysis = await analyse(
    p,
    "Please allow guest checkout alongside sign-in. Remove the CSV export exclusion and allow customers to export their own order history as CSV.",
    true,
    false,
  );
  if (
    !analysis.findings.some((f) =>
      ["addition", "modification", "removal"].includes(f.kind),
    )
  )
    throw new Error("no-change-output");
  let env = await readFile(".env", "utf8");
  for (const [name, value] of Object.entries({
    GEMINI_API_KEY: key,
    GEMINI_MODEL: model,
  })) {
    const line = name + "=" + JSON.stringify(value);
    const pattern = new RegExp("^" + name + "=.*$", "m");
    env = pattern.test(env)
      ? env.replace(pattern, () => line)
      : env + "\n" + line;
  }
  await writeFile(".env", env, { mode: 0o600 });
  await chmod(".env", 0o600);
  console.log(
    JSON.stringify({
      verified: true,
      model,
      requirements: result.requirements.length,
      findings: analysis.findings.length,
      sourceQuotesValidated: true,
      baselineChanged: false,
      message:
        "Private backend configuration saved. Restart the API. Synthetic probe only; no project saved or billing changed.",
    }),
  );
} catch (e) {
  console.error(
    e instanceof Error && "status" in e
      ? e.message
      : "Gemini setup was not verified. Check key file, model permissions and quota. No key was printed.",
  );
  console.error("Backend configuration was not saved.");
  process.exitCode = 1;
}
