import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "src", "lib", "auth", "session-secret.generated.ts");
const header = "// Generated at build time. Never commit this file.\n";

const envSecret = process.env.SESSION_SECRET;
if (envSecret && envSecret.length >= 32) {
  fs.writeFileSync(target, `${header}export const GENERATED_SESSION_SECRET = "";\n`);
  console.log("[session-secret] Using SESSION_SECRET from the environment.");
  process.exit(0);
}

try {
  const current = fs.readFileSync(target, "utf8");
  if (/GENERATED_SESSION_SECRET\s*=\s*"[a-f0-9]{64,}"/.test(current)) {
    console.log("[session-secret] Reusing the generated secret for this environment.");
    process.exit(0);
  }
} catch {}

fs.mkdirSync(path.dirname(target), { recursive: true });
const secret = crypto.randomBytes(48).toString("hex");
fs.writeFileSync(target, `${header}export const GENERATED_SESSION_SECRET = "${secret}";\n`);
console.log(
  "[session-secret] SESSION_SECRET is not set; generated a per-build secret. Sessions reset when this deployment is replaced."
);
