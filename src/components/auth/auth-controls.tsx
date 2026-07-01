"use client";

import { signIn, signOut } from "next-auth/react";

type AuthControlsProps = {
  isAuthenticated: boolean;
  name?: string | null;
  image?: string | null;
};

export function AuthControls({ isAuthenticated, name, image }: AuthControlsProps) {
  if (!isAuthenticated) {
    return (
      <button type="button" onClick={() => signIn("google")}>
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="auth-cluster">
      <div className="user-pill">
        {image ? <img src={image} alt={name ?? "User"} className="avatar" /> : <span className="avatar-fallback" />}
        <span>{name ?? "Signed in"}</span>
      </div>
      <button type="button" className="ghost-button" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}
