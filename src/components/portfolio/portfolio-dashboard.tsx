"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DEFAULT_PORTFOLIO_SECTOR_ID, PORTFOLIO_SECTOR_MODELS, type PortfolioSectorId } from "@/lib/portfolio/sector-presets";
import type { PortfolioHolding, PortfolioRisk, PortfolioState } from "@/lib/portfolio/types";
import type { MarketDataSnapshot } from "@/lib/services/market-data";

type UserData = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type PortfolioFormState = {
  symbol: string;
  quantity: string;
  purchasePrice: string;
};

type SectorFormState = {
  sector: PortfolioSectorId;
  budget: string;
};

type PortfolioPayload = {
  portfolio?: PortfolioState;
  error?: string;
  refreshError?: string;
  refreshedCount?: number;
  failedSymbols?: string[];
  spentCash?: number;
  purchasedSymbols?: string[];
  sectorLabel?: string;
};

type HistoryPayload = {
  snapshot?: MarketDataSnapshot;
  error?: string;
};

const DEFAULT_SYMBOL = "AAPL";

const initialPortfolioForm: PortfolioFormState = {
  symbol: DEFAULT_SYMBOL,
  quantity: "10",
  purchasePrice: "100",
};

const initialSectorForm: SectorFormState = {
  sector: DEFAULT_PORTFOLIO_SECTOR_ID,
  budget: "25000",
};

const emptyPortfolio: PortfolioState = {
  holdings: [],
  account: {
    currency: "USD",
    startingCash: 100000,
    cashBalance: 100000,
  },
  summary: {
    holdingsCount: 0,
    symbolsCount: 0,
    totalCostBasis: 0,
    pricedCostBasis: 0,
    totalCurrentValue: 0,
    totalEquity: 100000,
    unrealizedGainLoss: 0,
    unrealizedGainLossPercent: 0,
    pricedHoldingsCount: 0,
    pendingHoldingsCount: 0,
    cashUtilizationPercent: 0,
    currencies: [],
    displayCurrency: null,
    isCurrencyMixed: false,
  },
  risk: {
    portfolioValue: 0,
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
    drivers: ["Build a portfolio first to unlock the VaR model."],
    methodology:
      "Historical simulation needs enough priced return history in a single reporting currency before VaR is reliable.",
  },
};

const formatCurrency = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);

const formatPlainNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatSignedCurrency = (value: number, currency = "USD") =>
  `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value), currency)}`;

const formatSignedPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatRatioPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const clampChartLabelY = (value: number, height: number) => Math.min(Math.max(value, 18), height - 12);

function formatMarketCondition(condition: PortfolioRisk["marketCondition"]) {
  switch (condition) {
    case "constructive":
      return "Constructive";
    case "watchful":
      return "Watchful";
    case "stressed":
      return "Stressed";
    default:
      return "Data Limited";
  }
}

