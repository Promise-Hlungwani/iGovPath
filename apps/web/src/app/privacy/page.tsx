import Link from "next/link";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "How we handle your information · iGovPath" };

/** Plain-language description of what the system does with personal information. Facts only. */
export default function PrivacyPage() {
  const sections: [string, React.ReactNode][] = [
    ["What we keep", <>Your account (name, email and a protected password), the jobs you save, your messages, the documents you upload (CV, certified ID copy, qualifications) and the applications you send, including your Z83 answers.</>],
    ["Who can see your applications", <>Only you, and the officers of the department that advertised the job (and iGovPath admins). Officers see ID numbers hidden in their lists. Other departments can&apos;t see your application at all.</>],
    ["How AI is used", <>AI reads the public job adverts that departments upload, and a department officer checks and approves everything before it is published. Nothing from your applications or documents is sent to an AI model. The AI never ranks, scores, shortlists or rejects anyone.</>],
    ["“What can I apply for?”", <>If you choose to upload a CV there and tick the consent box, your name, ID number, contact details and address are removed first. The file is not kept; only a short summary of your skills is saved on your account, and you can remove it at any time.</>],
    ["Who decides", <>Every outcome on an application (being reviewed, shortlisted, not successful, appointed) is set by a named department officer. Each change is recorded with who made it and when.</>],
    ["Deleting your account", <>Open the menu under your initials and choose <strong>Delete account</strong>. Your account, saved jobs, messages, documents and applications are deleted for good.</>],
  ];
  return (
    <div className="max-w-3xl">
      <PageTitle sub="What iGovPath keeps about you, who can see it, and how AI is used. In plain language.">How we handle your information</PageTitle>
      <div className="space-y-4">
        {sections.map(([h, body]) => (
          <section key={h} className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-extrabold">{h}</h2>
            <p className="mt-2 text-[15px] text-muted">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">Job adverts on iGovPath are copied from public government circulars. Always check the original advert, linked on every job. <Link className="underline" href="/search">Find opportunities</Link></p>
    </div>
  );
}
