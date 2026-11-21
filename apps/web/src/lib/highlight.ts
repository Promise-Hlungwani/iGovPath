/** Find evidence quotes inside source text, tolerant of line breaks, spacing, case and curly quotes. */
export function findRanges(text: string, quotes: string[]): [number, number][] {
  // Build a normalised copy of `text` with a map back to original indices.
  const map: number[] = [];
  let norm = "";
  let lastSpace = true;
  for (let i = 0; i < text.length; i++) {
    let ch = text[i].toLowerCase();
    if (ch === "’" || ch === "‘") ch = "'";
    if (ch === "–" || ch === "—") ch = "-";
    if (/\s/.test(ch)) {
      if (lastSpace) continue;
      ch = " ";
      lastSpace = true;
    } else lastSpace = false;
    norm += ch;
    map.push(i);
  }
  const ranges: [number, number][] = [];
  for (const q of quotes) {
    const nq = q.toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().replace(/^["'.\s]+|["'.\s]+$/g, "");
    if (nq.length < 4) continue;
    let from = 0;
    const idx = norm.indexOf(nq, from);
    if (idx >= 0) {
      ranges.push([map[idx], map[idx + nq.length - 1] + 1]);
      from = idx + nq.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}
