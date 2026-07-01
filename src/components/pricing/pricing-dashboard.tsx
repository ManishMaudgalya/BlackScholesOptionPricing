"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  blackScholesGreeks,
  blackScholesPrice,
  calculateD1,
  calculateD2,
  type GreeksResult,
} from "@/lib/finance/black-scholes";

type OptionSide = "call" | "put";

type UserData = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type CalculationRecord = {
  _id: string;
  inputs: {
    spotPrice: number;
    strikePrice: number;
    timeToExpiry: number;
    riskFreeRate: number;
    volatility: number;
    optionType: OptionSide;
  };
  results: {
    prices: {
      call: number;
      put: number;
    };
    greeks: GreeksResult;
  };
  marketData?: {
    symbol?: string;
    shortName?: string;
    source?: string;
    currency?: string;
    latestClose?: number | null;
    latestCloseAt?: string | null;
    realizedVolatility?: number | null;
    fetchedAt?: string | null;
  };
  createdAt: string;
};

type MarketDataSnapshot = {
  symbol: string;
  shortName: string;
  currency: string;
  exchangeName: string;
  instrumentType: string;
  timezone: string;
  range: string;
  interval: string;
  source: string;
  latestClose: number;
  latestCloseAt: string;
  previousClose: number | null;
  regularMarketPrice: number | null;
  realizedVolatility: number;
  annualizedReturn: number;
  fetchedAt: string;
  points: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
};

type FormState = {
  spotPrice: number;
  strikePrice: number;
  timeToExpiry: number;
  riskFreeRatePercent: number;
  volatilityPercent: number;
  optionType: OptionSide;
};

const DEFAULT_SYMBOL = "AAPL";

const initialForm: FormState = {
  spotPrice: 100,
  strikePrice: 100,
  timeToExpiry: 1,
  riskFreeRatePercent: 5,
  volatilityPercent: 20,
  optionType: "call",
};

const formatCurrency = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);

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

