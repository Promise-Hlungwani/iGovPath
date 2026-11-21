import type { NextConfig } from "next";
import path from "node:path";
import { config } from "dotenv";

// One .env at the repo root is shared by the web app and the AI service.
config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
