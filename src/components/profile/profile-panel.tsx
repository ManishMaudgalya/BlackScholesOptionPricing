type UserData = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function ProfilePanel({ user }: { user: UserData }) {
  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="kicker">Account</p>
          <h1>Google-backed access for saved calculations and Yahoo market snapshots.</h1>
          <p className="hero-copy">
            This app no longer stores Angel One credentials. Sign in with Google, refresh Yahoo Finance history on
            the dashboard, and keep both market snapshots and Black-Scholes calculations in MongoDB.
          </p>
        </div>

        <div className="hero-panel">
          <div>
            <span className="panel-label">Signed in as</span>
            <strong>{user.name ?? "User"}</strong>
          </div>
          <div>
            <span className="panel-label">Email</span>
            <strong>{user.email ?? "—"}</strong>
          </div>
          <div>
            <span className="panel-label">Market data source</span>
            <strong>Yahoo Finance</strong>
          </div>
          <div>
            <span className="panel-label">Persistence</span>
            <strong>MongoDB</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <p className="kicker">Profile</p>
          <h2>Account summary</h2>
        </div>

        <div className="profile-summary">
          {user.image ? <img src={user.image} alt={user.name ?? "Profile"} className="profile-photo" /> : null}
          <div>
            <p className="profile-name">{user.name ?? "User"}</p>
            <p className="profile-email">{user.email ?? "—"}</p>
            <p className="helper-text">
              Use the dashboard refresh button to pull the latest available daily history for a Yahoo Finance
              symbol. The app stores that snapshot in MongoDB before applying it to the pricing model.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
