import "server-only";
import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_POOLED: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  // Shared secret sent to the AI service (x-igovpath-key). Must match the AI service's AI_SERVICE_KEY.
  AI_SERVICE_KEY: z.string().trim().default(""),
  // Officer code: entering it gives officer access straight away. Empty means admin approval only.
  OFFICER_CODE: z.string().trim().default(""),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SAMPLE_DATA_ONLY: z
    .string()
    .default("true")
    .transform((v) => v.toLowerCase() !== "false"),
});

export const env = schema.parse(process.env);
