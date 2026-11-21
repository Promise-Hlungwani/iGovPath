import { ButtonLink, Card } from "@/components/ui";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="py-6">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight max-w-2xl">
          Government jobs and learnerships, in one place.
        </h1>
        <p className="mt-4 text-lg text-muted max-w-2xl">
          Find posts across national and provincial departments, see exactly which form and documents
          each one needs, and get told when a closing date or requirement changes.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/search">Find opportunities</ButtonLink>
          <ButtonLink href="/match" variant="secondary">What can I apply for?</ButtonLink>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <h2 className="font-semibold">One search</h2>
          <p className="mt-1 text-sm text-muted">
            Posts and learnerships with closing date, reference number, where to apply and the latest amendment.
          </p>
        </Card>
        <Card>
          <h2 className="font-semibold">A checklist per post</h2>
          <p className="mt-1 text-sm text-muted">
            The current Z83, documents to certify, and conditional items such as a SAQA evaluation.
          </p>
        </Card>
        <Card>
          <h2 className="font-semibold">Plain language</h2>
          <p className="mt-1 text-sm text-muted">
            Requirements explained simply, with the original wording beside it.
          </p>
        </Card>
      </section>
      <p className="text-sm text-muted">
        Work for a government department?{" "}
        <a href="/portal" className="text-brand underline">Go to the officer portal</a>.
      </p>
    </div>
  );
}
