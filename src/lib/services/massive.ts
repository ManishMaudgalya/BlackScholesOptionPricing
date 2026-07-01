import {
  computeAnnualizedReturn,
  computeRealizedVolatility,
  isUsStockSymbol,
  type MarketPriceMode,
  normalizeStoredMarketDataSnapshot,
  normalizeEpochToIso,
  normalizeNumber,
  normalizeSymbol,
  type HistoricalPoint,
  type MarketDataSnapshot,
  type StoredMarketDataSnapshot,
} from "@/lib/services/market-data";

const DEFAULT_BASE_URL = process.env.MASSIVE_API_BASE_URL || "https://api.massive.com";

type MassiveSnapshotResponse = {
  status?: string;
  ticker?: {
    day?: {
      c?: number;
    };
    lastTrade?: {
      p?: number;
      t?: number;
    };
    min?: {
      c?: number;
      t?: number;
    };
    prevDay?: {
      c?: number;
    };
    ticker?: string;
    todaysChange?: number;
    todaysChangePerc?: number;
    updated?: number;
  };
};

type MassiveAggregateResponse = {
  status?: string;
  results?: Array<{
    c?: number;
    h?: number;
    l?: number;
    o?: number;
    t?: number;
    v?: number;
  }>;
};

class MassiveApiError extends Error {
  statusCode: number;
  providerStatus: string | null;

  constructor(message: string, statusCode: number, providerStatus?: string | null) {
    super(message);
    this.name = "MassiveApiError";
    this.statusCode = statusCode;
    this.providerStatus = providerStatus ?? null;
  }
}

function getMassiveApiKey() {
  const apiKey = process.env.MASSIVE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MASSIVE_API_KEY is not configured. Add it to your env file to use Massive U.S. stock data.");
  }

  return apiKey;
}

