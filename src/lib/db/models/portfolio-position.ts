import { Schema, model, models } from "mongoose";

const portfolioPositionSchema = new Schema(
  {
    authUserId: { type: String, required: true, index: true },
    userEmail: { type: String, default: "" },
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    purchasePrice: { type: Number, required: true, min: 0.000001 },
  },
  {
    timestamps: true,
  },
);

portfolioPositionSchema.index({ authUserId: 1, symbol: 1, createdAt: -1 });

export const PortfolioPositionModel =
  models.PortfolioPosition || model("PortfolioPosition", portfolioPositionSchema);
