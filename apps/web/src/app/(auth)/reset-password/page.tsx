import { ResetPasswordForm } from "../password-reset-forms";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  const invalid = typeof params.error === "string";
  return <ResetPasswordForm token={token} invalid={invalid} />;
}
