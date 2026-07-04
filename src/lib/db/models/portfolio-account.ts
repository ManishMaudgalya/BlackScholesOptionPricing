import { Schema, model, models } from "mongoose";

const portfolioAccountSchema = new Schema(
  {
    authUserId: { type: String, required: true, unique: true, index: true },
    userEmail: { type: String, default: "" },
    baseCurrency: { type: String, required: true, default: "USD" },
    startingCash: { type: Number, required: true, default: 100000, min: 0 },
    cashBalance: { type: Number, required: true, default: 100000, min: 0 },
  },
  {
    timestamps: true,
  },
);

export const PortfolioAccountModel =
  models.PortfolioAccount || model("PortfolioAccount", portfolioAccountSchema);
