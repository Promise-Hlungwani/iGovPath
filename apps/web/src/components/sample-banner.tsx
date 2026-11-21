import { SAMPLE_MODE } from "@/lib/flags";

export function SampleBanner() {
  if (!SAMPLE_MODE) return null;
  return (
    <div role="note" className="bg-warn-bg text-warn-ink text-center text-sm px-4 py-2">
      <strong className="font-semibold">SAMPLE DATA</strong> · Hackathon demo. Listings come from public
      government circulars and are labelled sample. Do not enter real personal information.
    </div>
  );
}
