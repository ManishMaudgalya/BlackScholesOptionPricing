"use client";

import { signIn } from "next-auth/react";

export function SignInHero() {
  return (
    <main className="page-shell">
      <section className="hero centered-hero">
        <div>
          <p className="kicker">Black-Scholes web terminal</p>
          <h1>Sign in with Google to save calculations and manage your AngelOne profile.</h1>
          <p className="hero-copy">
            This app now uses a real user model. Google authentication creates the user profile, MongoDB stores
            calculation history per user, and your profile page holds AngelOne connection settings.
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
