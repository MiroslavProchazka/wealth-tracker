import type { NextConfig } from "next";

// On Vercel, VERCEL_URL is set to the deployment URL (e.g. wealth-tracker-git-xyz.vercel.app).
// Setting assetPrefix to an absolute URL ensures that webpack generates absolute URLs for
// import.meta.url inside module workers, which is required for sqlite-wasm (Evolu) to
// correctly resolve the WASM file path via `new URL('sqlite3.wasm', import.meta.url)`.
const assetPrefix = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

const nextConfig: NextConfig = {
  assetPrefix,
  // Run yahoo-finance2 only on the server (Node.js), skip webpack bundling
  serverExternalPackages: ["yahoo-finance2"],
  transpilePackages: [
    "@evolu/common",
    "@evolu/react",
    "@evolu/react-web",
    "@evolu/sqlite-wasm",
    "@evolu/web",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
