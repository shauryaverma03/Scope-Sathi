import { readFile, writeFile, chmod } from "node:fs/promises";
import nodemailer from "nodemailer";
const [user, passwordFile, publicURL] = process.argv.slice(2);
if (!user || !passwordFile) {
  console.error(
    "Provide the sender email, private password-file path and public HTTPS app URL. Never paste a password into chat.",
  );
  process.exit(1);
}
try {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) throw new Error("sender");
  const url = publicURL ? new URL(publicURL) : null;
  if (
    url && (url.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  )
    throw new Error("url");
  const pass = (await readFile(passwordFile, "utf8")).replace(/\s/g, "");
  if (pass.length < 16) throw new Error("password");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  await transport.verify();
  transport.close();
  let env = await readFile(".env", "utf8");
  const values = {
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "465",
    SMTP_USER: user,
    SMTP_PASS: pass,
    EMAIL_FROM: `ScopeSathi <${user}>`,
    ...(url ? { APP_PUBLIC_URL: url.origin } : {}),
    EMAIL_ENABLED: url ? "true" : "false",
  };
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    env = pattern.test(env)
      ? env.replace(pattern, () => line)
      : env + "\n" + line;
  }
  await writeFile(".env", env, { mode: 0o600 });
  await chmod(".env", 0o600);
  console.log(
    url
      ? "Sender authentication verified. No test email sent. Restart the backend to release eligible queued notifications."
      : "Sender authentication verified and saved. No email sent. Delivery remains disabled until a public HTTPS app URL is configured.",
  );
} catch {
  console.error(
    "Email setup was not verified. Check sender, app password and public HTTPS URL. No password was printed.",
  );
  process.exitCode = 1;
}
