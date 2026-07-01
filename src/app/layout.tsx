import type { Metadata } from "next";
import { auth } from "@/auth";
import { AppSessionProvider } from "@/components/layout/session-provider";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Black-Scholes Option Pricing Webapp",
  description:
    "A Next.js option pricing dashboard with Black-Scholes analytics, Yahoo Finance history refreshes, and MongoDB-backed persistence.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <AppSessionProvider>
          <SiteHeader session={session} />
          {children}
        </AppSessionProvider>
      </body>
    </html>
  );
}
