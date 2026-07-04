import type { HistoricalPoint, MarketDataSnapshot } from "@/lib/services/market-data";

export type PortfolioAccountRecord = {
  _id: string;
  authUserId: string;
  userEmail: string;
  baseCurrency: string;
  startingCash: number;
  cashBalance: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type PortfolioAccount = {
  currency: string;
  startingCash: number;
  cashBalance: number;
};

export type PortfolioPositionRecord = {
  _id: string;
  authUserId: string;
  userEmail: string;
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseCurrency: string;
  purchaseFxRate: number;
  costBasisBase: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type StoredMarketDataSnapshot = Omit<MarketDataSnapshot, "latestCloseAt" | "fetchedAt" | "points"> & {
  authUserId: string;
  latestCloseAt: string | Date;
  fetchedAt: string | Date;
  points: Array<Omit<HistoricalPoint, "date"> & { date: string | Date }>;
};

export type PortfolioHolding = {
  _id: string;
  symbol: string;
  shortName: string;
  currency: string;
  accountCurrency: string;
  quantity: number;
  purchasePrice: number;
  purchaseFxRate: number;
  fxRateToBase: number;
  currentPrice: number | null;
  costBasis: number;
  costBasisBase: number;
  currentValue: number | null;
  currentValueBase: number | null;
  unrealizedGainLoss: number | null;
  unrealizedGainLossBase: number | null;
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
  totalEquity: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  pricedHoldingsCount: number;
  pendingHoldingsCount: number;
  cashUtilizationPercent: number;
  currencies: string[];
  displayCurrency: string | null;
  isCurrencyMixed: boolean;
};

export type PortfolioRisk = {
  portfolioValue: number;
  dailyVolatility: number;
  annualizedVolatility: number;
  valueAtRisk95: number;
  valueAtRisk99: number;
  expectedShortfall95: number;
  concentration: number;
  weightedRealizedVolatility: number;
  weightedAnnualizedReturn: number;
  lookbackDays: number;
  marketCondition: "constructive" | "watchful" | "stressed" | "data-limited";
  topHoldingSymbol: string | null;
  topHoldingWeight: number;
  worstDailyReturn: number | null;
  bestDailyReturn: number | null;
  fxPairsUsed: string[];
  drivers: string[];
  methodology: string;
};

export type PortfolioState = {
  holdings: PortfolioHolding[];
  account: PortfolioAccount;
  summary: PortfolioSummary;
  risk: PortfolioRisk;
};
