import { ButtonLink, Card, PageTitle } from "@/components/ui";

export default function AccountDeleted() {
  return (
    <Card className="max-w-xl space-y-4">
      <PageTitle sub="Your account and the personal data linked to it have been permanently deleted.">Account deleted</PageTitle>
      <p className="text-sm text-muted">You can still search and read posts without an account, or sign up again at any time.</p>
      <ButtonLink href="/">Go to the home page</ButtonLink>
    </Card>
  );
}
