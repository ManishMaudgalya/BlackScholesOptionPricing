"use client";

import { useEffect, useState, useTransition } from "react";
import type { PortfolioState } from "@/lib/portfolio/types";

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

type PortfolioPayload = {
  portfolio?: PortfolioState;
  error?: string;
  refreshError?: string;
  refreshedCount?: number;
  failedSymbols?: string[];
};

const DEFAULT_SYMBOL = "AAPL";

const initialPortfolioForm: PortfolioFormState = {
  symbol: DEFAULT_SYMBOL,
  quantity: "10",
  purchasePrice: "100",
};

const emptyPortfolio: PortfolioState = {
  holdings: [],
  summary: {
    holdingsCount: 0,
    symbolsCount: 0,
    totalCostBasis: 0,
    pricedCostBasis: 0,
    totalCurrentValue: 0,
    unrealizedGainLoss: 0,
    unrealizedGainLossPercent: 0,
    pricedHoldingsCount: 0,
    pendingHoldingsCount: 0,
    currencies: [],
    displayCurrency: null,
    isCurrencyMixed: false,
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

const formatSignedPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

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
  const [portfolioMessage, setPortfolioMessage] = useState("");
  const [portfolioError, setPortfolioError] = useState("");
  const [isPortfolioPending, startPortfolioTransition] = useTransition();

  const portfolioDisplayCurrency = portfolio.summary.displayCurrency || "USD";
  const normalizedPortfolioSymbol = portfolioForm.symbol.trim().toUpperCase() || DEFAULT_SYMBOL;

  useEffect(() => {
    startPortfolioTransition(() => {
      void loadPortfolio();
    });
  }, []);

  function formatPortfolioCurrency(value: number) {
    return portfolio.summary.isCurrencyMixed ? formatPlainNumber(value) : formatCurrency(value, portfolioDisplayCurrency);
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
            throw new Error(payload.error ?? "Unable to add portfolio holding.");
          }

          setPortfolio(payload.portfolio);
          setPortfolioForm((current) => ({
            ...current,
            symbol: normalizedPortfolioSymbol,
          }));
          setPortfolioMessage(
            payload.refreshError
              ? `Saved ${normalizedPortfolioSymbol} to your portfolio. ${payload.refreshError}`
              : `Saved ${normalizedPortfolioSymbol} to your portfolio and refreshed its market snapshot.`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to add portfolio holding.";
          setPortfolioError(message);
        }
      })();
    });
  }

  return (
    <main className="page-shell terminal-shell">
      <section className="hero hero-terminal">
        <div>
          <p className="kicker">Portfolio Monitor</p>
          <h1>Track holdings separately from the pricing terminal.</h1>
          <p className="hero-copy">
            Add positions, persist them to MongoDB under your user, and reprice the portfolio with Massive for U.S.
            symbols and Yahoo Finance for international ones.
          </p>
        </div>

        <div className="hero-panel">
          <div>
            <span className="panel-label">Holdings</span>
            <strong>{portfolio.summary.holdingsCount}</strong>
          </div>
          <div>
            <span className="panel-label">Symbols</span>
            <strong>{portfolio.summary.symbolsCount}</strong>
          </div>
          <div>
            <span className="panel-label">Unrealized P/L</span>
            <strong className={portfolio.summary.unrealizedGainLoss >= 0 ? "performance-green" : "performance-red"}>
              {portfolio.summary.isCurrencyMixed
                ? `${portfolio.summary.unrealizedGainLoss >= 0 ? "+" : ""}${formatPlainNumber(
                    portfolio.summary.unrealizedGainLoss,
                  )}`
                : `${portfolio.summary.unrealizedGainLoss >= 0 ? "+" : ""}${formatPortfolioCurrency(
                    portfolio.summary.unrealizedGainLoss,
                  )}`}
            </strong>
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
            <h2>Add holding</h2>
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

          <div className="action-row">
            <button type="button" onClick={addPortfolioHolding} disabled={isPortfolioPending}>
              {isPortfolioPending ? "Saving..." : "Add Holding"}
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

          <p className="helper-text">
            U.S. holdings use Massive after refresh, with delayed or closing data when your plan does not include live
            snapshots. Holdings are stored in MongoDB against your user ID so each signed-in account sees its own
            portfolio.
          </p>
          {portfolio.summary.pendingHoldingsCount > 0 ? (
            <p className="helper-text">
              {portfolio.summary.pendingHoldingsCount} holding
              {portfolio.summary.pendingHoldingsCount === 1 ? "" : "s"} still need a valid quote.
            </p>
          ) : null}
          {portfolio.summary.isCurrencyMixed ? (
            <p className="helper-text">
              Totals are not FX-converted because your holdings span multiple currencies.
            </p>
          ) : null}
          {portfolioMessage ? <p className="feedback">{portfolioMessage}</p> : null}
          {portfolioError ? <p className="feedback error">{portfolioError}</p> : null}
        </aside>

        <div className="content-stack">
          <section className="metrics-grid portfolio-metrics-grid">
            <MetricCard
              label="Total Cost Basis"
              value={formatPortfolioCurrency(portfolio.summary.totalCostBasis)}
              note={`${portfolio.summary.holdingsCount} holding${portfolio.summary.holdingsCount === 1 ? "" : "s"}`}
              accent="gold"
            />
            <MetricCard
              label="Current Value"
              value={formatPortfolioCurrency(portfolio.summary.totalCurrentValue)}
              note={`${portfolio.summary.pricedHoldingsCount} priced holding${portfolio.summary.pricedHoldingsCount === 1 ? "" : "s"}`}
              accent="cyan"
            />
            <MetricCard
              label="Unrealized P/L"
              value={
                portfolio.summary.isCurrencyMixed
                  ? `${portfolio.summary.unrealizedGainLoss >= 0 ? "+" : ""}${formatPlainNumber(
                      portfolio.summary.unrealizedGainLoss,
                    )}`
                  : `${portfolio.summary.unrealizedGainLoss >= 0 ? "+" : ""}${formatPortfolioCurrency(
                      portfolio.summary.unrealizedGainLoss,
                    )}`
              }
              note={formatSignedPercent(portfolio.summary.unrealizedGainLossPercent)}
              accent={portfolio.summary.unrealizedGainLoss >= 0 ? "green" : "red"}
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
                  No holdings yet. Add a symbol on the left to start storing positions for this user.
                </p>
              ) : (
                portfolio.holdings.map((holding) => (
                  <article key={holding._id} className={`portfolio-card tone-${holding.performanceTone}`}>
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
                      <span>
                        {holding.fetchedAt ? `Snapshot refreshed ${formatDate(holding.fetchedAt)}` : "No saved quote yet"}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
