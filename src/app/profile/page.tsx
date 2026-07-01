import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProfilePanel } from "@/components/profile/profile-panel";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return <ProfilePanel user={session.user} />;
}
