import { fetchYahooHistoricalData } from "@/lib/services/yahoo-finance";

type FxPoint = {
  date: string;
  rate: number;
};

export type FxSeries = {
  fromCurrency: string;
  toCurrency: string;
  symbol: string;
  inverted: boolean;
  latestRate: number;
  points: FxPoint[];
};

function normalizeCurrency(currency: string) {
  return currency.trim().toUpperCase();
}

function invertPoints(points: FxPoint[]) {
  return points.flatMap((point) =>
    point.rate > 0
      ? [
          {
            date: point.date,
            rate: 1 / point.rate,
          },
        ]
      : [],
  );
}

async function fetchRawFxSeries(symbol: string, inverted: boolean, range = "2y", interval = "1d"): Promise<FxSeries> {
  const snapshot = await fetchYahooHistoricalData(symbol, { range, interval });
  const latestRate = snapshot.regularMarketPrice ?? snapshot.latestClose;
  const points = snapshot.points.map((point) => ({
    date: point.date,
    rate: point.close,
  }));

  const normalizedPoints = inverted ? invertPoints(points) : points;
  const normalizedLatestRate = inverted ? 1 / latestRate : latestRate;

  return {
    fromCurrency: "",
    toCurrency: "",
    symbol,
    inverted,
    latestRate: normalizedLatestRate,
    points: normalizedPoints,
  };
}

export async function fetchFxSeries(
  rawFromCurrency: string,
  rawToCurrency: string,
  options: {
    range?: string;
    interval?: string;
  } = {},
): Promise<FxSeries> {
  const fromCurrency = normalizeCurrency(rawFromCurrency);
  const toCurrency = normalizeCurrency(rawToCurrency);

  if (!fromCurrency || !toCurrency) {
    throw new Error("Both currencies are required for FX conversion.");
  }

  if (fromCurrency === toCurrency) {
    return {
      fromCurrency,
      toCurrency,
      symbol: `${fromCurrency}${toCurrency}=X`,
      inverted: false,
      latestRate: 1,
      points: [],
    };
  }

  const range = options.range ?? "2y";
  const interval = options.interval ?? "1d";
  const directSymbol = `${fromCurrency}${toCurrency}=X`;

  try {
    const direct = await fetchRawFxSeries(directSymbol, false, range, interval);
    return {
      ...direct,
      fromCurrency,
      toCurrency,
    };
  } catch {
    const inverseSymbol = `${toCurrency}${fromCurrency}=X`;
    const inverse = await fetchRawFxSeries(inverseSymbol, true, range, interval);
    return {
      ...inverse,
      fromCurrency,
      toCurrency,
    };
  }
}

export async function buildCurrencyEngine(
  currencies: string[],
  baseCurrency: string,
  options: {
    range?: string;
    interval?: string;
  } = {},
) {
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);
  const uniqueCurrencies = Array.from(
    new Set(currencies.map((currency) => normalizeCurrency(currency)).filter(Boolean)),
  ).filter((currency) => currency !== normalizedBaseCurrency);

  const fxSeriesEntries = await Promise.all(
    uniqueCurrencies.map(async (currency) => [
      currency,
      await fetchFxSeries(currency, normalizedBaseCurrency, options),
    ] as const),
  );

  return new Map(fxSeriesEntries);
}
