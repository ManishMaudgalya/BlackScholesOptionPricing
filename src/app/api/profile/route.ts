import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateUserProfile, serializeUserProfile } from "@/lib/services/user-profile";

type ProfileUpdateBody = {
  apiKey?: string;
  clientCode?: string;
  clientLocalIp?: string;
  clientPublicIp?: string;
  macAddress?: string;
};

function sanitizeValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
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

  return NextResponse.json({ profile: serializeUserProfile(profile) });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ProfileUpdateBody;
  const profile = await getOrCreateUserProfile({
    authUserId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    image: session.user.image ?? "",
  });

  profile.email = session.user.email ?? profile.email;
  profile.name = session.user.name ?? profile.name;
  profile.image = session.user.image ?? profile.image;
  profile.angelOne.apiKey = sanitizeValue(body.apiKey);
  profile.angelOne.clientCode = sanitizeValue(body.clientCode);
  profile.angelOne.clientLocalIp = sanitizeValue(body.clientLocalIp);
  profile.angelOne.clientPublicIp = sanitizeValue(body.clientPublicIp);
  profile.angelOne.macAddress = sanitizeValue(body.macAddress);
  await profile.save();

  return NextResponse.json({ profile: serializeUserProfile(profile) });
}
