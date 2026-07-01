import type { Metadata } from "next";
import { auth } from "@/auth";
import { AppSessionProvider } from "@/components/layout/session-provider";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Black-Scholes Terminal",
  description:
    "A Bloomberg-style Black-Scholes terminal with Massive U.S. stock data, Yahoo Finance international coverage, and MongoDB-backed persistence.",
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
