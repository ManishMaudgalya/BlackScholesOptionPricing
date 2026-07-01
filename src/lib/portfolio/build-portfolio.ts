import type {
  PortfolioHolding,
  PortfolioPositionRecord,
  PortfolioState,
  StoredMarketDataSnapshot,
} from "@/lib/portfolio/types";

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

export function buildPortfolio(
  positions: PortfolioPositionRecord[],
  snapshots: StoredMarketDataSnapshot[],
): PortfolioState {
  const snapshotBySymbol = new Map(
    snapshots.map((snapshot) => [snapshot.symbol.trim().toUpperCase(), snapshot] as const),
  );

  const holdings = positions.map<PortfolioHolding>((position) => {
    const symbol = position.symbol.trim().toUpperCase();
    const snapshot = snapshotBySymbol.get(symbol);
    const currentPrice = snapshot?.regularMarketPrice ?? snapshot?.latestClose ?? null;
    const costBasis = position.quantity * position.purchasePrice;
    const currentValue = currentPrice === null ? null : currentPrice * position.quantity;
    const unrealizedGainLoss = currentValue === null ? null : currentValue - costBasis;
    const unrealizedGainLossPercent =
      unrealizedGainLoss === null || costBasis === 0 ? null : (unrealizedGainLoss / costBasis) * 100;

    return {
      _id: position._id,
      symbol,
      shortName: snapshot?.shortName || symbol,
      currency: snapshot?.currency || "USD",
      quantity: position.quantity,
      purchasePrice: position.purchasePrice,
      currentPrice,
      costBasis,
      currentValue,
      unrealizedGainLoss,
      unrealizedGainLossPercent,
      latestCloseAt: normalizeDate(snapshot?.latestCloseAt),
      fetchedAt: normalizeDate(snapshot?.fetchedAt),
      performanceTone: getPerformanceTone(unrealizedGainLoss),
    };
  });

  const pricedHoldings = holdings.filter((holding) => holding.currentValue !== null);
  const totalCostBasis = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const pricedCostBasis = pricedHoldings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const totalCurrentValue = pricedHoldings.reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0);
  const unrealizedGainLoss = totalCurrentValue - pricedCostBasis;
  const unrealizedGainLossPercent = pricedCostBasis === 0 ? 0 : (unrealizedGainLoss / pricedCostBasis) * 100;
  const currencies = Array.from(new Set(holdings.map((holding) => holding.currency).filter(Boolean))).sort();

  return {
    holdings,
    summary: {
      holdingsCount: holdings.length,
      symbolsCount: new Set(holdings.map((holding) => holding.symbol)).size,
      totalCostBasis,
      pricedCostBasis,
      totalCurrentValue,
      unrealizedGainLoss,
      unrealizedGainLossPercent,
      pricedHoldingsCount: pricedHoldings.length,
      pendingHoldingsCount: holdings.length - pricedHoldings.length,
      currencies,
      displayCurrency: currencies.length === 1 ? currencies[0] : null,
      isCurrencyMixed: currencies.length > 1,
    },
  };
}
