/* Small inline icons (lucide-style strokes), so the home page needs no icon library. */
import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...props,
});

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconClipboard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4.5V3h6v1.5" /><path d="m9 10 1.5 1.5L13 9" /><path d="M9 15.5h6" /></svg>
);
export const IconLanguages = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 5h8M8 3v2m2.5 0c-.8 3.6-3 6.3-6.5 8" /><path d="M6 9c1 1.8 2.8 3.2 5 4" /><path d="m13 21 4-9 4 9m-6.8-3h5.6" /></svg>
);
export const IconLandmark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 21h18M4 10h16M12 3 4 7.5V10h16V7.5L12 3Z" /><path d="M6 10v8m4-8v8m4-8v8m4-8v8M4 18h16" /></svg>
);
export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" /></svg>
);
export const IconArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconPath = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 21V11a5 5 0 0 1 5-5h7" /><path d="m15 3 3 3-3 3" /></svg>
);
