import type { NextConfig } from "next";
import path from "node:path";
import { config } from "dotenv";

// One .env at the repo root is shared by the web app and the AI service.
config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  // Lets a production build run next to `pnpm dev` without clashing (NEXT_DIST_DIR=.next-build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
            ignored: ["**/node_modules/**", "**/.git/**", "**/.e2e-results/**", "**/data/**", "**/services/**", "**/.next/**"],
          };
          return config;
        },
      }),
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
