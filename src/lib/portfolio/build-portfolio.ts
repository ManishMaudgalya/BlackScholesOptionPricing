import { buildCurrencyEngine, type FxSeries } from "@/lib/services/currency-engine";
import type {
  PortfolioAccountRecord,
  PortfolioHolding,
  PortfolioRisk,
  PortfolioPositionRecord,
  PortfolioState,
  StoredMarketDataSnapshot,
} from "@/lib/portfolio/types";
import { buildDataLimitedPortfolioRisk, buildPortfolioRisk } from "@/lib/portfolio/risk";

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value instanceof Date ? value.toISOString() : value;
  return normalized || null;
}

function getPerformanceTone(value: number | null): PortfolioHolding["performanceTone"] {
  if (value === null) {
    return "neutral";
  }

  if (value > 0.005) {
    return "green";
  }

  if (value < -0.005) {
    return "red";
  }

  return "flat";
}

export async function buildPortfolio(
  positions: PortfolioPositionRecord[],
  snapshots: StoredMarketDataSnapshot[],
  account: PortfolioAccountRecord,
): Promise<PortfolioState> {
  const snapshotBySymbol = new Map(
    snapshots.map((snapshot) => [snapshot.symbol.trim().toUpperCase(), snapshot] as const),
  );
  const currencies = Array.from(
    new Set(
      positions
        .map((position) => position.purchaseCurrency)
        .concat(snapshots.map((snapshot) => snapshot.currency))
        .filter(Boolean)
        .map((currency) => currency.trim().toUpperCase()),
    ),
  ).sort();
  let currencyEngine: Map<string, FxSeries> = new Map();

  try {
    currencyEngine = await buildCurrencyEngine(currencies, account.baseCurrency, { range: "2y", interval: "1d" });
  } catch {
    currencyEngine = new Map();
  }

  const holdings = positions.map<PortfolioHolding>((position) => {
    const symbol = position.symbol.trim().toUpperCase();
    const snapshot = snapshotBySymbol.get(symbol);
    const currency = snapshot?.currency || position.purchaseCurrency || account.baseCurrency;
    const fxRateToBase =
      currency === account.baseCurrency ? 1 : currencyEngine.get(currency)?.latestRate ?? position.purchaseFxRate ?? 1;
    const currentPrice = snapshot?.regularMarketPrice ?? snapshot?.latestClose ?? null;
    const costBasis = position.quantity * position.purchasePrice;
    const currentValue = currentPrice === null ? null : currentPrice * position.quantity;
    const costBasisBase = position.costBasisBase ?? costBasis * (position.purchaseFxRate || 1);
    const currentValueBase = currentValue === null ? null : currentValue * fxRateToBase;
    const unrealizedGainLoss = currentValue === null ? null : currentValue - costBasis;
    const unrealizedGainLossBase = currentValueBase === null ? null : currentValueBase - costBasisBase;
    const unrealizedGainLossPercent =
      unrealizedGainLossBase === null || costBasisBase === 0 ? null : (unrealizedGainLossBase / costBasisBase) * 100;

    return {
      _id: position._id,
      symbol,
      shortName: snapshot?.shortName || symbol,
      currency,
      accountCurrency: account.baseCurrency,
      quantity: position.quantity,
      purchasePrice: position.purchasePrice,
      purchaseFxRate: position.purchaseFxRate || 1,
      fxRateToBase,
      currentPrice,
      costBasis,
      costBasisBase,
      currentValue,
      currentValueBase,
      unrealizedGainLoss,
      unrealizedGainLossBase,
      unrealizedGainLossPercent,
      latestCloseAt: normalizeDate(snapshot?.latestCloseAt),
      fetchedAt: normalizeDate(snapshot?.fetchedAt),
      performanceTone: getPerformanceTone(unrealizedGainLossPercent),
    };
  });

  const pricedHoldings = holdings.filter((holding) => holding.currentValueBase !== null);
  const totalCostBasis = holdings.reduce((sum, holding) => sum + holding.costBasisBase, 0);
  const pricedCostBasis = pricedHoldings.reduce((sum, holding) => sum + holding.costBasisBase, 0);
  const totalCurrentValue = pricedHoldings.reduce((sum, holding) => sum + (holding.currentValueBase ?? 0), 0);
  const unrealizedGainLoss = totalCurrentValue - pricedCostBasis;
  const unrealizedGainLossPercent = pricedCostBasis === 0 ? 0 : (unrealizedGainLoss / pricedCostBasis) * 100;
  const pendingCostBasis = totalCostBasis - pricedCostBasis;
  const totalEquity = account.cashBalance + totalCurrentValue + pendingCostBasis;
  const cashUtilizationPercent =
    account.startingCash <= 0 ? 0 : ((account.startingCash - account.cashBalance) / account.startingCash) * 100;
  let risk: PortfolioRisk;

  try {
    risk = buildPortfolioRisk(holdings, snapshots, account.baseCurrency, currencyEngine);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The cross-currency VaR engine could not be completed.";
    risk = buildDataLimitedPortfolioRisk(totalCurrentValue, message);
  }

  return {
    holdings,
    account: {
      currency: account.baseCurrency,
      startingCash: account.startingCash,
      cashBalance: account.cashBalance,
    },
    summary: {
      holdingsCount: holdings.length,
      symbolsCount: new Set(holdings.map((holding) => holding.symbol)).size,
      totalCostBasis,
      pricedCostBasis,
      totalCurrentValue,
      totalEquity,
      unrealizedGainLoss,
      unrealizedGainLossPercent,
      pricedHoldingsCount: pricedHoldings.length,
      pendingHoldingsCount: holdings.length - pricedHoldings.length,
      cashUtilizationPercent,
      currencies,
      displayCurrency: account.baseCurrency,
      isCurrencyMixed: currencies.length > 1,
    },
    risk,
  };
}
