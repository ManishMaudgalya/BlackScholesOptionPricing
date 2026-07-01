import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortfolioDashboard } from "@/components/portfolio/portfolio-dashboard";

export default async function PortfolioPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return <PortfolioDashboard user={session.user} />;
}
