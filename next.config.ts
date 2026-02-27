import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  webpack(config, { isServer }) {
    if (!isServer) {
      // Fix WASM loading for Evolu's sqlite-wasm in Web Workers.
      //
      // Problem: webpack replaces `import.meta.url` at compile time with
      // publicPath + moduleFilename. With Next.js default publicPath='/_next/'
      // (relative), workers can't resolve WASM via `new URL('sqlite3.wasm',
      // import.meta.url)` — there's no origin to resolve against.
      //
      // Fix: publicPath='auto' makes webpack inject runtime code that reads
      // `self.location` (worker) or `document.currentScript.src` (main thread)
      // to compute the absolute public path. This way import.meta.url is always
      // an absolute URL and WASM loading works without any URL doubling.
      config.output.publicPath = "auto";
    }
    return config;
  },
};

export default nextConfig;
