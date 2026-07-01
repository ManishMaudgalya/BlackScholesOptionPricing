import { Schema, model, models } from "mongoose";

const calculationSchema = new Schema(
  {
    authUserId: { type: String, required: true, index: true },
    userEmail: { type: String, default: "" },
    inputs: {
      spotPrice: { type: Number, required: true },
      strikePrice: { type: Number, required: true },
      timeToExpiry: { type: Number, required: true },
      riskFreeRate: { type: Number, required: true },
      volatility: { type: Number, required: true },
      optionType: { type: String, enum: ["call", "put"], required: true },
    },
    results: {
      prices: {
        call: { type: Number, required: true },
        put: { type: Number, required: true },
      },
      greeks: {
        deltaCall: { type: Number, required: true },
        deltaPut: { type: Number, required: true },
        gamma: { type: Number, required: true },
        thetaCall: { type: Number, required: true },
        thetaPut: { type: Number, required: true },
        vega: { type: Number, required: true },
        rhoCall: { type: Number, required: true },
        rhoPut: { type: Number, required: true },
      },
    },
    marketData: {
      symbol: { type: String, default: "" },
      shortName: { type: String, default: "" },
      source: { type: String, default: "" },
      currency: { type: String, default: "USD" },
      latestClose: { type: Number, default: null },
      latestCloseAt: { type: Date, default: null },
      realizedVolatility: { type: Number, default: null },
      fetchedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  },
);

export const CalculationModel = models.Calculation || model("Calculation", calculationSchema);
