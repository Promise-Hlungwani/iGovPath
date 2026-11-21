import { findRanges } from "@/lib/highlight";

export function HighlightedText({ text, quotes }: { text: string; quotes: string[] }) {
  const ranges = findRanges(text, quotes);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], i) => {
    if (s > pos) parts.push(text.slice(pos, s));
    parts.push(<mark key={i} className="evidence">{text.slice(s, e)}</mark>);
    pos = e;
  });
  parts.push(text.slice(pos));
  return <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans">{parts}</pre>;
}
