"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const MAIN_PAGES = new Set([
  "/", "/search", "/match", "/assistant", "/saved", "/portal", "/admin/users",
  "/account", "/sign-in", "/sign-up", "/accuracy", "/notifications",
]);

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (!pathname || MAIN_PAGES.has(pathname)) return null;

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    const path = window.location.pathname;
    const post = path.match(/^\/posts\/([^/]+)(?:\/(.+))?$/);
    if (post?.[2]) router.push(`/posts/${post[1]}`);
    else if (post) router.push("/search");
    else if (path.startsWith("/portal/")) router.push("/portal");
    else if (path === "/portal") router.push("/search");
    else if (path.startsWith("/admin/")) router.push("/admin/users");
    else if (path === "/admin/users") router.push("/");
    else router.push("/");
  }

  return (
    <div className="mb-5">
      <Button type="button" variant="ghost" onClick={goBack} className="px-2">
        <span aria-hidden="true">←</span> Back
      </Button>
    </div>
  );
}
