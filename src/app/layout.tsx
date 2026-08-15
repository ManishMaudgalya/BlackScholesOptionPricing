import type { Metadata } from "next";
import { auth } from "@/auth";
import { AppSessionProvider } from "@/components/layout/session-provider";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Black-Scholes",
  description:
    "A clean Black-Scholes app for option pricing, portfolios, backtests, and saved market data.",
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
