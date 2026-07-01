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
          <h1>Google-backed access for saved calculations, portfolio holdings, and market snapshots.</h1>
          <p className="hero-copy">
            Sign in with Google, refresh Massive data for U.S. stocks or Yahoo Finance data for international symbols,
            and keep both market snapshots and Black-Scholes calculations in MongoDB.
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
            <strong>Massive + Yahoo</strong>
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
              Use the dashboard and portfolio refresh actions to store new market snapshots in MongoDB before they
              are applied to pricing or portfolio valuation.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
