import { Schema, model, models } from "mongoose";

const userProfileSchema = new Schema(
  {
    authUserId: { type: String, required: true, unique: true },
    email: { type: String, default: "" },
    name: { type: String, default: "" },
    image: { type: String, default: "" },
    angelOne: {
      apiKey: { type: String, default: "" },
      clientCode: { type: String, default: "" },
      clientLocalIp: { type: String, default: "" },
      clientPublicIp: { type: String, default: "" },
      macAddress: { type: String, default: "" },
      session: {
        jwtToken: { type: String, default: "" },
        refreshToken: { type: String, default: "" },
        feedToken: { type: String, default: "" },
        loggedInAt: { type: String, default: "" },
        lastConnectedAt: { type: Date, default: null },
        status: {
          type: String,
          enum: ["connected", "disconnected", "error"],
          default: "disconnected",
        },
        errorMessage: { type: String, default: "" },
      },
    },
  },
  {
    timestamps: true,
  },
);

export const UserProfileModel = models.UserProfile || model("UserProfile", userProfileSchema);
