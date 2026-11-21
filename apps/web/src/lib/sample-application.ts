import "server-only";
import type { Z83 } from "@/db/schema";
import type { FileKind } from "@/lib/applications";

/** Sample answers for testing: the person's own name and email, everything else made up. */
export function sampleZ83(name: string, email: string): Partial<Z83> {
  const parts = name.trim().split(/\s+/);
  return {
    ...SAMPLE_REST,
    fullNames: parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0],
    surname: parts.length > 1 ? parts[parts.length - 1] : parts[0],
    email,
  };
}

const SAMPLE_REST: Partial<Z83> = {
  dateOfBirth: "1995-06-22",
  idNumber: "9506225123081",
  citizenship: "sa",
  phone: "0824447788",
  preferredLanguage: "English",
  contactMethod: "email",
  driversLicence: true,
  disability: false,
  criminalRecord: false,
  pendingCase: false,
  dismissed: false,
  businessWithState: false,
  qualifications: [
    { name: "National Senior Certificate", institution: "Soshanguve High School", year: "2013" },
    { name: "National Diploma: Information Technology", institution: "Tshwane University of Technology", year: "2017" },
  ],
  experience: [
    { employer: "Gauteng Department of Health", position: "IT Support Technician", from: "March 2019", to: "now" },
    { employer: "City of Tshwane", position: "IT Intern", from: "February 2018", to: "January 2019", reason: "Internship ended" },
  ],
};

/** The text of each sample document (version lets us test "upload a newer one"). */
export function sampleDocText(kind: FileKind, person: { name: string; email: string }, version = 1): { fileName: string; title: string; lines: string[] } {
  const z = sampleZ83(person.name, person.email);
  const name = `${z.fullNames} ${z.surname}`;
  switch (kind) {
    case "cv":
      return {
        fileName: version > 1 ? `Sample CV - ${name} (updated).pdf` : `Sample CV - ${name}.pdf`,
        title: `Curriculum Vitae: ${name}`,
        lines: [
          "SAMPLE DOCUMENT - FOR TESTING ONLY",
          version > 1 ? "Version 2 (updated)" : "Version 1",
          "",
          `Email: ${z.email}   Phone: ${z.phone}`,
          "",
          "QUALIFICATIONS",
          ...(z.qualifications ?? []).map((q) => `- ${q.name}, ${q.institution} (${q.year})`),
          ...(version > 1 ? ["- CompTIA A+ certificate (2025)"] : []),
          "",
          "EXPERIENCE",
          ...(z.experience ?? []).map((x) => `- ${x.position}, ${x.employer} (${x.from} - ${x.to})`),
          "",
          "SKILLS",
          "- Desktop and network support, Active Directory, Microsoft 365",
          "- Customer service and user training",
          "- Driver's licence (Code B)",
        ],
      };
    case "id_copy":
      return {
        fileName: `Sample certified ID copy - ${name}.pdf`,
        title: "Certified copy of identity document",
        lines: [
          "SAMPLE DOCUMENT - FOR TESTING ONLY",
          "",
          "REPUBLIC OF SOUTH AFRICA - IDENTITY DOCUMENT (SAMPLE)",
          `Surname: ${z.surname}`,
          `Names: ${z.fullNames}`,
          `Identity number: ${z.idNumber}`,
          "Date of birth: 22 June 1995",
          "",
          "CERTIFIED A TRUE COPY OF THE ORIGINAL (SAMPLE STAMP)",
          "Commissioner of Oaths: SAMPLE ONLY",
          "Date certified: 3 November 2026",
        ],
      };
    case "qualification":
      return {
        fileName: `Sample certified qualification - ${name}.pdf`,
        title: "Certified copy of qualification",
        lines: [
          "SAMPLE DOCUMENT - FOR TESTING ONLY",
          "",
          "Tshwane University of Technology (SAMPLE)",
          "This is to certify that",
          name,
          "was awarded the",
          "National Diploma: Information Technology",
          "on 15 April 2017",
          "",
          "CERTIFIED A TRUE COPY OF THE ORIGINAL (SAMPLE STAMP)",
          "Date certified: 3 November 2026",
        ],
      };
    default:
      return {
        fileName: `Sample supplementary form - ${name}.pdf`,
        title: "Supplementary application form",
        lines: [
          "SAMPLE DOCUMENT - FOR TESTING ONLY",
          "",
          `Applicant: ${name}`,
          `ID number: ${z.idNumber}`,
          "Why I am applying: I want to grow my career in public service IT support.",
          "Available to start: 1 January 2027",
          `Signed: ${name} (sample)`,
        ],
      };
  }
}

/** A small, valid one-page PDF with plain text (no extra library needed). */
export function makeSimplePdf(title: string, lines: string[]): Buffer {
  const esc = (t: string) => t.replace(/[^\x20-\x7e]/g, "-").replace(/([()\\])/g, "\\$1");
  const body = [
    "BT /F2 18 Tf 60 780 Td (" + esc(title) + ") Tj ET",
    ...lines.map((l, i) => `BT /F1 11 Tf 60 ${745 - i * 18} Td (${esc(l)}) Tj ET`),
  ].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
