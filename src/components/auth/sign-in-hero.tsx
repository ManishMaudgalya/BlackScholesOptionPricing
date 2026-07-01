"use client";

import { signIn } from "next-auth/react";

export function SignInHero() {
  return (
    <main className="page-shell">
      <section className="hero centered-hero">
        <div>
          <p className="kicker">Black-Scholes Terminal</p>
          <h1>Sign in with Google to save option scenarios and sync live market data.</h1>
          <p className="hero-copy">
            Google authentication scopes the terminal to your account. MongoDB stores saved calculations,
            portfolio holdings, and market snapshots per user.
          </p>
          <div className="action-row">
            <button type="button" onClick={() => signIn("google")}>
              Continue with Google
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
