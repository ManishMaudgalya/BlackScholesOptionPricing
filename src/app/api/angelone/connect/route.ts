import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authenticateAngelOne } from "@/lib/services/angelone";
import { getOrCreateUserProfile, serializeUserProfile } from "@/lib/services/user-profile";

type AngelOneConnectBody = {
  password?: string;
  totp?: string;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as AngelOneConnectBody;
  const profile = await getOrCreateUserProfile({
    authUserId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    image: session.user.image ?? "",
  });

  if (
    !profile.angelOne.apiKey ||
    !profile.angelOne.clientCode ||
    !profile.angelOne.clientLocalIp ||
    !profile.angelOne.clientPublicIp ||
    !profile.angelOne.macAddress
  ) {
    return NextResponse.json(
      { error: "Save your AngelOne API key, client code, IP headers, and MAC address first." },
      { status: 400 },
    );
  }

  const password = textValue(body.password);
  const totp = textValue(body.totp);
  if (!password || !totp) {
    return NextResponse.json({ error: "Password and TOTP are required to connect to AngelOne." }, { status: 400 });
  }

  try {
    const angelOneSession = await authenticateAngelOne({
      apiKey: profile.angelOne.apiKey,
      clientCode: profile.angelOne.clientCode,
      password,
      totp,
      clientLocalIp: profile.angelOne.clientLocalIp,
      clientPublicIp: profile.angelOne.clientPublicIp,
      macAddress: profile.angelOne.macAddress,
    });

    profile.angelOne.session = {
      ...angelOneSession,
      status: "connected",
      errorMessage: "",
      lastConnectedAt: new Date(),
    };
    await profile.save();

    return NextResponse.json({
      profile: serializeUserProfile(profile),
      message: "Connected to AngelOne.",
    });
  } catch (error) {
    profile.angelOne.session.status = "error";
    profile.angelOne.session.errorMessage =
      error instanceof Error ? error.message : "AngelOne authentication failed.";
    profile.angelOne.session.lastConnectedAt = new Date();
    await profile.save();

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AngelOne authentication failed.",
        profile: serializeUserProfile(profile),
      },
      { status: 400 },
    );
  }
}