function buildMassiveUrl(pathname: string, params?: Record<string, string>) {
  const url = new URL(pathname, DEFAULT_BASE_URL);
  url.searchParams.set("apiKey", getMassiveApiKey());

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

function assertSupportedUsSymbol(symbol: string) {
  if (!isUsStockSymbol(symbol)) {
    throw new Error(`Massive U.S. stock data only supports U.S. stock symbols in this app. Received ${symbol}.`);
  }
}

function resolveRangeStart(range: string) {
  const today = new Date();
  const start = new Date(today);

  switch (range) {
    case "1m":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3m":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6m":
      start.setMonth(start.getMonth() - 6);
      break;
    case "2y":
      start.setFullYear(start.getFullYear() - 2);
      break;
    case "5y":
      start.setFullYear(start.getFullYear() - 5);
      break;
    case "10y":
      start.setFullYear(start.getFullYear() - 10);
      break;
    case "ytd":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "1y":
    default:
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return start.toISOString().slice(0, 10);
}

function resolveInterval(interval: string) {
  switch (interval) {
    case "1d":
      return { multiplier: "1", timespan: "day" };
    case "1h":
      return { multiplier: "1", timespan: "hour" };
    case "5m":
      return { multiplier: "5", timespan: "minute" };
    default:
      throw new Error(`Unsupported Massive interval: ${interval}. Use 1d, 1h, or 5m.`);
  }
}

async function fetchMassiveJson<T>(pathname: string, params?: Record<string, string>) {
  const response = await fetch(buildMassiveUrl(pathname, params), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  const payload = (await response.json()) as T & { error?: string; message?: string; status?: string };
  if (!response.ok || payload.status === "ERROR" || payload.status === "NOT_AUTHORIZED") {
    throw new MassiveApiError(
      payload.error || payload.message || `Massive request failed for ${pathname}.`,
      response.status,
      payload.status,
    );
  }

  return payload;
}

function resolveMassivePriceMode(
  snapshotAvailable: boolean,
  aggregateStatus: string | undefined,
  regularMarketPrice: number | null,
): MarketPriceMode {
  if (snapshotAvailable && regularMarketPrice !== null) {
    return "live";
  }

  if (aggregateStatus === "DELAYED") {
    return "delayed";
  }

  return "close";
}

async function fetchMassiveSnapshot(symbol: string) {
  return fetchMassiveJson<MassiveSnapshotResponse>(
    `/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}`,
  );
}

export async function fetchMassiveHistoricalData(
  rawSymbol: string,
  options: {
    range?: string;
    interval?: string;
  } = {},
) {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    throw new Error("A Massive stock symbol is required.");
  }

  assertSupportedUsSymbol(symbol);

  const range = options.range ?? "1y";
  const interval = options.interval ?? "1d";
  const { multiplier, timespan } = resolveInterval(interval);
  const from = resolveRangeStart(range);
  const to = new Date().toISOString().slice(0, 10);

  const aggregatePayload = await fetchMassiveJson<MassiveAggregateResponse>(
    `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${from}/${to}`,
    {
      adjusted: "true",
      sort: "asc",
      limit: "50000",
    },
  );

  let snapshotPayload: MassiveSnapshotResponse | null = null;

  try {
    snapshotPayload = await fetchMassiveSnapshot(symbol);
  } catch (error) {
    if (!(error instanceof MassiveApiError) || error.statusCode !== 403) {
      throw error;
    }
  }

  const points: HistoricalPoint[] = (aggregatePayload.results ?? []).flatMap((result) => {
    const close = normalizeNumber(result.c);
    const open = normalizeNumber(result.o);
    const high = normalizeNumber(result.h);
    const low = normalizeNumber(result.l);
    const volume = normalizeNumber(result.v);
    const isoDate = normalizeEpochToIso(result.t);

    if (close === null || open === null || high === null || low === null || volume === null || !isoDate) {
      return [];
    }

    return [
      {
        date: isoDate,
        open,
        high,
        low,
        close,
        volume,
      },
    ];
  });

  if (points.length < 2) {
    throw new Error(`Massive did not return enough historical data for ${symbol}.`);
  }

  const snapshot = snapshotPayload?.ticker;
  const closeSeries = points.map((point) => point.close);
  const latestPoint = points[points.length - 1];
  const latestTradePrice = normalizeNumber(snapshot?.lastTrade?.p);
  const minClose = normalizeNumber(snapshot?.min?.c);
  const dayClose = normalizeNumber(snapshot?.day?.c);
  const previousClose = normalizeNumber(snapshot?.prevDay?.c);
  const latestTimestamp =
    normalizeEpochToIso(snapshot?.lastTrade?.t) ||
    normalizeEpochToIso(snapshot?.updated) ||
    normalizeEpochToIso(snapshot?.min?.t) ||
    latestPoint.date;
  const livePrice = latestTradePrice ?? minClose ?? dayClose ?? latestPoint.close;
  const priceMode = resolveMassivePriceMode(Boolean(snapshotPayload), aggregatePayload.status, livePrice);

  return {
    symbol,
    shortName: symbol,
    currency: "USD",
    exchangeName: "U.S. market",
    instrumentType: "EQUITY",
    timezone: "America/New_York",
    range,
    interval,
    source: "massive" as const,
    latestClose: dayClose ?? latestPoint.close,
    latestCloseAt: latestTimestamp,
    previousClose,
    regularMarketPrice: priceMode === "live" ? livePrice : null,
    priceMode,
    realizedVolatility: computeRealizedVolatility(closeSeries),
    annualizedReturn: computeAnnualizedReturn(closeSeries),
    fetchedAt: new Date().toISOString(),
    points,
  } satisfies MarketDataSnapshot;
}

export async function pullMassiveMarketDataSnapshot(
  rawSymbol: string,
  existingSnapshot: StoredMarketDataSnapshot | null,
  options: {
    range?: string;
    interval?: string;
  } = {},
) {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    throw new Error("A Massive stock symbol is required.");
  }

  assertSupportedUsSymbol(symbol);
  const normalizedSnapshot =
    existingSnapshot && existingSnapshot.source === "massive"
      ? normalizeStoredMarketDataSnapshot(existingSnapshot)
      : null;

  const range = options.range ?? normalizedSnapshot?.range ?? "1y";
  const interval = options.interval ?? normalizedSnapshot?.interval ?? "1d";

  if (
    !normalizedSnapshot ||
    normalizedSnapshot.points.length < 2 ||
    normalizedSnapshot.range !== range ||
    normalizedSnapshot.interval !== interval
  ) {
    return fetchMassiveHistoricalData(symbol, { range, interval });
  }

  let snapshotPayload: MassiveSnapshotResponse | null = null;

  try {
    snapshotPayload = await fetchMassiveSnapshot(symbol);
  } catch (error) {
    if (error instanceof MassiveApiError && error.statusCode === 403) {
      return fetchMassiveHistoricalData(symbol, { range, interval });
    }
    throw error;
  }

  const snapshot = snapshotPayload.ticker;
  const latestTradePrice = normalizeNumber(snapshot?.lastTrade?.p);
  const minClose = normalizeNumber(snapshot?.min?.c);
  const dayClose = normalizeNumber(snapshot?.day?.c);
  const previousClose = normalizeNumber(snapshot?.prevDay?.c);
  const latestTimestamp =
    normalizeEpochToIso(snapshot?.lastTrade?.t) ||
    normalizeEpochToIso(snapshot?.updated) ||
    normalizeEpochToIso(snapshot?.min?.t) ||
    normalizedSnapshot.latestCloseAt;
  const livePrice = latestTradePrice ?? minClose ?? dayClose ?? normalizedSnapshot.regularMarketPrice ?? normalizedSnapshot.latestClose;
  const closeSeries = normalizedSnapshot.points.map((point) => point.close);

  return {
    ...normalizedSnapshot,
    symbol,
    range,
    interval,
    latestClose: dayClose ?? normalizedSnapshot.latestClose,
    latestCloseAt: latestTimestamp,
    previousClose,
    regularMarketPrice: livePrice,
    priceMode: "live",
    realizedVolatility: computeRealizedVolatility(closeSeries),
    annualizedReturn: computeAnnualizedReturn(closeSeries),
    fetchedAt: new Date().toISOString(),
  } satisfies MarketDataSnapshot;
}
