import type { NextConfig } from "next";
import path from "node:path";
import { config } from "dotenv";

// One .env at the repo root is shared by the web app and the AI service.
config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  // Vercel's Next.js builder expects .next; local production builds stay separate from `pnpm dev`.
  distDir: process.env.VERCEL
    ? ".next"
    : process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === "production" ? ".next-build" : ".next"),
  devIndicators: false,
  serverExternalPackages: ["pg"],
  // Webpack only (production builds and `next dev` without --turbopack): don't reload when test
  // results, AI caches, uploads or the Python service change. Turbopack only watches imported files.
  ...(process.env.TURBOPACK
    ? {}
    : {
        webpack: (config: { watchOptions?: Record<string, unknown> }) => {
          config.watchOptions = {
            ...config.watchOptions,
            ignored: ["**/node_modules/**", "**/.git/**", "**/.e2e-results/**", "**/data/**", "**/services/**", "**/.next/**", "**/.next-build/**"],
          };
          return config;
        },
      }),
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
    // Keep pages you've just visited in the browser for 30 s, so going back is instant.
    // Any save (server action) clears this cache, so people never see stale data after a change.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
