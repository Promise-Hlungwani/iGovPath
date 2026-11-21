import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SampleBanner } from "@/components/sample-banner";
import { SiteHeader } from "@/components/site-header";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iGovPath",
  description:
    "One place for South African government jobs and learnerships: find posts, understand requirements and keep applications on track.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased min-h-screen flex flex-col`}>
        <SampleBanner />
        <SiteHeader />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t border-border text-sm text-muted">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row gap-2 justify-between">
            <span>iGovPath · Elime · Hackathon demo, November 2026</span>
            <span>AI proposes, a named official approves. Always check the original advert.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
