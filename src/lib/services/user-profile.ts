import { connectToDatabase } from "@/lib/db/mongodb";
import { UserProfileModel } from "@/lib/db/models/user-profile";

type EnsureUserProfileParams = {
  authUserId: string;
  email: string;
  name: string;
  image: string;
};

export async function getOrCreateUserProfile(params: EnsureUserProfileParams) {
  await connectToDatabase();

  const profile =
    (await UserProfileModel.findOne({ authUserId: params.authUserId })) ??
    new UserProfileModel({
      authUserId: params.authUserId,
      email: params.email,
      name: params.name,
      image: params.image,
    });

  profile.email = params.email;
  profile.name = params.name;
  profile.image = params.image;
  await profile.save();

  return profile;
}

export function serializeUserProfile(profile: any) {
  return {
    authUserId: profile.authUserId,
    email: profile.email,
    name: profile.name,
    image: profile.image,
    angelOne: {
      apiKey: profile.angelOne.apiKey,
      clientCode: profile.angelOne.clientCode,
      clientLocalIp: profile.angelOne.clientLocalIp,
      clientPublicIp: profile.angelOne.clientPublicIp,
      macAddress: profile.angelOne.macAddress,
      session: {
        status: profile.angelOne.session.status,
        loggedInAt: profile.angelOne.session.loggedInAt,
        lastConnectedAt: profile.angelOne.session.lastConnectedAt,
        errorMessage: profile.angelOne.session.errorMessage,
      },
    },
  };
}
