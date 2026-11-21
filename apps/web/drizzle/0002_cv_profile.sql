ALTER TABLE "applicant_profiles" ADD COLUMN "cv_profile" jsonb;--> statement-breakpoint
ALTER TABLE "applicant_profiles" ADD COLUMN "cv_matches" jsonb;--> statement-breakpoint
ALTER TABLE "applicant_profiles" ADD COLUMN "cv_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "applicant_profiles" ADD COLUMN "matches_updated_at" timestamp;