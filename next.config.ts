import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Run yahoo-finance2 only on the server (Node.js), skip webpack bundling
  serverExternalPackages: ["yahoo-finance2"],
  outputFileTracingRoot: path.resolve(process.cwd()),
  transpilePackages: [
    "@evolu/common",
    "@evolu/react",
    "@evolu/react-web",
    "@evolu/sqlite-wasm",
    "@evolu/web",
  ],
  async redirects() {
    return [
      // Covers /dashboard and any sub-paths like /dashboard/foo
      { source: "/dashboard",        destination: "/", permanent: true },
      { source: "/dashboard/:path*", destination: "/", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },

};

export default nextConfig;
