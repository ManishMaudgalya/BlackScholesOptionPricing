"use client";

import { useEffect, useState, useTransition } from "react";

type UserData = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type ProfileResponse = {
  authUserId: string;
  email: string;
  name: string;
  image: string;
  angelOne: {
    apiKey: string;
    clientCode: string;
    clientLocalIp: string;
    clientPublicIp: string;
    macAddress: string;
    session: {
      status: "connected" | "disconnected" | "error";
      loggedInAt: string;
      lastConnectedAt: string;
      errorMessage: string;
    };
  };
};

type ProfilePanelProps = {
  user: UserData;
};

const initialProfileState: ProfileResponse = {
  authUserId: "",
  email: "",
  name: "",
  image: "",
  angelOne: {
    apiKey: "",
    clientCode: "",
    clientLocalIp: "",
    clientPublicIp: "",
    macAddress: "",
    session: {
      status: "disconnected",
      loggedInAt: "",
      lastConnectedAt: "",
      errorMessage: "",
    },
  },
};

function statusLabel(status: ProfileResponse["angelOne"]["session"]["status"]) {
  if (status === "connected") {
    return "Connected";
  }
  if (status === "error") {
    return "Failed";
  }
  return "Disconnected";
}

export function ProfilePanel({ user }: ProfilePanelProps) {
  const [profile, setProfile] = useState<ProfileResponse>(initialProfileState);
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const payload = (await response.json()) as { profile?: ProfileResponse; error?: string };
        if (response.ok && payload.profile) {
          setProfile(payload.profile);
          return;
        }
        setMessage(payload.error ?? "Failed to load profile.");
      })();
    });
  }, []);

  function updateAngelOneField(field: keyof ProfileResponse["angelOne"], value: string) {
    setProfile((current) => ({
      ...current,
      angelOne: {
        ...current.angelOne,
        [field]: value,
      },
    }));
  }

  async function saveProfile() {
    setMessage("");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: profile.angelOne.apiKey,
        clientCode: profile.angelOne.clientCode,
        clientLocalIp: profile.angelOne.clientLocalIp,
        clientPublicIp: profile.angelOne.clientPublicIp,
        macAddress: profile.angelOne.macAddress,
      }),
    });
    const payload = (await response.json()) as { profile?: ProfileResponse; error?: string };
    if (!response.ok || !payload.profile) {
      setMessage(payload.error ?? "Unable to save profile.");
      return;
    }
    setProfile(payload.profile);
    setMessage("Profile saved.");
  }

  async function connectAngelOne() {
    setMessage("");
    const response = await fetch("/api/angelone/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password, totp }),
    });
    const payload = (await response.json()) as {
      profile?: ProfileResponse;
      error?: string;
      message?: string;
    };
    if (payload.profile) {
      setProfile(payload.profile);
    }
    setMessage(payload.message ?? payload.error ?? "Unable to connect to AngelOne.");
    if (response.ok) {
      setPassword("");
      setTotp("");
    }
  }

  async function disconnectAngelOne() {
    setMessage("");
    const response = await fetch("/api/angelone/disconnect", {
      method: "POST",
    });
    const payload = (await response.json()) as {
      profile?: ProfileResponse;
      error?: string;
      message?: string;
    };
    if (payload.profile) {
      setProfile(payload.profile);
    }
    setMessage(payload.message ?? payload.error ?? "Unable to disconnect AngelOne.");
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="kicker">User profile</p>
          <h1>Google-backed account with AngelOne connection settings.</h1>
          <p className="hero-copy">
            Your Google sign-in creates the app identity. This profile stores your AngelOne API configuration
            and lets you authenticate against SmartAPI directly from the web application.
          </p>
        </div>

        <div className="hero-panel">
          <div>
            <span className="panel-label">Signed in as</span>
            <strong>{user.name ?? profile.name ?? "User"}</strong>
          </div>
          <div>
            <span className="panel-label">Email</span>
            <strong>{user.email ?? profile.email ?? "—"}</strong>
          </div>
          <div>
            <span className="panel-label">AngelOne</span>
            <strong>{statusLabel(profile.angelOne.session.status)}</strong>
          </div>
        </div>
      </section>

      <section className="split-panel">
        <article className="panel">
          <div className="panel-heading">
            <p className="kicker">Google profile</p>
            <h2>Identity snapshot</h2>
          </div>
          <div className="profile-summary">
            {user.image ? <img src={user.image} alt={user.name ?? "Profile"} className="profile-photo" /> : null}
            <div>
              <p className="profile-name">{user.name ?? "User"}</p>
              <p className="profile-email">{user.email ?? "—"}</p>
              <p className="helper-text">
                Your Google login identifies the app account. AngelOne settings below are attached to your
                persisted MongoDB profile, keyed by your authenticated user ID.
              </p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <p className="kicker">AngelOne settings</p>
            <h2>Persisted SmartAPI configuration</h2>
          </div>

          <div className="form-grid">
            <label>
              API Key
              <input
                type="password"
                value={profile.angelOne.apiKey}
                onChange={(event) => updateAngelOneField("apiKey", event.target.value)}
              />
            </label>
            <label>
              Client Code
              <input
                type="text"
                value={profile.angelOne.clientCode}
                onChange={(event) => updateAngelOneField("clientCode", event.target.value)}
              />
            </label>
            <label>
              Client Local IP
              <input
                type="text"
                value={profile.angelOne.clientLocalIp}
                onChange={(event) => updateAngelOneField("clientLocalIp", event.target.value)}
              />
            </label>
            <label>
              Client Public IP
              <input
                type="text"
                value={profile.angelOne.clientPublicIp}
                onChange={(event) => updateAngelOneField("clientPublicIp", event.target.value)}
              />
            </label>
            <label>
              MAC Address
              <input
                type="text"
                value={profile.angelOne.macAddress}
                onChange={(event) => updateAngelOneField("macAddress", event.target.value)}
              />
            </label>
          </div>

          <div className="action-row">
            <button type="button" onClick={saveProfile} disabled={isPending}>
              Save profile settings
            </button>
          </div>

          <div className="status-strip">
            <span className={`status-badge status-${profile.angelOne.session.status}`}>
              {statusLabel(profile.angelOne.session.status)}
            </span>
            <span>
              Last connected: {profile.angelOne.session.lastConnectedAt ? new Date(profile.angelOne.session.lastConnectedAt).toLocaleString() : "—"}
            </span>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <p className="kicker">AngelOne login</p>
          <h2>Authenticate without storing password or TOTP</h2>
        </div>

        <div className="form-grid">
          <label>
            Password / PIN
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>
            TOTP / 2FA
            <input type="password" value={totp} onChange={(event) => setTotp(event.target.value)} />
          </label>
        </div>

        <div className="action-row">
          <button type="button" onClick={connectAngelOne} disabled={isPending}>
            Connect AngelOne
          </button>
          <button type="button" className="ghost-button" onClick={disconnectAngelOne} disabled={isPending}>
            Clear AngelOne session
          </button>
        </div>

        <p className="helper-text">
          The profile stores API key, client code, network headers, and issued session tokens. Password and TOTP
          are used only for the login request and are not saved.
        </p>
        {profile.angelOne.session.loggedInAt ? (
          <p className="helper-text">AngelOne session issued at: {profile.angelOne.session.loggedInAt}</p>
        ) : null}
        {profile.angelOne.session.errorMessage ? (
          <p className="feedback error">{profile.angelOne.session.errorMessage}</p>
        ) : null}
        {message ? <p className="feedback">{message}</p> : null}
      </section>
    </main>
  );
}