export function PricingDashboard({ user }: { user: UserData }) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [savedCalculations, setSavedCalculations] = useState<CalculationRecord[]>([]);
  const [marketData, setMarketData] = useState<MarketDataSnapshot | null>(null);
  const [marketSymbolInput, setMarketSymbolInput] = useState(DEFAULT_SYMBOL);
  const [saveMessage, setSaveMessage] = useState("");
  const [loadMessage, setLoadMessage] = useState("");
  const [marketMessage, setMarketMessage] = useState("");
  const [isHistoryPending, startHistoryTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();
  const [isMarketPending, startMarketTransition] = useTransition();

  const riskFreeRate = form.riskFreeRatePercent / 100;
  const volatility = form.volatilityPercent / 100;
  const normalizedMarketSymbol = marketSymbolInput.trim().toUpperCase() || DEFAULT_SYMBOL;
  const activeCurrency = marketData?.currency || "USD";

  const analytics = useMemo(() => {
    const callPrice = blackScholesPrice(
      form.spotPrice,
      form.strikePrice,
      form.timeToExpiry,
      riskFreeRate,
      volatility,
      "call",
    );
    const putPrice = blackScholesPrice(
      form.spotPrice,
      form.strikePrice,
      form.timeToExpiry,
      riskFreeRate,
      volatility,
      "put",
    );
    const greeks = blackScholesGreeks(
      form.spotPrice,
      form.strikePrice,
      form.timeToExpiry,
      riskFreeRate,
      volatility,
    );
    const d1 = calculateD1(
      form.spotPrice,
      form.strikePrice,
      form.timeToExpiry,
      riskFreeRate,
      volatility,
    );
    const d2 = calculateD2(form.timeToExpiry, volatility, d1);

    return {
      callPrice,
      putPrice,
      greeks,
      d1,
      d2,
      parityGap:
        callPrice - putPrice - (form.spotPrice - form.strikePrice * Math.exp(-riskFreeRate * form.timeToExpiry)),
    };
  }, [form, riskFreeRate, volatility]);

  const heatmap = useMemo(() => {
    const strikeOffsets = [0.7, 0.82, 0.94, 1, 1.06, 1.18, 1.3];
    const volValues = [0.1, 0.16, 0.22, 0.28, 0.34, 0.4, 0.5];
    const prices = strikeOffsets.map((factor) =>
      volValues.map((sigma) =>
        blackScholesPrice(
          form.spotPrice,
          Number((form.spotPrice * factor).toFixed(2)),
          form.timeToExpiry,
          riskFreeRate,
          sigma,
          form.optionType,
        ),
      ),
    );

    const flattened = prices.flat();
    const min = Math.min(...flattened);
    const max = Math.max(...flattened);

    return {
      strikeOffsets,
      volValues,
      cells: prices.map((row, rowIndex) =>
        row.map((value, columnIndex) => {
          const normalized = max === min ? 0.5 : (value - min) / (max - min);
          return {
            id: `${rowIndex}-${columnIndex}`,
            value,
            normalized,
          };
        }),
      ),
    };
  }, [form.optionType, form.spotPrice, form.timeToExpiry, riskFreeRate]);

  useEffect(() => {
    startHistoryTransition(() => {
      void refreshCalculations();
    });
    startMarketTransition(() => {
      void loadStoredMarketData(DEFAULT_SYMBOL);
    });
  }, []);

  function applyMarketSnapshot(snapshot: MarketDataSnapshot, message: string) {
    const latestClose = Number(snapshot.latestClose.toFixed(2));
    const volatilityPercent = Number((snapshot.realizedVolatility * 100).toFixed(2));

    setMarketData(snapshot);
    setMarketSymbolInput(snapshot.symbol);
    setForm((current) => {
      const shouldSyncStrike =
        current.strikePrice === current.spotPrice || current.strikePrice === initialForm.strikePrice;

      return {
        ...current,
        spotPrice: latestClose,
        strikePrice: shouldSyncStrike ? latestClose : current.strikePrice,
        volatilityPercent,
      };
    });
    setMarketMessage(message);
  }

  async function loadStoredMarketData(symbol: string) {
    try {
      setMarketMessage("");
      const response = await fetch(`/api/market-data?symbol=${encodeURIComponent(symbol)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { snapshot?: MarketDataSnapshot | null; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load saved market data.");
      }

      if (!payload.snapshot) {
        setMarketData(null);
        setMarketMessage(`No saved Yahoo Finance snapshot for ${symbol}. Refresh to pull the latest available data.`);
        return;
      }

      applyMarketSnapshot(payload.snapshot, `Loaded saved ${payload.snapshot.symbol} market history from MongoDB.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load saved market data.";
      setMarketMessage(message);
    }
  }

  async function refreshCalculations() {
    try {
      setLoadMessage("");
      const response = await fetch("/api/calculations", { cache: "no-store" });
      const payload = (await response.json()) as { calculations?: CalculationRecord[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load calculation history.");
      }
      setSavedCalculations(payload.calculations ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load calculation history.";
      setLoadMessage(message);
    }
  }

  async function refreshMarketData() {
    setMarketMessage("");

    startMarketTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/market-data", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              symbol: normalizedMarketSymbol,
            }),
          });

          const payload = (await response.json()) as { snapshot?: MarketDataSnapshot; error?: string };
          if (!response.ok || !payload.snapshot) {
            throw new Error(payload.error ?? "Unable to refresh Yahoo Finance data.");
          }

          applyMarketSnapshot(
            payload.snapshot,
            `Refreshed ${payload.snapshot.symbol} from Yahoo Finance and stored the snapshot in MongoDB.`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to refresh Yahoo Finance data.";
          setMarketMessage(message);
        }
      })();
    });
  }

  async function saveCalculation() {
    setSaveMessage("");

    startSaveTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/calculations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              spotPrice: form.spotPrice,
              strikePrice: form.strikePrice,
              timeToExpiry: form.timeToExpiry,
              riskFreeRate,
              volatility,
              optionType: form.optionType,
              marketData: marketData
                ? {
                    symbol: marketData.symbol,
                    shortName: marketData.shortName,
                    source: marketData.source,
                    currency: marketData.currency,
                    latestClose: marketData.latestClose,
                    latestCloseAt: marketData.latestCloseAt,
                    realizedVolatility: marketData.realizedVolatility,
                    fetchedAt: marketData.fetchedAt,
                  }
                : undefined,
            }),
          });

          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to save calculation.");
          }

          setSaveMessage("Calculation saved to MongoDB.");
          await refreshCalculations();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to save calculation.";
          setSaveMessage(message);
        }
      })();
    });
  }

  function updateField<Key extends keyof FormState>(field: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const greekCards = [
    ["Delta (Call)", analytics.greeks.deltaCall],
    ["Delta (Put)", analytics.greeks.deltaPut],
    ["Gamma", analytics.greeks.gamma],
    ["Theta (Call)", analytics.greeks.thetaCall],
    ["Theta (Put)", analytics.greeks.thetaPut],
    ["Vega", analytics.greeks.vega],
    ["Rho (Call)", analytics.greeks.rhoCall],
    ["Rho (Put)", analytics.greeks.rhoPut],
  ] as const;

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="kicker">Black-Scholes web terminal</p>
          <h1>Option pricing with Yahoo Finance history and MongoDB-backed market snapshots.</h1>
          <p className="hero-copy">
            Refresh the latest daily history for any Yahoo Finance symbol, apply the newest close and realized
            volatility to the model, and persist both the market snapshot and the resulting calculation in
            MongoDB under your signed-in account.
          </p>
        </div>

        <div className="hero-panel">
          <div>
            <span className="panel-label">Selected side</span>
            <strong>{form.optionType.toUpperCase()}</strong>
          </div>
          <div>
            <span className="panel-label">Market symbol</span>
            <strong>{marketData?.symbol ?? normalizedMarketSymbol}</strong>
          </div>
          <div>
            <span className="panel-label">Latest close</span>
            <strong>
              {marketData ? formatCurrency(marketData.latestClose, marketData.currency) : "Not loaded"}
            </strong>
          </div>
          <div>
            <span className="panel-label">Signed in</span>
            <strong>{user.email ?? user.name ?? "User"}</strong>
          </div>
        </div>
      </section>

      <section className="layout-grid">
        <aside className="control-panel">
          <div className="panel-heading">
            <p className="kicker">Inputs</p>
            <h2>Pricing controls</h2>
          </div>

          <label>
            Yahoo Finance Symbol
            <input
              type="text"
              value={marketSymbolInput}
              onChange={(event) => setMarketSymbolInput(event.target.value.toUpperCase())}
              placeholder="AAPL or RELIANCE.NS"
            />
          </label>

          <div className="action-row">
            <button type="button" onClick={refreshMarketData} disabled={isMarketPending}>
              {isMarketPending ? "Refreshing..." : "Refresh Yahoo Data"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setForm(initialForm);
                setMarketData(null);
                setMarketSymbolInput(DEFAULT_SYMBOL);
                setMarketMessage("");
              }}
              disabled={isMarketPending || isSavePending}
            >
              Reset
            </button>
          </div>

          <label>
            Spot Price (S)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.spotPrice}
              onChange={(event) => updateField("spotPrice", Number(event.target.value))}
            />
          </label>

          <label>
            Strike Price (K)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.strikePrice}
              onChange={(event) => updateField("strikePrice", Number(event.target.value))}
            />
          </label>

          <label>
            Time to Expiry (Years)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.timeToExpiry}
              onChange={(event) => updateField("timeToExpiry", Number(event.target.value))}
            />
          </label>

          <label>
            Risk-Free Rate (%)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.riskFreeRatePercent}
              onChange={(event) => updateField("riskFreeRatePercent", Number(event.target.value))}
            />
          </label>

          <label>
            Volatility (%)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.volatilityPercent}
              onChange={(event) => updateField("volatilityPercent", Number(event.target.value))}
            />
          </label>

          <label>
            Option Side
            <select
              value={form.optionType}
              onChange={(event) => updateField("optionType", event.target.value as OptionSide)}
            >
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
          </label>

          <div className="action-row">
            <button type="button" onClick={saveCalculation} disabled={isSavePending}>
              {isSavePending ? "Saving..." : "Save to MongoDB"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                startHistoryTransition(() => {
                  void refreshCalculations();
                });
              }}
              disabled={isHistoryPending}
            >
              {isHistoryPending ? "Loading..." : "Reload History"}
            </button>
          </div>

          <p className="helper-text">
            Refresh pulls the latest daily history currently available from Yahoo Finance, stores it in MongoDB,
            and applies the latest close plus annualized realized volatility to the model inputs.
          </p>
          {marketData ? (
            <p className="helper-text">
              {marketData.shortName} on {marketData.exchangeName} last closed at{" "}
              {formatCurrency(marketData.latestClose, marketData.currency)} on {formatDate(marketData.latestCloseAt)}.
            </p>
          ) : null}
          {marketData ? (
            <p className="helper-text">
              Historical volatility applied: {(marketData.realizedVolatility * 100).toFixed(2)}% annualized from{" "}
              {marketData.points.length} daily observations.
            </p>
          ) : null}
          {marketMessage ? <p className="feedback">{marketMessage}</p> : null}
          {saveMessage ? <p className="feedback">{saveMessage}</p> : null}
          {loadMessage ? <p className="feedback error">{loadMessage}</p> : null}
        </aside>

        <div className="content-stack">
          <section className="metrics-grid">
            <MetricCard
              label="Call Price"
              value={formatCurrency(analytics.callPrice, activeCurrency)}
              accent="green"
            />
            <MetricCard label="Put Price" value={formatCurrency(analytics.putPrice, activeCurrency)} accent="red" />
            <MetricCard
              label="Put-Call Parity Gap"
              value={analytics.parityGap.toFixed(6)}
              note="Should stay near zero for stable inputs"
              accent="gold"
            />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <p className="kicker">Greeks</p>
              <h2>Model sensitivities</h2>
            </div>
            <div className="greek-grid">
              {greekCards.map(([label, value]) => (
                <MetricCard key={label} label={label} value={value.toFixed(6)} />
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <p className="kicker">Surface</p>
              <h2>Strike vs volatility heatmap</h2>
            </div>
            <div className="heatmap-shell">
              <div className="heatmap-axis top-axis">
                <span />
                {heatmap.volValues.map((volValue) => (
                  <span key={volValue}>{(volValue * 100).toFixed(0)}%</span>
                ))}
              </div>
              {heatmap.cells.map((row, rowIndex) => (
                <div className="heatmap-row" key={heatmap.strikeOffsets[rowIndex]}>
                  <span className="heatmap-label">
                    {(form.spotPrice * heatmap.strikeOffsets[rowIndex]).toFixed(2)}
                  </span>
                  {row.map((cell) => (
                    <div
                      key={cell.id}
                      className="heatmap-cell"
                      style={{
                        background: `linear-gradient(180deg, rgba(85,214,255,${0.18 + cell.normalized * 0.65}), rgba(89,224,162,${0.12 + cell.normalized * 0.5}))`,
                      }}
                      title={`${form.optionType.toUpperCase()} price: ${cell.value.toFixed(4)}`}
                    >
                      {cell.value.toFixed(2)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="split-panel">
            <article className="panel">
              <div className="panel-heading">
                <p className="kicker">Intermediates</p>
                <h2>Black-Scholes terms</h2>
              </div>
              <div className="metrics-grid compact">
                <MetricCard label="d1" value={Number.isFinite(analytics.d1) ? analytics.d1.toFixed(6) : "—"} />
                <MetricCard label="d2" value={Number.isFinite(analytics.d2) ? analytics.d2.toFixed(6) : "—"} />
                <MetricCard label="Risk-free rate" value={`${form.riskFreeRatePercent.toFixed(2)}%`} />
                <MetricCard label="Volatility" value={`${form.volatilityPercent.toFixed(2)}%`} />
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <p className="kicker">Persistence</p>
                <h2>Recent MongoDB saves</h2>
              </div>
              <div className="history-list">
                {savedCalculations.length === 0 ? (
                  <p className="empty-state">
                    No saved calculations yet. Refresh a Yahoo Finance symbol, then save a scenario.
                  </p>
                ) : (
                  savedCalculations.map((item) => (
                    <article key={item._id} className="history-card">
                      <div className="history-header">
                        <strong>{item.inputs.optionType.toUpperCase()} scenario</strong>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                      <p>
                        {item.marketData?.symbol ? `${item.marketData.symbol} · ` : ""}
                        Spot {item.inputs.spotPrice.toFixed(2)} · Strike {item.inputs.strikePrice.toFixed(2)} · Vol{" "}
                        {(item.inputs.volatility * 100).toFixed(2)}%
                      </p>
                      <p>
                        Call{" "}
                        {formatCurrency(item.results.prices.call, item.marketData?.currency || activeCurrency)} · Put{" "}
                        {formatCurrency(item.results.prices.put, item.marketData?.currency || activeCurrency)}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}
