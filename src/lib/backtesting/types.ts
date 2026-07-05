import type { HistoricalPoint } from "@/lib/services/market-data";

export type BacktestStrategyType = "sma-cross" | "rsi-reversion" | "breakout" | "custom-rules";

export type CustomRuleKind = "price-above-sma" | "price-below-sma" | "rsi-below" | "rsi-above";

export type CustomRuleInput = {
  kind?: CustomRuleKind;
  period?: number;
  threshold?: number;
};

export type BacktestStrategyInput = {
  id?: string;
  name?: string;
  type?: BacktestStrategyType;
  fastWindow?: number;
  slowWindow?: number;
  rsiPeriod?: number;
  rsiBuyBelow?: number;
  rsiSellAbove?: number;
  breakoutWindow?: number;
  exitWindow?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  customEntry?: CustomRuleInput;
  customExit?: CustomRuleInput;
};

export type BacktestRequestPayload = {
  symbol?: string;
  range?: string;
  interval?: string;
  initialCapital?: number;
  commissionPerTrade?: number;
  slippageBps?: number;
  strategies?: BacktestStrategyInput[];
};

export type BacktestRunInput = {
  symbol: string;
  points: HistoricalPoint[];
  strategy: BacktestStrategyInput;
  initialCapital: number;
  commissionPerTrade: number;
  slippageBps: number;
};

export type BacktestTrade = {
  id: string;
  side: "buy" | "sell";
  date: string;
  price: number;
  shares: number;
  value: number;
  fee: number;
  reason: string;
  pnl: number | null;
  pnlPercent: number | null;
};

export type EquityPoint = {
  date: string;
  equity: number;
  drawdownPercent: number;
};

export type BacktestMetrics = {
  endingEquity: number;
  totalReturnPercent: number;
  annualizedReturnPercent: number;
  benchmarkReturnPercent: number;
  maxDrawdownPercent: number;
  sharpeRatio: number | null;
  tradesCount: number;
  winRatePercent: number;
  profitFactor: number | null;
  timeInMarketPercent: number;
};

export type BacktestResult = {
  strategy: Required<Pick<BacktestStrategyInput, "id" | "name" | "type">> &
    Omit<BacktestStrategyInput, "id" | "name" | "type">;
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
  notes: string[];
};

export type BacktestResponsePayload = {
  symbol: string;
  shortName: string;
  currency: string;
  range: string;
  interval: string;
  source: "yahoo-finance";
  fetchedAt: string;
  startDate: string;
  endDate: string;
  pointsCount: number;
  initialCapital: number;
  commissionPerTrade: number;
  slippageBps: number;
  benchmarkReturnPercent: number;
  results: BacktestResult[];
  suggestions: string[];
};