function buildHistoryChart(points: MarketDataSnapshot["points"]) {
  if (points.length === 0) {
    return null;
  }

  const width = 720;
  const height = 260;
  const padding = 20;
  const closes = points.map((point) => point.close);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const priceSpan = maxClose - minClose || 1;
  const step = points.length === 1 ? 0 : (width - padding * 2) / (points.length - 1);

  const coordinates = points.map((point, index) => {
    const x = padding + index * step;
    const y = height - padding - ((point.close - minClose) / priceSpan) * (height - padding * 2);
    return { x, y };
  });

  const linePath = coordinates
    .map((coordinate, index) => `${index === 0 ? "M" : "L"} ${coordinate.x.toFixed(2)} ${coordinate.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1]?.x.toFixed(2) ?? padding} ${height - padding} L ${coordinates[0]?.x.toFixed(2) ?? padding} ${height - padding} Z`;
  const startCoordinate = coordinates[0] ?? { x: padding, y: height - padding };
  const endCoordinate = coordinates[coordinates.length - 1] ?? startCoordinate;

  return {
    width,
    height,
    padding,
    linePath,
    areaPath,
    minClose,
    maxClose,
    startPrice: closes[0],
    endPrice: closes[closes.length - 1],
    startLabel: {
      pointX: startCoordinate.x,
      pointY: startCoordinate.y,
      x: startCoordinate.x + 8,
      y: clampChartLabelY(startCoordinate.y - 10, height),
      value: closes[0],
    },
    endLabel: {
      pointX: endCoordinate.x,
      pointY: endCoordinate.y,
      x: endCoordinate.x - 8,
      y: clampChartLabelY(endCoordinate.y - 10, height),
      value: closes[closes.length - 1],
    },
    startDate: points[0]?.date ?? null,
    endDate: points[points.length - 1]?.date ?? null,
  };
}

function MetricCard({
  label,
  value,
  note,
  accent = "cyan",
}: {
  label: string;
  value: string;
  note?: string;
  accent?: "cyan" | "green" | "gold" | "red";
}) {
  return (
    <article className={`metric-card accent-${accent}`}>
      <p className="eyebrow">{label}</p>
      <h3>{value}</h3>
      {note ? <span>{note}</span> : null}
    </article>
  );
}

export function PortfolioDashboard({ user }: { user: UserData }) {
  const [portfolio, setPortfolio] = useState<PortfolioState>(emptyPortfolio);
  const [portfolioForm, setPortfolioForm] = useState<PortfolioFormState>(initialPortfolioForm);
  const [sectorForm, setSectorForm] = useState<SectorFormState>(initialSectorForm);
  const [portfolioMessage, setPortfolioMessage] = useState("");
  const [portfolioError, setPortfolioError] = useState("");
  const [historySnapshot, setHistorySnapshot] = useState<MarketDataSnapshot | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [selectedHolding, setSelectedHolding] = useState<PortfolioHolding | null>(null);
  const [isPortfolioPending, startPortfolioTransition] = useTransition();
  const [isHistoryPending, startHistoryTransition] = useTransition();

  const portfolioDisplayCurrency = portfolio.summary.displayCurrency || portfolio.account.currency || "USD";
  const normalizedPortfolioSymbol = portfolioForm.symbol.trim().toUpperCase() || DEFAULT_SYMBOL;
  const selectedSectorModel =
    PORTFOLIO_SECTOR_MODELS.find((sector) => sector.id === sectorForm.sector) ?? PORTFOLIO_SECTOR_MODELS[0];
  const tradeQuantity = Number(portfolioForm.quantity);
  const tradePrice = Number(portfolioForm.purchasePrice);
  const estimatedTradeCost =
    Number.isFinite(tradeQuantity) && Number.isFinite(tradePrice) && tradeQuantity > 0 && tradePrice > 0
      ? tradeQuantity * tradePrice
      : 0;
  const sectorBudget = Number(sectorForm.budget);
  const historySymbol = selectedHolding?.symbol ?? null;
  const historyChart = useMemo(
    () => (historySnapshot ? buildHistoryChart(historySnapshot.points) : null),
    [historySnapshot],
  );

  useEffect(() => {
    startPortfolioTransition(() => {
      void loadPortfolio();
    });
  }, []);

  function formatPortfolioCurrency(value: number) {
    return formatCurrency(value, portfolioDisplayCurrency);
  }

  async function loadPortfolio() {
    try {
      const response = await fetch("/api/portfolio", { cache: "no-store" });
      const payload = (await response.json()) as PortfolioPayload;
      if (!response.ok || !payload.portfolio) {
        throw new Error(payload.error ?? "Unable to load portfolio.");
      }

      setPortfolio(payload.portfolio);
      setPortfolioError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load portfolio.";
      setPortfolioError(message);
    }
  }

  async function refreshPortfolioPrices() {
    setPortfolioMessage("");
    setPortfolioError("");

    startPortfolioTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/portfolio/refresh", {
            method: "POST",
          });
          const payload = (await response.json()) as PortfolioPayload;
          if (!response.ok || !payload.portfolio) {
            throw new Error(payload.error ?? "Unable to refresh portfolio prices.");
          }

          setPortfolio(payload.portfolio);
          const refreshedCount = payload.refreshedCount ?? 0;
          const failedSymbols = payload.failedSymbols ?? [];

          if (failedSymbols.length > 0) {
            setPortfolioMessage(
              `Updated ${refreshedCount} symbol${refreshedCount === 1 ? "" : "s"}. Failed to refresh ${failedSymbols.join(", ")}.`,
            );
            return;
          }

          setPortfolioMessage(
            refreshedCount === 0
              ? "No saved holdings yet."
              : `Refreshed ${refreshedCount} portfolio symbol${refreshedCount === 1 ? "" : "s"} and updated stored market snapshots.`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to refresh portfolio prices.";
          setPortfolioError(message);
        }
      })();
    });
  }

  async function addPortfolioHolding() {
    setPortfolioMessage("");
    setPortfolioError("");

    const quantity = Number(portfolioForm.quantity);
    const purchasePrice = Number(portfolioForm.purchasePrice);

    if (!normalizedPortfolioSymbol) {
      setPortfolioError("Enter a stock symbol.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setPortfolioError("Quantity must be greater than zero.");
      return;
    }

    if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
      setPortfolioError("Purchase price must be greater than zero.");
      return;
    }

    startPortfolioTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/portfolio", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              symbol: normalizedPortfolioSymbol,
              quantity,
              purchasePrice,
            }),
          });
          const payload = (await response.json()) as PortfolioPayload;
          if (!response.ok || !payload.portfolio) {
            throw new Error(payload.error ?? "Unable to buy the stock.");
          }

          setPortfolio(payload.portfolio);
          setPortfolioForm((current) => ({
            ...current,
            symbol: normalizedPortfolioSymbol,
          }));
          const spentCash = payload.spentCash ?? quantity * purchasePrice;
          setPortfolioMessage(
            payload.refreshError
              ? `Bought ${normalizedPortfolioSymbol} for ${formatCurrency(spentCash, portfolio.account.currency)}. ${payload.refreshError}`
              : `Bought ${normalizedPortfolioSymbol} for ${formatCurrency(spentCash, portfolio.account.currency)} and refreshed its market snapshot.`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to buy the stock.";
          setPortfolioError(message);
        }
      })();
    });
  }

  async function buildSectorPortfolio() {
    setPortfolioMessage("");
    setPortfolioError("");

    if (!Number.isFinite(sectorBudget) || sectorBudget <= 0) {
      setPortfolioError("Sector budget must be greater than zero.");
      return;
    }

    if (sectorBudget > portfolio.account.cashBalance) {
      setPortfolioError("Sector budget is larger than your available virtual cash.");
      return;
    }

    startPortfolioTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/portfolio/sector", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sector: sectorForm.sector,
              budget: sectorBudget,
            }),
          });
          const payload = (await response.json()) as PortfolioPayload;
          if (!response.ok || !payload.portfolio) {
            throw new Error(payload.error ?? "Unable to build the sector portfolio.");
          }

          setPortfolio(payload.portfolio);
          const spentCash = payload.spentCash ?? sectorBudget;
          const purchasedSymbols = payload.purchasedSymbols ?? [];
          const failedSymbols = payload.failedSymbols ?? [];

          setPortfolioMessage(
            `${payload.sectorLabel ?? selectedSectorModel.label} deployed ${formatCurrency(
              spentCash,
              portfolio.account.currency,
            )}${purchasedSymbols.length > 0 ? ` across ${purchasedSymbols.join(", ")}` : ""}${
              failedSymbols.length > 0 ? `. Skipped ${failedSymbols.join(", ")}.` : "."
            }`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to build the sector portfolio.";
          setPortfolioError(message);
        }
      })();
    });
  }

  async function openHoldingHistory(holding: PortfolioHolding) {
    setSelectedHolding(holding);
    setHistorySnapshot(null);
    setHistoryError("");

    startHistoryTransition(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/market-data/history?symbol=${encodeURIComponent(holding.symbol)}&range=5y&interval=1d`,
            { cache: "no-store" },
          );
          const payload = (await response.json()) as HistoryPayload;
          if (!response.ok || !payload.snapshot) {
            throw new Error(payload.error ?? "Unable to load the five-year history.");
          }

          setHistorySnapshot(payload.snapshot);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load the five-year history.";
          setHistoryError(message);
        }
      })();
    });
  }

  function closeHoldingHistory() {
    setSelectedHolding(null);
    setHistorySnapshot(null);
    setHistoryError("");
  }

  return (
    <main className="page-shell terminal-shell">
      <section className="hero hero-terminal">
        <div>
          <p className="kicker">Portfolio Monitor</p>
          <h1>Track holdings, cash, and portfolio risk.</h1>
          <p className="hero-copy">
            Every signed-in account starts with $100,000 in virtual cash. Buy individual names, auto-build a sector
            basket, click any position for a five-year chart, and monitor daily portfolio VaR from stored market
            history.
          </p>
        </div>

        <div className="hero-panel">
          <div>
            <span className="panel-label">Buying Power</span>
            <strong>{formatCurrency(portfolio.account.cashBalance, portfolio.account.currency)}</strong>
          </div>
          <div>
            <span className="panel-label">Total Equity</span>
            <strong>{formatPortfolioCurrency(portfolio.summary.totalEquity)}</strong>
          </div>
          <div>
            <span className="panel-label">VaR Regime</span>
            <strong>{formatMarketCondition(portfolio.risk.marketCondition)}</strong>
          </div>
          <div>
            <span className="panel-label">User</span>
            <strong>{user.email ?? user.name ?? "User"}</strong>
          </div>
        </div>
      </section>

      <section className="layout-grid portfolio-layout">
        <aside className="control-panel">
          <div className="panel-heading">
            <p className="kicker">Trade Ticket</p>
            <h2>Buy stock</h2>
          </div>

          <label>
            Stock Symbol
            <input
              type="text"
              value={portfolioForm.symbol}
              onChange={(event) =>
                setPortfolioForm((current) => ({
                  ...current,
                  symbol: event.target.value.toUpperCase(),
                }))
              }
              placeholder="AAPL"
            />
          </label>

          <label>
            Quantity
            <input
              type="number"
              min="0.000001"
              step="0.01"
              value={portfolioForm.quantity}
              onChange={(event) =>
                setPortfolioForm((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Buy Price
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={portfolioForm.purchasePrice}
              onChange={(event) =>
                setPortfolioForm((current) => ({
                  ...current,
                  purchasePrice: event.target.value,
                }))
              }
            />
          </label>

          <div className="trade-preview">
            <span>Estimated Spend</span>
            <strong>{formatCurrency(estimatedTradeCost, portfolio.account.currency)}</strong>
          </div>

          <div className="action-row">
            <button type="button" onClick={addPortfolioHolding} disabled={isPortfolioPending}>
              {isPortfolioPending ? "Buying..." : "Buy Stock"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={refreshPortfolioPrices}
              disabled={isPortfolioPending}
            >
              {isPortfolioPending ? "Refreshing..." : "Refresh Prices"}
            </button>
          </div>

          <div className="sidebar-divider" />

          <div className="panel-heading panel-heading-compact">
            <p className="kicker">Sector Allocator</p>
            <h2>Build for me</h2>
          </div>

          <label>
            Sector Basket
            <select
              value={sectorForm.sector}
              onChange={(event) =>
                setSectorForm((current) => ({
                  ...current,
                  sector: event.target.value as PortfolioSectorId,
                }))
              }
            >
              {PORTFOLIO_SECTOR_MODELS.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sector Budget
            <input
              type="number"
              min="1"
              step="100"
              value={sectorForm.budget}
              onChange={(event) =>
                setSectorForm((current) => ({
                  ...current,
                  budget: event.target.value,
                }))
              }
            />
          </label>

          <p className="helper-text">{selectedSectorModel.thesis}</p>

          <button type="button" onClick={buildSectorPortfolio} disabled={isPortfolioPending}>
            {isPortfolioPending ? "Allocating..." : "Buy Sector Basket"}
          </button>

          <p className="helper-text">
            Each account starts with {formatCurrency(portfolio.account.startingCash, portfolio.account.currency)} in
            virtual cash. All buys debit that balance in {portfolio.account.currency}, using the position currency and
            FX rate in effect when the order is created.
          </p>
          {portfolio.summary.pendingHoldingsCount > 0 ? (
            <p className="helper-text">
              {portfolio.summary.pendingHoldingsCount} holding
              {portfolio.summary.pendingHoldingsCount === 1 ? "" : "s"} still need a valid quote.
            </p>
          ) : null}
          {portfolio.summary.isCurrencyMixed ? (
            <p className="helper-text">
              Cross-currency totals and VaR are converted into {portfolio.account.currency} using the portfolio FX engine.
            </p>
          ) : null}
          {portfolioMessage ? <p className="feedback">{portfolioMessage}</p> : null}
          {portfolioError ? <p className="feedback error">{portfolioError}</p> : null}
        </aside>

        <div className="content-stack">
          <section className="metrics-grid portfolio-metrics-grid">
            <MetricCard
              label="Available Cash"
              value={formatCurrency(portfolio.account.cashBalance, portfolio.account.currency)}
              note={`${formatSignedPercent(portfolio.summary.cashUtilizationPercent)} deployed`}
              accent="gold"
            />
            <MetricCard
              label="Holdings Value"
              value={formatPortfolioCurrency(portfolio.summary.totalCurrentValue)}
              note={`${portfolio.summary.pricedHoldingsCount} priced holding${portfolio.summary.pricedHoldingsCount === 1 ? "" : "s"}`}
              accent="cyan"
            />
            <MetricCard
              label="Total Equity"
              value={formatPortfolioCurrency(portfolio.summary.totalEquity)}
              note={`${portfolio.summary.holdingsCount} total position${portfolio.summary.holdingsCount === 1 ? "" : "s"}`}
              accent="green"
            />
            <MetricCard
              label="Cost Basis"
              value={formatPortfolioCurrency(portfolio.summary.totalCostBasis)}
              note={`${portfolio.summary.symbolsCount} symbol${portfolio.summary.symbolsCount === 1 ? "" : "s"}`}
              accent="gold"
            />
            <MetricCard
              label="Unrealized P/L"
              value={formatSignedCurrency(portfolio.summary.unrealizedGainLoss, portfolioDisplayCurrency)}
              note={formatSignedPercent(portfolio.summary.unrealizedGainLossPercent)}
              accent={portfolio.summary.unrealizedGainLoss >= 0 ? "green" : "red"}
            />
            <MetricCard
              label="1D VaR 95%"
              value={formatCurrency(portfolio.risk.valueAtRisk95, portfolio.account.currency)}
              note={formatMarketCondition(portfolio.risk.marketCondition)}
              accent={portfolio.risk.marketCondition === "stressed" ? "red" : "cyan"}
            />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <p className="kicker">Positions</p>
              <h2>Marked-to-market holdings</h2>
            </div>

            <div className="portfolio-list">
              {portfolio.holdings.length === 0 ? (
                <p className="empty-state">
                  No holdings yet. Buy a stock or deploy a sector basket from the left panel to start the portfolio.
                </p>
              ) : (
                portfolio.holdings.map((holding) => (
                  <button
                    key={holding._id}
                    type="button"
                    className={`portfolio-card portfolio-card-button tone-${holding.performanceTone}`}
                    onClick={() => openHoldingHistory(holding)}
                  >
                    <div className="portfolio-card-header">
                      <div>
                        <strong>{holding.symbol}</strong>
                        <p>{holding.shortName}</p>
                      </div>
                      <span className={`holding-pill tone-${holding.performanceTone}`}>
                        {holding.performanceTone === "green"
                          ? "↑"
                          : holding.performanceTone === "red"
                            ? "↓"
                            : holding.performanceTone === "flat"
                              ? "→"
                              : "…"}
                      </span>
                    </div>

                    <div className="portfolio-card-grid">
                      <div>
                        <span className="eyebrow">Quantity</span>
                        <strong>{formatPlainNumber(holding.quantity)}</strong>
                      </div>
                      <div>
                        <span className="eyebrow">Buy Price</span>
                        <strong>{formatCurrency(holding.purchasePrice, holding.currency)}</strong>
                      </div>
                      <div>
                        <span className="eyebrow">Current Price</span>
                        <strong>
                          {holding.currentPrice === null ? "Pending" : formatCurrency(holding.currentPrice, holding.currency)}
                        </strong>
                      </div>
                      <div>
                        <span className="eyebrow">Cost Basis</span>
                        <strong>{formatCurrency(holding.costBasis, holding.currency)}</strong>
                      </div>
                      <div>
                        <span className="eyebrow">Current Value</span>
                        <strong>
                          {holding.currentValue === null ? "Pending" : formatCurrency(holding.currentValue, holding.currency)}
                        </strong>
                      </div>
                      <div>
                        <span className="eyebrow">Unrealized P/L</span>
                        <strong className={`performance-${holding.performanceTone}`}>
                          {holding.unrealizedGainLoss === null
                            ? "Pending"
                            : `${holding.unrealizedGainLoss >= 0 ? "+" : ""}${formatCurrency(
                                holding.unrealizedGainLoss,
                                holding.currency,
                              )}`}
                        </strong>
                      </div>
                    </div>

                    <div className="portfolio-card-footer">
                      <span>
                        Return:{" "}
                        {holding.unrealizedGainLossPercent === null
                          ? "Pending"
                          : formatSignedPercent(holding.unrealizedGainLossPercent)}
                      </span>
                      <span>{holding.fetchedAt ? `Snapshot refreshed ${formatDate(holding.fetchedAt)}` : "No saved quote yet"}</span>
                      <span>Click for position + five-year trend</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <p className="kicker">Risk Engine</p>
              <h2>Portfolio value at risk</h2>
            </div>

            <div className="risk-grid">
              <MetricCard
                label="One-Day VaR 95%"
                value={formatCurrency(portfolio.risk.valueAtRisk95, portfolio.account.currency)}
                note={`${portfolio.risk.lookbackDays} aligned returns`}
                accent="red"
              />
              <MetricCard
                label="One-Day VaR 99%"
                value={formatCurrency(portfolio.risk.valueAtRisk99, portfolio.account.currency)}
                note="Tail loss threshold"
                accent="red"
              />
              <MetricCard
                label="Expected Shortfall"
                value={formatCurrency(portfolio.risk.expectedShortfall95, portfolio.account.currency)}
                note="Average beyond VaR"
                accent="gold"
              />
              <MetricCard
                label="Annualized Vol"
                value={formatRatioPercent(portfolio.risk.annualizedVolatility)}
                note={formatMarketCondition(portfolio.risk.marketCondition)}
                accent={portfolio.risk.marketCondition === "stressed" ? "red" : "cyan"}
              />
            </div>

            <div className="split-panel risk-panel">
              <article className="risk-block">
                <p className="eyebrow">Market Condition</p>
                <h3>{formatMarketCondition(portfolio.risk.marketCondition)}</h3>
                <p className="helper-text">{portfolio.risk.methodology}</p>

                <div className="status-strip">
                  <span className="status-badge">{`Concentration ${formatRatioPercent(portfolio.risk.concentration)}`}</span>
                  <span className="status-badge">{`Blend Vol ${formatRatioPercent(portfolio.risk.weightedRealizedVolatility)}`}</span>
                  <span className="status-badge">{`Return Drift ${formatSignedPercent(
                    portfolio.risk.weightedAnnualizedReturn * 100,
                  )}`}</span>
                  {portfolio.risk.fxPairsUsed.length > 0 ? (
                    <span className="status-badge">{`FX ${portfolio.risk.fxPairsUsed.join(", ")}`}</span>
                  ) : null}
                  {portfolio.risk.topHoldingSymbol ? (
                    <span className="status-badge">{`${portfolio.risk.topHoldingSymbol} ${formatRatioPercent(
                      portfolio.risk.topHoldingWeight,
                    )}`}</span>
                  ) : null}
                </div>
              </article>

              <article className="risk-block">
                <p className="eyebrow">Risk Drivers</p>
                <ul className="risk-list">
                  {portfolio.risk.drivers.map((driver) => (
                    <li key={driver}>{driver}</li>
                  ))}
                </ul>
                {portfolio.risk.worstDailyReturn !== null && portfolio.risk.bestDailyReturn !== null ? (
                  <p className="helper-text">
                    Historical daily range: {formatSignedPercent(portfolio.risk.worstDailyReturn * 100)} to{" "}
                    {formatSignedPercent(portfolio.risk.bestDailyReturn * 100)}.
                  </p>
                ) : null}
              </article>
            </div>
          </section>
        </div>
      </section>

      {historySymbol ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="holding-history-title" onClick={closeHoldingHistory}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="kicker">Holding History</p>
                <h2 id="holding-history-title">{historySnapshot?.symbol ?? historySymbol}</h2>
              </div>
              <button type="button" className="ghost-button modal-close" onClick={closeHoldingHistory}>
                Close
              </button>
            </div>

            {isHistoryPending ? <p className="feedback">Loading five-year history for {historySymbol}...</p> : null}
            {historyError ? <p className="feedback error">{historyError}</p> : null}

            {selectedHolding ? (
              <div className="risk-grid">
                <MetricCard
                  label="Held Quantity"
                  value={formatPlainNumber(selectedHolding.quantity)}
                  note={selectedHolding.symbol}
                  accent="cyan"
                />
                <MetricCard
                  label="Cost Basis"
                  value={formatCurrency(selectedHolding.costBasisBase, selectedHolding.accountCurrency)}
                  note={`${formatCurrency(selectedHolding.costBasis, selectedHolding.currency)} local`}
                  accent="gold"
                />
                <MetricCard
                  label="Current Value"
                  value={
                    selectedHolding.currentValueBase === null
                      ? "Pending"
                      : formatCurrency(selectedHolding.currentValueBase, selectedHolding.accountCurrency)
                  }
                  note={
                    selectedHolding.currentValue === null
                      ? "Awaiting quote"
                      : `${formatCurrency(selectedHolding.currentValue, selectedHolding.currency)} local`
                  }
                  accent="cyan"
                />
                <MetricCard
                  label="Equity Impact"
                  value={
                    selectedHolding.unrealizedGainLossBase === null
                      ? "Pending"
                      : formatSignedCurrency(selectedHolding.unrealizedGainLossBase, selectedHolding.accountCurrency)
                  }
                  note={`FX ${formatPlainNumber(selectedHolding.fxRateToBase)} ${selectedHolding.accountCurrency}/${selectedHolding.currency}`}
                  accent={selectedHolding.unrealizedGainLossBase !== null && selectedHolding.unrealizedGainLossBase < 0 ? "red" : "green"}
                />
              </div>
            ) : null}

            {historySnapshot && historyChart ? (
              <div className="content-stack">
                <div>
                  <p className="helper-text">
                    {historySnapshot.shortName} · {historySnapshot.exchangeName} · {historySnapshot.points.length} daily
                    observations
                  </p>

                  <div className="chart-shell">
                    <svg
                      viewBox={`0 0 ${historyChart.width} ${historyChart.height}`}
                      className="history-chart"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <defs>
                        <linearGradient id="history-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(37, 99, 235, 0.22)" />
                          <stop offset="100%" stopColor="rgba(37, 99, 235, 0.02)" />
                        </linearGradient>
                      </defs>
                      <line
                        className="chart-grid-line"
                        x1={historyChart.padding}
                        x2={historyChart.width - historyChart.padding}
                        y1={historyChart.padding}
                        y2={historyChart.padding}
                      />
                      <line
                        className="chart-grid-line"
                        x1={historyChart.padding}
                        x2={historyChart.width - historyChart.padding}
                        y1={historyChart.height - historyChart.padding}
                        y2={historyChart.height - historyChart.padding}
                      />
                      <text x={historyChart.padding} y={historyChart.padding - 6} className="chart-axis-label">
                        High {formatCurrency(historyChart.maxClose, historySnapshot.currency)}
                      </text>
                      <text
                        x={historyChart.padding}
                        y={historyChart.height - historyChart.padding - 6}
                        className="chart-axis-label"
                      >
                        Low {formatCurrency(historyChart.minClose, historySnapshot.currency)}
                      </text>
                      <path d={historyChart.areaPath} fill="url(#history-fill)" />
                      <path d={historyChart.linePath} fill="none" stroke="var(--accent-cyan)" strokeWidth="3" />
                      <circle
                        cx={historyChart.startLabel.pointX}
                        cy={historyChart.startLabel.pointY}
                        r="4"
                        className="chart-point"
                      />
                      <circle
                        cx={historyChart.endLabel.pointX}
                        cy={historyChart.endLabel.pointY}
                        r="4"
                        className="chart-point"
                      />
                      <text x={historyChart.startLabel.x} y={historyChart.startLabel.y} className="chart-value-label">
                        {formatCurrency(historyChart.startLabel.value, historySnapshot.currency)}
                      </text>
                      <text
                        x={historyChart.endLabel.x}
                        y={historyChart.endLabel.y}
                        className="chart-value-label"
                        textAnchor="end"
                      >
                        {formatCurrency(historyChart.endLabel.value, historySnapshot.currency)}
                      </text>
                    </svg>
                  </div>

                  <div className="chart-caption">
                    <span>{historyChart.startDate ? formatDate(historyChart.startDate) : "Start"}</span>
                    <span>{historyChart.endDate ? formatDate(historyChart.endDate) : "End"}</span>
                  </div>
                </div>

                <div className="risk-grid">
                  <MetricCard
                    label="Five-Year Return"
                    value={formatSignedPercent(((historyChart.endPrice - historyChart.startPrice) / historyChart.startPrice) * 100)}
                    note={historySnapshot.currency}
                    accent={historyChart.endPrice >= historyChart.startPrice ? "green" : "red"}
                  />
                  <MetricCard
                    label="Range High"
                    value={formatCurrency(historyChart.maxClose, historySnapshot.currency)}
                    note="Closing basis"
                    accent="cyan"
                  />
                  <MetricCard
                    label="Range Low"
                    value={formatCurrency(historyChart.minClose, historySnapshot.currency)}
                    note="Closing basis"
                    accent="gold"
                  />
                  <MetricCard
                    label="Realized Vol"
                    value={formatRatioPercent(historySnapshot.realizedVolatility)}
                    note={selectedHolding ? `This position feeds your ${portfolio.account.currency} VaR.` : "Annualized"}
                    accent="red"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
