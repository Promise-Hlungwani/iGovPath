import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { NavProgress } from "@/components/nav-progress";
import { FlashToast } from "@/components/flash-toast";
import { Suspense } from "react";

const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500", "700", "900"] });

export const metadata: Metadata = {
  title: "iGovPath",
  description:
    "One place for South African government jobs and learnerships: find posts, understand requirements and keep applications on track.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. Grammarly) add attributes to <html>/<body>
    // before React loads. This only silences that mismatch on these two tags, not on the page content.
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} antialiased min-h-screen flex flex-col`} suppressHydrationWarning>
        <Suspense fallback={null}>
          <NavProgress />
          <FlashToast />
        </Suspense>
        <SiteHeader />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
