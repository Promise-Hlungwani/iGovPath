import { Card, PageTitle } from "@/components/ui";

/** Matches the Ask page, so the right outline shows while it opens. */
export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle sub="Answers come only from approved listings. If we don't know, we say so and point you to the department.">Ask about a post</PageTitle>
      <Card><div className="h-11 rounded-lg bg-black/[0.06] animate-pulse" /></Card>
    </div>
  );
}
