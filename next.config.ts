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
};

export default nextConfig;
