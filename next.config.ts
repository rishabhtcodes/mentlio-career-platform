import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Vercel can invoke `next build` directly, so npm lifecycle scripts are not a
// reliable place to provision the session secret. This config is evaluated
// before compilation on every build and dev start.
function ensureSessionSecret() {
  const target = path.join(process.cwd(), "src", "lib", "auth", "session-secret.generated.ts");
  const header = "// Generated at build time. Never commit this file.\n";

  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    fs.writeFileSync(target, `${header}export const GENERATED_SESSION_SECRET = "";\n`);
    return;
  }

  try {
    const current = fs.readFileSync(target, "utf8");
    if (/GENERATED_SESSION_SECRET\s*=\s*"[a-f0-9]{64,}"/.test(current)) return;
  } catch {}

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    `${header}export const GENERATED_SESSION_SECRET = "${crypto.randomBytes(48).toString("hex")}";\n`
  );
}

ensureSessionSecret();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      // Primary Supabase project hostname (from .env.local)
      {
        protocol: "https",
        hostname: "veiucmeaejlvcofkoide.supabase.co",
      },
      // Legacy / fallback Supabase hostname
      {
        protocol: "https",
        hostname: "pedvkwlatzssmjmgfjyn.supabase.co",
      },
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
      // Discord OAuth avatars
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      // Slack OAuth avatars
      {
        protocol: "https",
        hostname: "avatars.slack-edge.com",
      },
      // Generic avatar fallbacks
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ],
  },
  reactStrictMode: false,
  poweredByHeader: false,
  // Security headers. No CSP beyond frame-ancestors on purpose: the app loads
  // Razorpay checkout, Vapi, YouTube embeds and Zego, and a resource-restricting
  // policy written without auditing every one of them would break payments or
  // calls. Framing and sniffing protection are safe for all of them.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self), payment=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000",
          },
        ],
      },
    ];
  },
  // Debug logging is left in place during development but must not ship: several
  // call sites print user ids, quiz answers and job descriptions.
  compiler: {
    removeConsole: { exclude: ["error", "warn"] },
  },
};

export default nextConfig;
