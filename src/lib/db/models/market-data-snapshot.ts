import { Schema, model, models } from "mongoose";

const marketDataPointSchema = new Schema(
  {
    date: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true },
  },
  {
    _id: false,
  },
);

const marketDataSnapshotSchema = new Schema(
  {
    authUserId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, index: true },
    source: { type: String, required: true, default: "yahoo-finance" },
    shortName: { type: String, default: "" },
    currency: { type: String, default: "USD" },
    exchangeName: { type: String, default: "" },
    instrumentType: { type: String, default: "" },
    timezone: { type: String, default: "UTC" },
    range: { type: String, required: true, default: "1y" },
    interval: { type: String, required: true, default: "1d" },
    latestClose: { type: Number, required: true },
    latestCloseAt: { type: Date, required: true },
    previousClose: { type: Number, default: null },
    regularMarketPrice: { type: Number, default: null },
    realizedVolatility: { type: Number, required: true },
    annualizedReturn: { type: Number, required: true },
    fetchedAt: { type: Date, required: true },
    points: { type: [marketDataPointSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

marketDataSnapshotSchema.index({ authUserId: 1, symbol: 1 }, { unique: true });

export const MarketDataSnapshotModel =
  models.MarketDataSnapshot || model("MarketDataSnapshot", marketDataSnapshotSchema);
