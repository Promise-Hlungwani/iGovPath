import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { SampleBanner } from "@/components/sample-banner";
import { SiteHeader } from "@/components/site-header";

const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "iGovPath",
  description:
    "One place for South African government jobs and learnerships: find posts, understand requirements and keep applications on track.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} antialiased min-h-screen flex flex-col`}>
        <SampleBanner />
        <SiteHeader />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">{children}</main>
        <footer className="bg-navy text-navy-ink/80 text-sm">
          <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row gap-3 justify-between">
            <span><strong className="text-white">iGovPath</strong> by Elime</span>
            <span>AI proposes, a named official approves. Always check the original advert.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
