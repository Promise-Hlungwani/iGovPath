CREATE TYPE "public"."doc_kind" AS ENUM('circular', 'advert', 'form', 'amendment');--> statement-breakpoint
CREATE TYPE "public"."extraction_mode" AS ENUM('new', 'amendment');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('draft', 'needs_fix', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."form_status" AS ENUM('current', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."funnel_step" AS ENUM('viewed', 'saved', 'checklist_started', 'checklist_complete', 'explained');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('amended', 'extended', 'withdrawn', 'closing_soon', 'form_superseded');--> statement-breakpoint
CREATE TYPE "public"."opp_status" AS ENUM('open', 'amended', 'extended', 'withdrawn', 'closed');--> statement-breakpoint
CREATE TYPE "public"."opp_type" AS ENUM('post', 'learnership', 'internship');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('applicant', 'officer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."role_status" AS ENUM('active', 'pending', 'rejected', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."sphere" AS ENUM('national', 'provincial', 'local', 'agency');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"qualifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"licences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"province" text,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_sample" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"actor_department_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sphere" "sphere" DEFAULT 'national' NOT NULL,
	"province" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"is_sample" boolean DEFAULT true NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_document_id" uuid NOT NULL,
	"chunk_ref" text DEFAULT 'all' NOT NULL,
	"chunk_text" text NOT NULL,
	"chunk_page" integer,
	"mode" "extraction_mode" DEFAULT 'new' NOT NULL,
	"raw_json" jsonb,
	"record" jsonb,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"status" "extraction_status" DEFAULT 'draft' NOT NULL,
	"target_opportunity_id" uuid,
	"department_id" integer,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"effective_date" date,
	"is_central" boolean DEFAULT false NOT NULL,
	"owner_department_id" integer,
	"official_url" text,
	"source_document_id" uuid,
	"status" "form_status" DEFAULT 'current' NOT NULL,
	"superseded_by_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnel_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_hash" text NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"step" "funnel_step" NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_checklists" (
	"opportunity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "generated_checklists_opportunity_id_version_pk" PRIMARY KEY("opportunity_id","version")
);
--> statement-breakpoint
CREATE TABLE "generated_explanations" (
	"opportunity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"language" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "generated_explanations_opportunity_id_version_language_pk" PRIMARY KEY("opportunity_id","version","language")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"opportunity_id" uuid,
	"kind" "notification_kind" NOT NULL,
	"message" text NOT NULL,
	"dedupe_key" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "opp_type" DEFAULT 'post' NOT NULL,
	"department_id" integer NOT NULL,
	"post_title" text NOT NULL,
	"reference_number" text,
	"closing_date" date,
	"salary" text,
	"location" text,
	"province" text,
	"minimum_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"documents_required" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"form_required" text,
	"form_id" integer,
	"apply_route" jsonb,
	"contact" jsonb,
	"conditional_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "opp_status" DEFAULT 'open' NOT NULL,
	"is_sample" boolean DEFAULT true NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"source_document_id" uuid,
	"source_text" text,
	"source_date" date,
	"embedding" vector(1024),
	"published_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"record" jsonb NOT NULL,
	"changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_document_id" uuid,
	"extraction_id" uuid,
	"note" text,
	"approved_by" text,
	"approved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_opportunities" (
	"user_id" text NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"checklist_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seen_version" integer DEFAULT 1 NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_opportunities_user_id_opportunity_id_pk" PRIMARY KEY("user_id","opportunity_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" integer,
	"kind" "doc_kind" NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"sha256" text NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"document_date" date,
	"source_url" text,
	"is_sample" boolean DEFAULT true NOT NULL,
	"uploaded_by" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_documents_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "role" DEFAULT 'applicant' NOT NULL,
	"status" "role_status" DEFAULT 'active' NOT NULL,
	"department_id" integer,
	"job_title" text,
	"requested_at" timestamp,
	"approved_by" text,
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_profiles" ADD CONSTRAINT "applicant_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_department_id_departments_id_fk" FOREIGN KEY ("actor_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_owner_department_id_departments_id_fk" FOREIGN KEY ("owner_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_checklists" ADD CONSTRAINT "generated_checklists_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_explanations" ADD CONSTRAINT "generated_explanations_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_versions" ADD CONSTRAINT "opportunity_versions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_versions" ADD CONSTRAINT "opportunity_versions_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_versions" ADD CONSTRAINT "opportunity_versions_extraction_id_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."extractions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_versions" ADD CONSTRAINT "opportunity_versions_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "extractions_status_idx" ON "extractions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_once" ON "funnel_events" USING btree ("session_hash","opportunity_id","step");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "opportunities_search_idx" ON "opportunities" USING gin (to_tsvector('english', coalesce("post_title", '') || ' ' || coalesce("location", '') || ' ' || coalesce("province", '') || ' ' || coalesce("reference_number", '')));--> statement-breakpoint
CREATE INDEX "opportunities_closing_idx" ON "opportunities" USING btree ("closing_date");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_versions_uniq" ON "opportunity_versions" USING btree ("opportunity_id","version");