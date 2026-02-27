import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
