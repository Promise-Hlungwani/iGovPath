import type { NextConfig } from "next";
import path from "node:path";
import { config } from "dotenv";

// One .env at the repo root is shared by the web app and the AI service.
config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["pg"],
  // Don't reload the dev server when test results, AI caches, uploads or the Python service change.
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/.e2e-results/**", "**/data/**", "**/services/**", "**/.next/**"],
    };
    return config;
  },
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
