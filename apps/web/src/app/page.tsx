import Link from "next/link";
import type { ReactNode } from "react";
import {
  IconArrowRight, IconBell, IconCheck, IconClipboard, IconLandmark, IconLanguages, IconPath, IconSearch,
} from "@/components/icons";

/* Home page. Dark teal design with a mint accent; full-bleed, independent of the light/dark theme. */
const MINT = "#000000";

export default function Home() {
  return (
    <div className="relative -mx-4 -my-8 w-[calc(100%+2rem)] overflow-hidden bg-white text-black">
      <div className="max-w-6xl mx-auto px-4">
        <div className="border-t border-black/10" />

        {/* Hero */}
        <section className="grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center py-10 sm:py-16 lg:py-24">
          <div>
            <p className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-semibold tracking-[0.16em] sm:tracking-[0.2em] uppercase" style={{ color: MINT }}>
              <span className="h-px w-6 sm:w-8 shrink-0" style={{ background: MINT }} />
              Government jobs, internships and learnerships
            </p>
            <h1 className="mt-5 sm:mt-6 text-4xl sm:text-6xl lg:text-[4.1rem] font-bold tracking-tight leading-[1.04] !text-black">
              <span className="lg:whitespace-nowrap">Every public service</span>{" "}
              <span className="block">opportunity,</span>
              <span className="block text-[#6b6b6b]">in one place.</span>
            </h1>
            <p className="mt-6 sm:mt-8 text-base sm:text-lg leading-relaxed text-black/70 max-w-xl">
              Find posts across national and provincial departments, see exactly which form and documents each one
              needs, and get told when a closing date or requirement changes.
            </p>
            <div className="mt-8 sm:mt-10 grid gap-3 sm:flex sm:flex-wrap sm:gap-4">
              <Link
                href="/search"
                className="inline-flex w-full items-center justify-center gap-3 rounded-lg px-5 py-3.5 font-semibold bg-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] hover:bg-[#222] transition sm:w-auto sm:justify-start sm:px-7 sm:py-4"
              >
                Find opportunities <IconArrowRight />
              </Link>
              <Link
                href="/match"
                className="inline-flex w-full items-center justify-center rounded-lg border border-black/25 px-5 py-3.5 font-semibold hover:bg-black/5 transition sm:w-auto sm:px-7 sm:py-4"
              >
                What can I apply for?
              </Link>
            </div>
            <p className="mt-6 sm:mt-8 flex items-center gap-2 text-sm text-black/60">
              <IconPath width={16} height={16} /> Innovated pathway to government employment
            </p>
          </div>

          <HeroVisual />
        </section>

        {/* Features */}
        <section className="pb-12">
          <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <p className="text-xs tracking-[0.25em] uppercase text-black/55 whitespace-nowrap">A simpler way forward</p>
            <span className="h-px flex-1 bg-black/10" />
          </div>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            <Feature icon={<IconSearch />} step="01 / Discover" title="One search" href="/search">
              Posts and learnerships with closing date, reference number, where to apply and the latest amendment.
            </Feature>
            <Feature icon={<IconClipboard />} step="02 / Prepare" title="A checklist per post" href="/search">
              The current Z83, documents to certify, and conditional items such as a SAQA evaluation.
            </Feature>
            <Feature icon={<IconLanguages />} step="03 / Understand" title="Plain language" href="/search">
              Requirements explained simply, in your language, with the original wording beside it.
            </Feature>
          </div>
        </section>

        {/* Officer banner */}
        <section className="pb-12 sm:pb-20">
          <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6 rounded-2xl border border-black/10 border-l-4 bg-black/[0.025] px-5 py-6 sm:px-8 sm:py-7" style={{ borderLeftColor: MINT }}>
            <div className="flex items-start gap-4 sm:items-center sm:gap-5">
              <span className="shrink-0 text-black/75"><IconLandmark width={34} height={34} strokeWidth={1.5} /></span>
              <div>
                <h2 className="font-semibold text-lg !text-black">Work for a government department?</h2>
                <p className="text-black/65 text-sm mt-1">Publish adverts, forms and amendments once. AI prepares the record; you approve it.</p>
              </div>
            </div>
            <Link href="/portal" className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-black/25 px-5 py-3 font-semibold hover:bg-black/5 transition sm:w-auto sm:px-6">
              Officer portal <IconArrowRight />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Feature({ icon, step, title, href, children }: { icon: ReactNode; step: string; title: string; href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-black/10 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-black/25 transition sm:p-7"
    >
      <div className="flex items-center justify-between">
        <span className="grid place-items-center h-12 w-12 rounded-xl border border-black/10 bg-black/[0.04]" style={{ color: MINT }}>{icon}</span>
        <span className="text-xs tracking-[0.18em] uppercase text-black/50">{step}</span>
      </div>
      <h3 className="mt-5 text-xl font-semibold !text-black sm:mt-6">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-black/65 sm:mt-3">{children}</p>
    </Link>
  );
}

function Chip({ icon, title, sub, className }: { icon: ReactNode; title: string; sub: string; className: string }) {
  return (
    <div className={`absolute flex items-center gap-4 rounded-xl border border-black/10 bg-white/80 px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.12)] backdrop-blur-md ${className}`}>
      <span className="grid place-items-center h-11 w-11 rounded-lg bg-black/[0.04] border border-black/10" style={{ color: MINT }}>{icon}</span>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-black/60 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative hidden lg:block h-[460px] [perspective:1400px]" aria-hidden>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.05),transparent_60%)]" />
      {/* Floating cube */}
      <div
        className="absolute -right-2 -top-6 z-20 h-14 w-14 rounded-xl rotate-12 shadow-[0_14px_30px_rgba(0,0,0,0.18)] motion-safe:animate-[float_6s_ease-in-out_infinite]"
        style={{ background: "linear-gradient(135deg, #4a4a4a, #000000 60%)" }}
      />
      {/* Card stack */}
      <div className="absolute left-[24%] top-[6%] w-[340px] [transform-style:preserve-3d] [transform:rotateX(14deg)_rotateY(-18deg)_rotateZ(-5deg)]">
        <div className="absolute inset-0 translate-x-6 -translate-y-3 rounded-2xl border border-black/10 bg-[#f4f4f4]" />
        <div className="relative rounded-2xl border border-black/10 bg-white p-7 shadow-[0_30px_60px_rgba(0,0,0,0.14)]">
          <div className="flex items-start justify-between">
            <p className="text-[10px] tracking-[0.25em] uppercase text-black/55">Your next chapter</p>
            <span style={{ color: MINT }}><IconPath width={18} height={18} /></span>
          </div>
          <p className="mt-4 text-[26px] leading-tight font-bold">A clearer path.<br />A new possibility.</p>
          <ul className="mt-6 space-y-3 text-sm text-black/75">
            {["Opportunities in one place", "Forms and documents, sorted", "Closing dates kept in view"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid place-items-center h-6 w-6 rounded-md border border-black/15 bg-black/[0.04]" style={{ color: MINT }}>
                  <IconCheck width={14} height={14} strokeWidth={2.4} />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-7 pt-4 border-t border-black/10 flex items-center justify-between text-xs text-black/55">
            <span>Less searching. More possibility.</span>
            <span className="rounded-md border border-black/15 px-2 py-1 text-black/75">iGovPath</span>
          </div>
        </div>
      </div>
      <Chip icon={<IconClipboard />} title="Know what you need" sub="A checklist for every post" className="left-0 top-2 z-10 [transform:rotate(-3deg)] motion-safe:animate-[float_7s_ease-in-out_infinite]" />
      <Chip icon={<IconBell />} title="Stay a step ahead" sub="Changes, without the guesswork" className="-right-4 -bottom-4 z-10 motion-safe:animate-[float_8s_ease-in-out_infinite_1s]" />
    </div>
  );
}
