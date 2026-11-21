import { sql } from "drizzle-orm";
import {
  boolean, customType, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial,
  text, timestamp, uniqueIndex, uuid, vector,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/* ───────────── Better Auth tables (names/columns follow Better Auth's schema) ───────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ───────────── Enums ───────────── */

export const roleEnum = pgEnum("role", ["applicant", "officer", "admin"]);
export const roleStatusEnum = pgEnum("role_status", ["active", "pending", "rejected", "deactivated"]);
export const sphereEnum = pgEnum("sphere", ["national", "provincial", "local", "agency"]);
export const docKindEnum = pgEnum("doc_kind", ["circular", "advert", "form", "amendment"]);
export const extractionStatusEnum = pgEnum("extraction_status", ["draft", "needs_fix", "approved", "rejected"]);
export const extractionModeEnum = pgEnum("extraction_mode", ["new", "amendment"]);
export const oppTypeEnum = pgEnum("opp_type", ["post", "learnership", "internship"]);
export const oppStatusEnum = pgEnum("opp_status", ["open", "amended", "extended", "withdrawn", "closed"]);
export const formStatusEnum = pgEnum("form_status", ["current", "superseded"]);
export const notificationKindEnum = pgEnum("notification_kind", [
  "amended", "extended", "withdrawn", "closing_soon", "form_superseded", "application_status",
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "draft", "submitted", "under_review", "shortlisted", "not_successful", "appointed", "withdrawn",
]);
export const applicationFileKindEnum = pgEnum("application_file_kind", ["cv", "id_copy", "qualification", "other"]);
export const funnelStepEnum = pgEnum("funnel_step", [
  "viewed", "saved", "checklist_started", "checklist_complete", "explained",
]);

/* ───────────── Organisation and roles ───────────── */

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sphere: sphereEnum("sphere").notNull().default("national"),
  province: text("province"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  isSample: boolean("is_sample").notNull().default(true),
});

export const userRoles = pgTable("user_roles", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("applicant"),
  status: roleStatusEnum("status").notNull().default("active"),
  departmentId: integer("department_id").references(() => departments.id),
  jobTitle: text("job_title"),
  requestedAt: timestamp("requested_at"),
  approvedBy: text("approved_by").references(() => user.id),
  approvedAt: timestamp("approved_at"),
});

/* ───────────── Documents and AI extraction ───────────── */

export type TextBlock = { text: string; bbox: [number, number, number, number] };
export type PageText = { page: number; text: string; blocks: TextBlock[]; ocr: boolean };

