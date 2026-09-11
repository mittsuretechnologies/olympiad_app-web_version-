import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the Turbopack project root to this folder. Without it, Next walks up
  // and infers the parent directory as the workspace root (a stray, empty
  // package-lock.json sits there with no matching package.json), which
  // breaks next/font/google module resolution under Turbopack.
  turbopack: {
    root: path.resolve(__dirname),
  },

  serverExternalPackages: ['ffmpeg-static', 'ffprobe-static'],

  experimental: {
    serverActions: {
      bodySizeLimit: '150mb',
    },
  },

  async headers() {
    // CORS for /api/* is handled per-request in middleware.ts, which reflects
    // Origin only when it's in the ALLOWED_ORIGINS allow-list (a static header
    // here can only ever emit one fixed value, not a real allow-list check).
    return [
      // Allow video files in /uploads to be streamed cross-origin (needed by the mobile app)
      {
        source: "/uploads/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ]
      }
    ];
  }
};

export default nextConfig;
