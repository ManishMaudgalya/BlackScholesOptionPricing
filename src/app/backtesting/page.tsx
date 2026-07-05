import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BacktestingDashboard } from "@/components/backtesting/backtesting-dashboard";

export default async function BacktestingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return <BacktestingDashboard user={session.user} />;
}
