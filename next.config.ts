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
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      },
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
