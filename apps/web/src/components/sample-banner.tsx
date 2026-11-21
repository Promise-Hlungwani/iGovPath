import { SAMPLE_MODE } from "@/lib/flags";

/** Privacy notice, shown while SAMPLE_DATA_ONLY is on (see .env). */
export function SampleBanner() {
  if (!SAMPLE_MODE) return null;
  return (
    <div role="note" className="bg-teal text-white/90 text-center text-xs sm:text-sm px-4 py-1.5">
      Listings are copied from the DPSA Public Service Vacancy Circulars and are not yet confirmed by the departments.
      Never enter your ID number or other personal information.
    </div>
  );
}
