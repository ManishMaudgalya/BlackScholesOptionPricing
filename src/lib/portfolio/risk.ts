import type { FxSeries } from "@/lib/services/currency-engine";
import { normalizeStoredMarketDataSnapshot } from "@/lib/services/market-data";
import type { PortfolioHolding, PortfolioRisk, StoredMarketDataSnapshot } from "@/lib/portfolio/types";

const TRADING_DAYS_PER_YEAR = 252;

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function percentile(sortedValues: number[], percentileValue: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (sortedValues.length - 1) * percentileValue;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lowerValue = sortedValues[lowerIndex];
  const upperValue = sortedValues[upperIndex];

  if (lowerIndex === upperIndex) {
    return lowerValue;
  }

  return lowerValue + (upperValue - lowerValue) * (index - lowerIndex);
}

function buildDrivers({
  annualizedVolatility,
  valueAtRisk95,
  topHoldingSymbol,
  topHoldingWeight,
  weightedRealizedVolatility,
  fxPairsUsed,
}: {
  annualizedVolatility: number;
  valueAtRisk95: number;
  topHoldingSymbol: string | null;
  topHoldingWeight: number;
  weightedRealizedVolatility: number;
  fxPairsUsed: string[];
}) {
  const drivers = [
    `Blended realized volatility is ${(weightedRealizedVolatility * 100).toFixed(1)}% annualized.`,
    `Historical one-day VaR at 95% is ${valueAtRisk95.toFixed(0)} in USD terms.`,
    `Observed portfolio-path volatility is ${(annualizedVolatility * 100).toFixed(1)}% annualized.`,
  ];

  if (topHoldingSymbol) {
    drivers.push(
      `Largest current exposure is ${topHoldingSymbol} at ${(topHoldingWeight * 100).toFixed(1)}% of priced holdings.`,
    );
  }

  if (fxPairsUsed.length > 0) {
    drivers.push(`Cross-currency VaR uses FX paths for ${fxPairsUsed.join(", ")}.`);
  }

  return drivers;
}

function alignCombinedReturns(
  localDates: string[],
  localCloses: number[],
  fxSeries: FxSeries | null,
) {
  if (localCloses.length < 21 || localDates.length !== localCloses.length) {
    return [];
  }

  if (!fxSeries || fxSeries.points.length === 0) {
    return localCloses.slice(1).map((close, index) => Math.log(close / localCloses[index]));
  }

  const fxRateByDate = new Map(
    fxSeries.points.map((point) => [point.date.slice(0, 10), point.rate] as const),
  );

  const combinedReturns: number[] = [];
  for (let index = 1; index < localCloses.length; index += 1) {
    const priorDate = localDates[index - 1]?.slice(0, 10);
    const currentDate = localDates[index]?.slice(0, 10);
    const priorFx = fxRateByDate.get(priorDate);
    const currentFx = fxRateByDate.get(currentDate);

    if (!priorFx || !currentFx || priorFx <= 0 || currentFx <= 0) {
      continue;
    }

    combinedReturns.push(
      Math.log(localCloses[index] / localCloses[index - 1]) + Math.log(currentFx / priorFx),
    );
  }

  return combinedReturns;
}

export function buildDataLimitedPortfolioRisk(portfolioValue: number, reason: string): PortfolioRisk {
  return {
    portfolioValue,
    dailyVolatility: 0,
    annualizedVolatility: 0,
    valueAtRisk95: 0,
    valueAtRisk99: 0,
    expectedShortfall95: 0,
    concentration: 0,
    weightedRealizedVolatility: 0,
    weightedAnnualizedReturn: 0,
    lookbackDays: 0,
    marketCondition: "data-limited",
    topHoldingSymbol: null,
    topHoldingWeight: 0,
    worstDailyReturn: null,
    bestDailyReturn: null,
    fxPairsUsed: [],
    drivers: [reason],
    methodology:
      "Historical simulation needs enough priced return history in the account base currency before VaR is reliable.",
  };
}

