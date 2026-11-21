import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Direct (unpooled) connection for migrations.
  dbCredentials: { url: process.env.DATABASE_URL!.replace(/sslmode=require/, "sslmode=verify-full") },
});
