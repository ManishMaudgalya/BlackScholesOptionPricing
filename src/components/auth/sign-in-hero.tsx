"use client";

import { signIn } from "next-auth/react";

export function SignInHero() {
  return (
    <main className="page-shell">
      <section className="hero centered-hero">
        <div>
          <p className="kicker">Black-Scholes web terminal</p>
          <h1>Sign in with Google to save calculations and refresh Yahoo Finance market history.</h1>
          <p className="hero-copy">
            Google authentication scopes the dashboard to your account. MongoDB stores your saved calculations and
            Yahoo Finance market snapshots per user.
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
