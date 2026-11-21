const KEEP_UPPER = new Set([
  "HR", "IT", "ICT", "TVET", "SAPS", "SAQA", "DSD", "DHA", "GCIS", "OHS", "CET", "PHC", "ICU", "PNB1", "PNB2",
  "SMS", "CFO", "CEO", "MEC", "NQF", "PDP", "ID", "CV", "Z83", "ECD", "SCM", "MR1", "MR6", "GPW", "SITA", "LDARD", "OSD",
]);
const SMALL = new Set(["and", "of", "the", "for", "to", "in", "on", "at", "a", "an", "&"]);

/** Turn "ADMINISTRATIVE CLERK STORES" into "Administrative Clerk Stores", keeping acronyms. */
export function displayTitle(s: string | null | undefined): string {
  if (!s) return "";
  const letters = s.replace(/[^A-Za-z]/g, "");
  const upper = letters.replace(/[^A-Z]/g, "").length;
  if (letters.length === 0 || upper / letters.length < 0.7) return s;
  return s
    .toLowerCase()
    .split(/(\s+|\/|\(|\)|-|:)/)
    .map((w, i) => {
      if (!w.trim() || /^[\s/():-]+$/.test(w)) return w;
      const up = w.toUpperCase();
      if (KEEP_UPPER.has(up) || /^\(?x\d+$/i.test(w) || /\d/.test(w)) return up;
      if (i > 0 && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
}

export function oneLine(s: string | null | undefined, max = 160) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
