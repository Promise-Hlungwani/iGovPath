import { ButtonLink, Card } from "@/components/ui";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-navy text-navy-ink px-6 py-12 sm:px-12 sm:py-16 relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-brand/25 to-transparent hidden md:block" aria-hidden />
        <p className="text-accent font-medium text-sm uppercase tracking-wider">Government jobs, internships and learnerships</p>
        <h1 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight max-w-3xl text-white">
          Every public service opportunity, in one place.
        </h1>
        <p className="mt-5 text-lg text-white/80 max-w-2xl">
          Find posts across national and provincial departments, see exactly which form and documents each one needs,
          and get told when a closing date or requirement changes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/search" className="px-6 py-3 text-base">Find opportunities</ButtonLink>
          <ButtonLink href="/match" variant="secondary" className="px-6 py-3 text-base bg-transparent text-white border-white/40 hover:bg-white/10">
            What can I apply for?
          </ButtonLink>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="border-t-4 border-t-brand">
          <h2 className="font-bold">One search</h2>
          <p className="mt-1 text-sm text-muted">
            Posts and learnerships with closing date, reference number, where to apply and the latest amendment.
          </p>
        </Card>
        <Card className="border-t-4 border-t-accent">
          <h2 className="font-bold">A checklist per post</h2>
          <p className="mt-1 text-sm text-muted">
            The current Z83, documents to certify, and conditional items such as a SAQA evaluation.
          </p>
        </Card>
        <Card className="border-t-4 border-t-teal">
          <h2 className="font-bold">Plain language</h2>
          <p className="mt-1 text-sm text-muted">
            Requirements explained simply, in your language, with the original wording beside it.
          </p>
        </Card>
      </section>
      <Card className="flex flex-wrap items-center justify-between gap-4 bg-brand-soft border-brand/30">
        <div>
          <h2 className="font-bold">Work for a government department?</h2>
          <p className="text-sm text-muted">Publish adverts, forms and amendments once. AI prepares the record; you approve it.</p>
        </div>
        <ButtonLink href="/portal">Officer portal</ButtonLink>
      </Card>
    </div>
  );
}
