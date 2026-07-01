import { auth } from "@/auth";
import { SignInHero } from "@/components/auth/sign-in-hero";
import { PricingDashboard } from "@/components/pricing/pricing-dashboard";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return <SignInHero />;
  }

  return <PricingDashboard user={session.user} />;
}
