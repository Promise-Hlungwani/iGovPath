import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { and, eq } from "drizzle-orm";
import { db, schema } from "./index";
import { ai, intakePdf } from "@/lib/ai";
import { REPO_ROOT, UPLOAD_DIR } from "@/lib/paths";

const VACANCIES_URL = "https://www.sita.co.za/vacancies";
const dryRun = process.argv.includes("--dry-run");
const renameOnly = process.argv.includes("--rename-only");
const execFileAsync = promisify(execFile);
const PACE_MS = 8_000;

function readablePdfName(title: string, sha256: string) {
  const base = title
    .replace(/:/g, " -")
    .replace(/[<>"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 100)
    .trim();
  return `${base || "SITA Vacancy"} - ${sha256.slice(0, 8)}.pdf`;
}

async function download(url: string): Promise<Buffer> {
  const { stdout } = await execFileAsync("curl.exe", ["-L", "-sS", "--fail", url], {
    encoding: "buffer",
    maxBuffer: 20 * 1024 * 1024,
  });
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
}

async function downloadText(url: string): Promise<string> {
  const { stdout } = await execFileAsync("curl.exe", ["-L", "-sS", "--fail", url], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  return String(stdout);
}

type Vacancy = {
  title: string;
  pdfUrl: string;
  closingDate: string | null;
  department: string | null;
  location: string | null;
  level: string | null;
  applyUrl: string | null;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function field(row: string, label: string) {
  const match = row.match(new RegExp(`<strong>${label}: <\\/strong>(.*?)<`, "i"));
  return match ? decodeHtml(match[1]) : null;
}

async function fetchVacancies(): Promise<Vacancy[]> {
  const html = await downloadText(VACANCIES_URL);
  const titles = [...html.matchAll(/<h4><b>([\s\S]*?)<\/b><\/h4>/gi)];
  const vacancies: Vacancy[] = [];

  for (let i = 0; i < titles.length; i++) {
    const start = titles[i].index ?? 0;
    const end = i + 1 < titles.length ? (titles[i + 1].index ?? html.length) : html.length;
    const row = html.slice(start, end);
    const pdf = row.match(/<a href="([^"]+\.pdf)"[^>]*type="application\/pdf"/i);
    if (!pdf) continue;

    const closingTime = row.match(/<time datetime="([^"]+)"/i);
    const closingDate = closingTime?.[1]?.slice(0, 10) ?? null;
    const apply = row.match(/<a class="apply-btn" href="([^"]+)"/i);
    vacancies.push({
      title: decodeHtml(titles[i][1]),
      pdfUrl: new URL(pdf[1], VACANCIES_URL).toString(),
      closingDate,
      department: field(row, "Department"),
      location: field(row, "Location"),
      level: field(row, "Level"),
      applyUrl: apply ? new URL(apply[1], VACANCIES_URL).toString() : null,
    });
  }
  return vacancies;
}

async function importVacancies() {
  const vacancies = await fetchVacancies();
  if (vacancies.length === 0) throw new Error("No SITA vacancy PDFs were found.");

  if (dryRun) {
    console.log(`Found ${vacancies.length} open SITA vacancies.`);
    vacancies.forEach((v, i) => console.log(`${i + 1}. ${v.title} | ${v.closingDate ?? "closing date not stated"} | ${v.pdfUrl}`));
    return { vacancies: vacancies.length, imported: 0 };
  }

  const [department] = await db
    .insert(schema.departments)
    .values({ name: "State Information Technology Agency (SITA)", sphere: "agency", province: "Gauteng", isSample: true })
    .onConflictDoUpdate({
      target: schema.departments.name,
      set: { sphere: "agency", province: "Gauteng", isSample: true },
    })
    .returning();

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(path.join(REPO_ROOT, "data", "sources"), { recursive: true });
  let imported = 0;

  const sitaDocs = await db
    .select()
    .from(schema.sourceDocuments)
    .where(eq(schema.sourceDocuments.departmentId, department.id));
  for (const doc of sitaDocs) {
    const oldPath = path.join(UPLOAD_DIR, path.basename(doc.filePath));
    const friendlyName = readablePdfName(doc.title, doc.sha256);
    const newPath = path.join(UPLOAD_DIR, friendlyName);
    let renamed = false;
    try {
      await fs.rename(oldPath, newPath);
      renamed = true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "EEXIST") throw error;
    }
    await db.update(schema.sourceDocuments).set({
      fileName: friendlyName,
      filePath: `data/uploads/${friendlyName}`,
    }).where(eq(schema.sourceDocuments.id, doc.id));
    if (renamed) {
      await db.insert(schema.auditLog).values({
        actorName: "SITA vacancy importer",
        actorDepartmentId: department.id,
        action: "document.rename",
        entity: "source_document",
        entityId: doc.id,
        before: { fileName: doc.fileName, filePath: doc.filePath },
        after: { fileName: friendlyName, filePath: `data/uploads/${friendlyName}` },
      });
    }
  }

  if (renameOnly) return { vacancies: vacancies.length, imported: 0 };

  for (const vacancy of vacancies) {
    let bytes: Buffer;
    try {
      bytes = await download(vacancy.pdfUrl);
    } catch {
      console.warn(`Skipped ${vacancy.title}: could not download PDF.`);
      continue;
    }
    if (bytes.subarray(0, 4).toString() !== "%PDF") {
      console.warn(`Skipped ${vacancy.title}: downloaded file is not a PDF.`);
      continue;
    }

    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    let [doc] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.sha256, sha256));

    if (!doc) {
      const intake = await intakePdf(bytes, `${vacancy.title}.pdf`);
      const fileName = readablePdfName(vacancy.title, sha256);
      await fs.writeFile(path.join(UPLOAD_DIR, fileName), bytes);
      [doc] = await db
        .insert(schema.sourceDocuments)
        .values({
          departmentId: department.id,
          kind: "advert",
          title: vacancy.title,
          fileName: `${vacancy.title}.pdf`,
          filePath: `data/uploads/${fileName}`,
          sha256,
          pageCount: intake.page_count,
          pages: intake.pages,
          documentDate: null,
          sourceUrl: vacancy.pdfUrl,
          isSample: true,
        })
        .returning();
      await db.insert(schema.auditLog).values({
        actorName: "SITA vacancy importer",
        actorDepartmentId: department.id,
        action: "document.import",
        entity: "source_document",
        entityId: doc.id,
        after: { title: doc.title, sourceUrl: vacancy.pdfUrl, sha256, pageCount: doc.pageCount, isSample: true },
      });
      imported++;
    }

    const text = doc.pages.map((page) => page.text).join("\n").slice(0, 15_000);
    const [existingExtraction] = await db
      .select({ id: schema.extractions.id })
      .from(schema.extractions)
      .where(and(eq(schema.extractions.sourceDocumentId, doc.id), eq(schema.extractions.chunkRef, "all")));
    if (!existingExtraction) {
      try {
        console.log(`Extracting ${vacancy.title} (${text.length} characters)…`);
        const result = await ai.extract(text, true, null);
        const [extraction] = await db
          .insert(schema.extractions)
          .values({
            sourceDocumentId: doc.id,
            chunkRef: "all",
            chunkText: text,
            chunkPage: 1,
            mode: "new",
            rawJson: result.record,
            record: result.record as unknown as Record<string, unknown>,
            flags: result.flags,
            model: result.model,
            status: result.status,
            departmentId: department.id,
          })
          .returning();
        await db.insert(schema.auditLog).values({
          actorName: "SITA vacancy importer",
          actorDepartmentId: department.id,
          action: "extraction.create",
          entity: "extraction",
          entityId: extraction.id,
          after: { sourceDocumentId: doc.id, status: extraction.status, flags: result.flags.length },
        });
      } catch (error) {
        console.warn(`Skipped extraction for ${vacancy.title}: ${error instanceof Error ? error.message : "AI extraction failed"}`);
      }
      await new Promise((resolve) => setTimeout(resolve, PACE_MS));
    }
  }

  return { vacancies: vacancies.length, imported };
}

importVacancies()
  .then((result) => {
    console.log(`SITA import complete: ${result.vacancies} vacancies found, ${result.imported} newly imported.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "SITA import failed.");
    process.exit(1);
  });
