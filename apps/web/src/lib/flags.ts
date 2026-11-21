// Public (client-safe) view of the sample-data switch. Defaults to true: only
// an explicit "false" turns sample mode off.
export const SAMPLE_MODE =
  (process.env.NEXT_PUBLIC_SAMPLE_DATA_ONLY ?? process.env.SAMPLE_DATA_ONLY ?? "true").toLowerCase() !== "false";
