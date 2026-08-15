"use client";

import { signIn } from "next-auth/react";

export function SignInHero() {
  return (
    <main className="page-shell">
      <section className="hero centered-hero">
        <div>
          <p className="kicker">Black-Scholes</p>
          <h1>Sign in to save pricing scenarios and portfolio work.</h1>
          <p className="hero-copy">
            Your account keeps saved calculations, portfolio holdings, and market snapshots in one place.
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
