const YAHOO_FINANCE_CHART_ROOT = "https://query1.finance.yahoo.com/v8/finance/chart";

export type YahooHistoricalPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketDataSnapshot = {
  symbol: string;
  shortName: string;
  currency: string;
  exchangeName: string;
  instrumentType: string;
  timezone: string;
  range: string;
  interval: string;
  source: "yahoo-finance";
  latestClose: number;
  latestCloseAt: string;
  previousClose: number | null;
  regularMarketPrice: number | null;
  realizedVolatility: number;
  annualizedReturn: number;
  fetchedAt: string;
  points: YahooHistoricalPoint[];
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        currency?: string;
        exchangeName?: string;
        instrumentType?: string;
        timezone?: string;
        regularMarketPrice?: number;
        previousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    };
  };
};

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function computeAnnualizedReturn(closes: number[]) {
  if (closes.length < 2) {
    return 0;
  }

  const logReturns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const averageReturn = logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length;
  return averageReturn * 252;
}

function computeRealizedVolatility(closes: number[]) {
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

export async function fetchYahooHistoricalData(
  rawSymbol: string,
  options: {
    range?: string;
    interval?: string;
  } = {},
) {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    throw new Error("A Yahoo Finance symbol is required.");
  }

  const range = options.range ?? "1y";
  const interval = options.interval ?? "1d";
  const requestUrl = new URL(`${YAHOO_FINANCE_CHART_ROOT}/${encodeURIComponent(symbol)}`);
  requestUrl.searchParams.set("range", range);
  requestUrl.searchParams.set("interval", interval);
  requestUrl.searchParams.set("includePrePost", "false");
  requestUrl.searchParams.set("events", "div,splits");

  const response = await fetch(requestUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  const payload = (await response.json()) as YahooChartResponse;
  const apiError = payload.chart?.error;
  if (!response.ok || apiError) {
    throw new Error(apiError?.description || `Yahoo Finance request failed for ${symbol}.`);
  }

  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const closes = quote?.close ?? [];
  const opens = quote?.open ?? [];
  const highs = quote?.high ?? [];
  const lows = quote?.low ?? [];
  const volumes = quote?.volume ?? [];

  const points = timestamps.flatMap((timestamp, index) => {
    const close = normalizeNumber(closes[index]);
    if (close === null) {
      return [];
    }

    const open = normalizeNumber(opens[index]) ?? close;
    const high = normalizeNumber(highs[index]) ?? Math.max(open, close);
    const low = normalizeNumber(lows[index]) ?? Math.min(open, close);
    const volume = normalizeNumber(volumes[index]) ?? 0;

    return [
      {
        date: new Date(timestamp * 1000).toISOString(),
        open,
        high,
        low,
        close,
        volume,
      },
    ];
  });

  if (points.length < 2) {
    throw new Error(`Yahoo Finance did not return enough historical data for ${symbol}.`);
  }

  const closeSeries = points.map((point) => point.close);
  const latestPoint = points[points.length - 1];
  const meta = result?.meta ?? {};

  return {
    symbol,
    shortName: meta.shortName?.trim() || symbol,
    currency: meta.currency?.trim() || "USD",
    exchangeName: meta.exchangeName?.trim() || "Unknown exchange",
    instrumentType: meta.instrumentType?.trim() || "UNKNOWN",
    timezone: meta.timezone?.trim() || "UTC",
    range,
    interval,
    source: "yahoo-finance" as const,
    latestClose: latestPoint.close,
    latestCloseAt: latestPoint.date,
    previousClose: normalizeNumber(meta.previousClose),
    regularMarketPrice: normalizeNumber(meta.regularMarketPrice) ?? latestPoint.close,
    realizedVolatility: computeRealizedVolatility(closeSeries),
    annualizedReturn: computeAnnualizedReturn(closeSeries),
    fetchedAt: new Date().toISOString(),
    points,
  } satisfies MarketDataSnapshot;
}
