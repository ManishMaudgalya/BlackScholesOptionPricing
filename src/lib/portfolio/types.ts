import type { MarketDataSnapshot } from "@/lib/services/market-data";

export type PortfolioPositionRecord = {
  _id: string;
  authUserId: string;
  userEmail: string;
  symbol: string;
  quantity: number;
  purchasePrice: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type StoredMarketDataSnapshot = Pick<
  MarketDataSnapshot,
  | "symbol"
  | "shortName"
  | "currency"
  | "latestClose"
  | "latestCloseAt"
  | "regularMarketPrice"
  | "fetchedAt"
> & {
  authUserId: string;
};

export type PortfolioHolding = {
  _id: string;
  symbol: string;
  shortName: string;
  currency: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number | null;
  costBasis: number;
  currentValue: number | null;
  unrealizedGainLoss: number | null;
  unrealizedGainLossPercent: number | null;
  latestCloseAt: string | null;
  fetchedAt: string | null;
  performanceTone: "green" | "red" | "flat" | "neutral";
};

export type PortfolioSummary = {
  holdingsCount: number;
  symbolsCount: number;
  totalCostBasis: number;
  pricedCostBasis: number;
  totalCurrentValue: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  pricedHoldingsCount: number;
  pendingHoldingsCount: number;
  currencies: string[];
  displayCurrency: string | null;
  isCurrencyMixed: boolean;
};

export type PortfolioState = {
  holdings: PortfolioHolding[];
  summary: PortfolioSummary;
};
