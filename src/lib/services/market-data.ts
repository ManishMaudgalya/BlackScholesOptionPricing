export type HistoricalPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketPriceMode = "live" | "delayed" | "close";

export type MarketDataSnapshot = {
  symbol: string;
  shortName: string;
  currency: string;
  exchangeName: string;
  instrumentType: string;
  timezone: string;
  range: string;
  interval: string;
  source: "yahoo-finance" | "massive";
  latestClose: number;
  latestCloseAt: string;
  previousClose: number | null;
  regularMarketPrice: number | null;
  priceMode?: MarketPriceMode;
  realizedVolatility: number;
  annualizedReturn: number;
  fetchedAt: string;
  points: HistoricalPoint[];
};

export type StoredMarketDataSnapshot = Omit<MarketDataSnapshot, "latestCloseAt" | "fetchedAt" | "points"> & {
  latestCloseAt: string | Date;
  fetchedAt: string | Date;
  points: Array<Omit<HistoricalPoint, "date"> & { date: string | Date }>;
};

export function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function computeAnnualizedReturn(closes: number[]) {
  if (closes.length < 2) {
    return 0;
  }

  const logReturns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const averageReturn = logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length;
  return averageReturn * 252;
}

export function computeRealizedVolatility(closes: number[]) {
  if (closes.length < 2) {
    return 0;
  }

  const logReturns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  if (logReturns.length < 2) {
    return 0;
  }

  const mean = logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length;
  const variance =
    logReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (logReturns.length - 1);

  return Math.sqrt(variance) * Math.sqrt(252);
}

export function normalizeEpochToIso(rawValue: number | null | undefined) {
  const value = normalizeNumber(rawValue);
  if (value === null) {
    return null;
  }

  const epochMs =
    value > 1e17
      ? Math.trunc(value / 1e6)
      : value > 1e14
        ? Math.trunc(value / 1e3)
        : value > 1e11
          ? Math.trunc(value)
          : Math.trunc(value * 1000);

  return new Date(epochMs).toISOString();
}

export function isUsStockSymbol(rawSymbol: string) {
  const symbol = normalizeSymbol(rawSymbol);
  return /^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(symbol);
}

export function normalizeStoredMarketDataSnapshot(snapshot: StoredMarketDataSnapshot): MarketDataSnapshot {
  return {
    ...snapshot,
    priceMode: snapshot.priceMode ?? "live",
    latestCloseAt:
      snapshot.latestCloseAt instanceof Date ? snapshot.latestCloseAt.toISOString() : snapshot.latestCloseAt,
    fetchedAt: snapshot.fetchedAt instanceof Date ? snapshot.fetchedAt.toISOString() : snapshot.fetchedAt,
    points: snapshot.points.map((point) => ({
      ...point,
      date: point.date instanceof Date ? point.date.toISOString() : point.date,
    })),
  };
}