export function buildPortfolioRisk(
  holdings: PortfolioHolding[],
  snapshots: StoredMarketDataSnapshot[],
  accountCurrency: string,
  currencyEngine: Map<string, FxSeries>,
): PortfolioRisk {
  const snapshotBySymbol = new Map(
    snapshots.map((snapshot) => [
      snapshot.symbol.trim().toUpperCase(),
      normalizeStoredMarketDataSnapshot(snapshot),
    ] as const),
  );

  const pricedInputs = holdings.flatMap((holding) => {
    if (holding.currentValueBase === null || holding.currentValueBase <= 0) {
      return [];
    }

    const snapshot = snapshotBySymbol.get(holding.symbol);
    if (!snapshot || snapshot.points.length < 21) {
      return [];
    }

    const closes = snapshot.points.map((point) => point.close).filter((close) => Number.isFinite(close));
    const dates = snapshot.points.map((point) => point.date);
    if (closes.length !== dates.length || closes.length < 21) {
      return [];
    }

    const fxSeries = holding.currency === accountCurrency ? null : currencyEngine.get(holding.currency) ?? null;
    const returns = alignCombinedReturns(dates, closes, fxSeries);
    if (returns.length < 20) {
      return [];
    }

    return [
      {
        holding,
        snapshot,
        returns,
        fxPair: fxSeries ? `${holding.currency}/${accountCurrency}` : null,
      },
    ];
  });

  const portfolioValue = pricedInputs.reduce((sum, input) => sum + (input.holding.currentValueBase ?? 0), 0);
  if (pricedInputs.length === 0 || portfolioValue <= 0) {
    return buildDataLimitedPortfolioRisk(
      portfolioValue,
      `No priced holdings with enough ${accountCurrency} return history were available for VaR yet.`,
    );
  }

  const weights = pricedInputs.map((input) => (input.holding.currentValueBase ?? 0) / portfolioValue);
  const lookbackDays = Math.min(...pricedInputs.map((input) => input.returns.length), 252);
  if (lookbackDays < 20) {
    return buildDataLimitedPortfolioRisk(
      portfolioValue,
      `Only ${lookbackDays} aligned daily returns were available. At least 20 are required for the risk model.`,
    );
  }

  const portfolioReturns = Array.from({ length: lookbackDays }, (_, offset) =>
    pricedInputs.reduce((sum, input, index) => {
      const alignedReturns = input.returns.slice(-lookbackDays);
      return sum + alignedReturns[offset] * weights[index];
    }, 0),
  );

  const sortedReturns = [...portfolioReturns].sort((left, right) => left - right);
  const downsideThreshold95 = Math.min(percentile(sortedReturns, 0.05), 0);
  const downsideThreshold99 = Math.min(percentile(sortedReturns, 0.01), 0);
  const tailReturns95 = portfolioReturns.filter((value) => value <= downsideThreshold95);
  const dailyVolatility = standardDeviation(portfolioReturns);
  const annualizedVolatility = dailyVolatility * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const valueAtRisk95 = Math.max(0, -downsideThreshold95 * portfolioValue);
  const valueAtRisk99 = Math.max(0, -downsideThreshold99 * portfolioValue);
  const expectedShortfall95 = Math.max(0, -average(tailReturns95) * portfolioValue);
  const concentration = weights.reduce((sum, weight) => sum + weight ** 2, 0);
  const weightedRealizedVolatility = pricedInputs.reduce(
    (sum, input, index) => sum + input.snapshot.realizedVolatility * weights[index],
    0,
  );
  const weightedAnnualizedReturn = pricedInputs.reduce(
    (sum, input, index) => sum + input.snapshot.annualizedReturn * weights[index],
    0,
  );
  const topHoldingIndex = weights.reduce(
    (largestIndex, weight, index, allWeights) => (weight > allWeights[largestIndex] ? index : largestIndex),
    0,
  );
  const topHoldingSymbol = pricedInputs[topHoldingIndex]?.holding.symbol ?? null;
  const topHoldingWeight = weights[topHoldingIndex] ?? 0;
  const downsideFrequency = portfolioReturns.filter((value) => value < 0).length / portfolioReturns.length;
  const stressRatio = portfolioValue === 0 ? 0 : valueAtRisk95 / portfolioValue;
  const fxPairsUsed = Array.from(
    new Set(pricedInputs.flatMap((input) => (input.fxPair ? [input.fxPair] : []))),
  ).sort();

  let marketCondition: PortfolioRisk["marketCondition"] = "constructive";
  if (annualizedVolatility > 0.34 || stressRatio > 0.055 || downsideFrequency > 0.58) {
    marketCondition = "stressed";
  } else if (annualizedVolatility > 0.22 || concentration > 0.34 || weightedAnnualizedReturn < 0) {
    marketCondition = "watchful";
  }

  return {
    portfolioValue,
    dailyVolatility,
    annualizedVolatility,
    valueAtRisk95,
    valueAtRisk99,
    expectedShortfall95,
    concentration,
    weightedRealizedVolatility,
    weightedAnnualizedReturn,
    lookbackDays,
    marketCondition,
    topHoldingSymbol,
    topHoldingWeight,
    worstDailyReturn: sortedReturns[0] ?? null,
    bestDailyReturn: sortedReturns[sortedReturns.length - 1] ?? null,
    fxPairsUsed,
    drivers: buildDrivers({
      annualizedVolatility,
      valueAtRisk95,
      topHoldingSymbol,
      topHoldingWeight,
      weightedRealizedVolatility,
      fxPairsUsed,
    }),
    methodology:
      "VaR uses historical daily log returns converted into the account base currency with FX paths, then applies current-value weights and a concentration overlay.",
  };
}