export const sourceDocuments = pgTable("source_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  departmentId: integer("department_id").references(() => departments.id),
  kind: docKindEnum("kind").notNull(),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  sha256: text("sha256").notNull().unique(),
  pageCount: integer("page_count").notNull().default(0),
  pages: jsonb("pages").$type<PageText[]>().notNull().default([]),
  documentDate: date("document_date"),
  sourceUrl: text("source_url"),
  isSample: boolean("is_sample").notNull().default(true),
  uploadedBy: text("uploaded_by").references(() => user.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

/** The PDF bytes, kept apart from source_documents so normal queries don't load them.
 * Stored in the database because hosting platforms like Vercel don't keep files on disk. */
export const documentFiles = pgTable("document_files", {
  documentId: uuid("document_id").primaryKey().references(() => sourceDocuments.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull().default("application/pdf"),
  data: bytea("data").notNull(),
});

export type ExtractionFlag = { field: string; level: "error" | "warning"; message: string };

export const extractions = pgTable(
  "extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceDocumentId: uuid("source_document_id").notNull().references(() => sourceDocuments.id, { onDelete: "cascade" }),
    chunkRef: text("chunk_ref").notNull().default("all"),
    chunkText: text("chunk_text").notNull(),
    chunkPage: integer("chunk_page"),
    mode: extractionModeEnum("mode").notNull().default("new"),
    rawJson: jsonb("raw_json"),
    record: jsonb("record").$type<Record<string, unknown>>(),
    flags: jsonb("flags").$type<ExtractionFlag[]>().notNull().default([]),
    model: text("model"),
    status: extractionStatusEnum("status").notNull().default("draft"),
    targetOpportunityId: uuid("target_opportunity_id"),
    departmentId: integer("department_id").references(() => departments.id),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("extractions_status_idx").on(t.status)],
);

/* ───────────── Forms ───────────── */

export const forms = pgTable("forms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(), // e.g. "Z83"
  name: text("name").notNull(),
  version: text("version").notNull(),
  effectiveDate: date("effective_date"),
  isCentral: boolean("is_central").notNull().default(false),
  ownerDepartmentId: integer("owner_department_id").references(() => departments.id),
  officialUrl: text("official_url"),
  sourceDocumentId: uuid("source_document_id").references(() => sourceDocuments.id),
  status: formStatusEnum("status").notNull().default("current"),
  supersededById: integer("superseded_by_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ───────────── Opportunities ───────────── */

export type ApplyRoute = { email: string | null; portal_url: string | null; postal: string | null; hand_delivery: string | null };
export type Contact = { name: string | null; phone: string | null };
export type ConditionalItem = { item: string; when: string };

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: oppTypeEnum("type").notNull().default("post"),
    departmentId: integer("department_id").notNull().references(() => departments.id),
    postTitle: text("post_title").notNull(),
    referenceNumber: text("reference_number"),
    closingDate: date("closing_date"),
    salary: text("salary"),
    location: text("location"),
    province: text("province"),
    minimumRequirements: jsonb("minimum_requirements").$type<string[]>().notNull().default([]),
    documentsRequired: jsonb("documents_required").$type<string[]>().notNull().default([]),
    formRequired: text("form_required"),
    formId: integer("form_id").references(() => forms.id),
    applyRoute: jsonb("apply_route").$type<ApplyRoute>(),
    contact: jsonb("contact").$type<Contact>(),
    conditionalItems: jsonb("conditional_items").$type<ConditionalItem[]>().notNull().default([]),
    evidence: jsonb("evidence").$type<Record<string, string>>().notNull().default({}),
    status: oppStatusEnum("status").notNull().default("open"),
    isSample: boolean("is_sample").notNull().default(true),
    currentVersion: integer("current_version").notNull().default(1),
    sourceDocumentId: uuid("source_document_id").references(() => sourceDocuments.id),
    sourceText: text("source_text"),
    sourceDate: date("source_date"),
    embedding: vector("embedding", { dimensions: 1024 }),
    publishedAt: timestamp("published_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("opportunities_search_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${t.postTitle}, '') || ' ' || coalesce(${t.location}, '') || ' ' || coalesce(${t.province}, '') || ' ' || coalesce(${t.referenceNumber}, ''))`,
    ),
    index("opportunities_closing_idx").on(t.closingDate),
  ],
);

export const opportunityVersions = pgTable(
  "opportunity_versions",
  {
    id: serial("id").primaryKey(),
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    record: jsonb("record").$type<Record<string, unknown>>().notNull(),
    changedFields: jsonb("changed_fields").$type<string[]>().notNull().default([]),
    sourceDocumentId: uuid("source_document_id").references(() => sourceDocuments.id),
    extractionId: uuid("extraction_id").references(() => extractions.id),
    note: text("note"),
    approvedBy: text("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("opportunity_versions_uniq").on(t.opportunityId, t.version)],
);

/* Cached AI outputs, keyed by opportunity version so they are regenerated after amendments. */
export const generatedChecklists = pgTable(
  "generated_checklists",
  {
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    items: jsonb("items").$type<{ group: string; item: string; source: string }[]>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.opportunityId, t.version] })],
);

export const generatedExplanations = pgTable(
  "generated_explanations",
  {
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    language: text("language").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.opportunityId, t.version, t.language] })],
);

/* ───────────── Applicants ───────────── */

export const applicantProfiles = pgTable("applicant_profiles", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  qualifications: jsonb("qualifications").$type<string[]>().notNull().default([]),
  licences: jsonb("licences").$type<string[]>().notNull().default([]),
  province: text("province"),
  languages: jsonb("languages").$type<string[]>().notNull().default([]),
  isSample: boolean("is_sample").notNull().default(true),
  // AI summary of the person's CV (personal details removed before reading; the file is never stored).
  cvProfile: jsonb("cv_profile").$type<Record<string, unknown>>(),
  cvMatches: jsonb("cv_matches").$type<{ id: string; fit: "strong" | "possible"; reasons: string[]; missing: string[] }[]>(),
  cvUpdatedAt: timestamp("cv_updated_at"),
  matchesUpdatedAt: timestamp("matches_updated_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const savedOpportunities = pgTable(
  "saved_opportunities",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    checklistState: jsonb("checklist_state").$type<Record<string, boolean>>().notNull().default({}),
    seenVersion: integer("seen_version").notNull().default(1),
    savedAt: timestamp("saved_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.opportunityId] })],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    message: text("message").notNull(),
    dedupeKey: text("dedupe_key"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notifications_dedupe").on(t.userId, t.dedupeKey)],
);

/* ───────────── Audit and analytics ───────────── */

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name"),
    actorDepartmentId: integer("actor_department_id").references(() => departments.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at").notNull().defaultNow(),
  },
  (t) => [index("audit_at_idx").on(t.at)],
);

export const funnelEvents = pgTable(
  "funnel_events",
  {
    id: serial("id").primaryKey(),
    sessionHash: text("session_hash").notNull(),
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    step: funnelStepEnum("step").notNull(),
    at: timestamp("at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("funnel_once").on(t.sessionHash, t.opportunityId, t.step)],
);


/* ───────────── Applications (applying inside iGovPath) ───────────── */

/** Z83-style answers. Personal information: visible only to the applicant and the department's officers; never sent to AI. */
export type Z83 = {
  surname: string; fullNames: string; dateOfBirth: string; idNumber: string; passportNumber?: string;
  citizenship: "sa" | "permanent_resident" | "other"; nationality?: string;
  phone: string; email: string; preferredLanguage?: string; contactMethod: "email" | "phone" | "post";
  driversLicence: boolean; disability?: boolean; gender?: string; race?: string;
  criminalRecord: boolean; criminalRecordDetails?: string;
  pendingCase: boolean; dismissed: boolean; businessWithState: boolean; businessDetails?: string;
  qualifications: { name: string; institution: string; year: string }[];
  experience: { employer: string; position: string; from: string; to: string; reason?: string }[];
  declaration: boolean;
};

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    departmentId: integer("department_id").notNull().references(() => departments.id),
    status: applicationStatusEnum("status").notNull().default("draft"),
    z83: jsonb("z83").$type<Partial<Z83>>().notNull().default({}),
    submittedAt: timestamp("submitted_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("applications_one_per_post").on(t.userId, t.opportunityId),
    index("applications_dept_status").on(t.departmentId, t.status),
  ],
);

export const applicationFiles = pgTable("application_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  kind: applicationFileKindEnum("kind").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  fromUserDocumentId: uuid("from_user_document_id"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

/** Status history shown to the applicant as a timeline. */
export const applicationEvents = pgTable("application_events", {
  id: serial("id").primaryKey(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  status: applicationStatusEnum("status").notNull(),
  note: text("note"),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  actorName: text("actor_name"),
  at: timestamp("at").notNull().defaultNow(),
});

/** The applicant's own document store: uploaded once, reused for every application.
 * CV and ID copy keep one current version each; qualifications and other documents can have several. */
export const userDocuments = pgTable(
  "user_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    kind: applicationFileKindEnum("kind").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("user_documents_user").on(t.userId)],
);
