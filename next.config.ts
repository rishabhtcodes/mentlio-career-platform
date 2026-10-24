import type { NextConfig } from "next";

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
