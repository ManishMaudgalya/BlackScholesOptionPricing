"use client";

import { SessionProvider } from "next-auth/react";

export function AppSessionProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SessionProvider>{children}</SessionProvider>;
}
