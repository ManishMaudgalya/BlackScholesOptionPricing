import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateUserProfile, serializeUserProfile } from "@/lib/services/user-profile";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getOrCreateUserProfile({
    authUserId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    image: session.user.image ?? "",
  });

  profile.angelOne.session.jwtToken = "";
  profile.angelOne.session.refreshToken = "";
  profile.angelOne.session.feedToken = "";
  profile.angelOne.session.loggedInAt = "";
  profile.angelOne.session.status = "disconnected";
  profile.angelOne.session.errorMessage = "";
  profile.angelOne.session.lastConnectedAt = new Date();
  await profile.save();

  return NextResponse.json({
    profile: serializeUserProfile(profile),
    message: "AngelOne session cleared.",
  });
}
