import Link from "next/link";
import type { Session } from "next-auth";
import { AuthControls } from "@/components/auth/auth-controls";

type SiteHeaderProps = {
  session: Session | null;
};

export function SiteHeader({ session }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          BS Pricing Terminal
        </Link>

        <nav className="site-nav">
          <Link href="/">Dashboard</Link>
          {session?.user ? <Link href="/portfolio">Portfolio</Link> : null}
          {session?.user ? <Link href="/profile">Profile</Link> : null}
        </nav>

        <AuthControls
          isAuthenticated={Boolean(session?.user)}
          name={session?.user?.name}
          image={session?.user?.image}
        />
      </div>
    </header>
  );
}
