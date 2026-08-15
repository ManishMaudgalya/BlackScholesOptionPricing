"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  BacktestResponsePayload,
  BacktestResult,
  BacktestStrategyInput,
  BacktestStrategyType,
  CustomRuleKind,
} from "@/lib/backtesting/types";

type UserData = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type StrategyFormState = {
  id: string;
  name: string;
  type: BacktestStrategyType;
  fastWindow: string;
  slowWindow: string;
  rsiPeriod: string;
  rsiBuyBelow: string;
  rsiSellAbove: string;
  breakoutWindow: string;
  exitWindow: string;
  stopLossPercent: string;
  takeProfitPercent: string;
  customEntryKind: CustomRuleKind;
  customEntryPeriod: string;
  customEntryThreshold: string;
  customExitKind: CustomRuleKind;
  customExitPeriod: string;
  customExitThreshold: string;
};

type EquityChartPath = {
  id: string;
  name: string;
  path: string;
  color: string;
  endLabel: {
    pointX: number;
    pointY: number;
    x: number;
    y: number;
    value: number;
  };
};

const DEFAULT_SYMBOL = "AAPL";

const strategyTypeLabels: Record<BacktestStrategyType, string> = {
  "sma-cross": "SMA Cross",
  "rsi-reversion": "RSI Reversion",
  breakout: "Breakout",
  "custom-rules": "Custom Rules",
};

const customRuleLabels: Record<CustomRuleKind, string> = {
  "price-above-sma": "Close Above SMA",
  "price-below-sma": "Close Below SMA",
  "rsi-below": "RSI Below",
  "rsi-above": "RSI Above",
};

const initialStrategies: StrategyFormState[] = [
  {
    id: "strategy-a",
    name: "Momentum Cross",
    type: "sma-cross",
    fastWindow: "20",
    slowWindow: "50",
    rsiPeriod: "14",
    rsiBuyBelow: "30",
    rsiSellAbove: "62",
    breakoutWindow: "55",
    exitWindow: "20",
    stopLossPercent: "12",
    takeProfitPercent: "0",
    customEntryKind: "price-above-sma",
    customEntryPeriod: "50",
    customEntryThreshold: "30",
    customExitKind: "price-below-sma",
    customExitPeriod: "50",
    customExitThreshold: "70",
  },
  {
    id: "strategy-b",
    name: "Breakout Trend",
    type: "breakout",
    fastWindow: "50",
    slowWindow: "200",
    rsiPeriod: "14",
    rsiBuyBelow: "28",
    rsiSellAbove: "65",
    breakoutWindow: "55",
    exitWindow: "20",
    stopLossPercent: "10",
    takeProfitPercent: "0",
    customEntryKind: "rsi-below",
    customEntryPeriod: "14",
    customEntryThreshold: "30",
    customExitKind: "rsi-above",
    customExitPeriod: "14",
    customExitThreshold: "65",
  },
];

const formatCurrency = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatNumber = (value: number, fractionDigits = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));

const formatSignedPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatDrawdown = (value: number) => `-${value.toFixed(2)}%`;
const clampChartLabelY = (value: number, height: number) => Math.min(Math.max(value, 18), height - 12);

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function buildStrategyPayload(strategy: StrategyFormState): BacktestStrategyInput {
  return {
    id: strategy.id,
    name: strategy.name,
    type: strategy.type,
    fastWindow: parseNumber(strategy.fastWindow, 20),
    slowWindow: parseNumber(strategy.slowWindow, 50),
    rsiPeriod: parseNumber(strategy.rsiPeriod, 14),
    rsiBuyBelow: parseNumber(strategy.rsiBuyBelow, 30),
    rsiSellAbove: parseNumber(strategy.rsiSellAbove, 60),
    breakoutWindow: parseNumber(strategy.breakoutWindow, 55),
    exitWindow: parseNumber(strategy.exitWindow, 20),
    stopLossPercent: parseNumber(strategy.stopLossPercent, 0),
    takeProfitPercent: parseNumber(strategy.takeProfitPercent, 0),
    customEntry: {
      kind: strategy.customEntryKind,
      period: parseNumber(strategy.customEntryPeriod, 50),
      threshold: parseNumber(strategy.customEntryThreshold, 30),
    },
    customExit: {
      kind: strategy.customExitKind,
      period: parseNumber(strategy.customExitPeriod, 50),
      threshold: parseNumber(strategy.customExitThreshold, 70),
    },
  };
}

function buildEquityChart(results: BacktestResult[]) {
  if (results.length === 0) {
    return null;
  }

  const width = 760;
  const height = 300;
  const padding = 28;
  const palette = ["#2563eb", "#16a34a"];
  const allEquities = results.flatMap((result) => result.equityCurve.map((point) => point.equity));
  const minEquity = Math.min(...allEquities);
  const maxEquity = Math.max(...allEquities);
  const span = maxEquity - minEquity || 1;
  const longestCurve = results.reduce(
    (longest, result) => Math.max(longest, result.equityCurve.length),
    1,
  );

  const paths: EquityChartPath[] = results.map((result, resultIndex) => {
    const pointStep = longestCurve <= 1 ? 0 : (width - padding * 2) / (longestCurve - 1);
    const coordinates = result.equityCurve.map((point, pointIndex) => {
      const x = padding + pointIndex * pointStep;
      const y = height - padding - ((point.equity - minEquity) / span) * (height - padding * 2);
      return { x, y, value: point.equity };
    });
    const path = coordinates
      .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
    const endCoordinate = coordinates[coordinates.length - 1] ?? {
      x: width - padding,
      y: height - padding,
      value: result.metrics.endingEquity,
    };

    return {
      id: result.strategy.id,
      name: result.strategy.name,
      path,
      color: palette[resultIndex % palette.length],
      endLabel: {
        pointX: endCoordinate.x,
        pointY: endCoordinate.y,
        x: endCoordinate.x - 8,
        y: clampChartLabelY(endCoordinate.y - 10 + resultIndex * 16, height),
        value: endCoordinate.value,
      },
    };
  });

  return {
    width,
    height,
    padding,
    paths,
    minEquity,
    maxEquity,
  };
}

function strategyAccent(result: BacktestResult) {
  if (result.metrics.totalReturnPercent >= result.metrics.benchmarkReturnPercent) {
    return "green" as const;
  }
  if (result.metrics.totalReturnPercent < 0) {
    return "red" as const;
  }
  return "gold" as const;
}

export function BacktestingDashboard({ user }: { user: UserData }) {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [range, setRange] = useState("10y");
  const [initialCapital, setInitialCapital] = useState("100000");
  const [commissionPerTrade, setCommissionPerTrade] = useState("0");
  const [slippageBps, setSlippageBps] = useState("5");
  const [strategies, setStrategies] = useState<StrategyFormState[]>(initialStrategies);
  const [result, setResult] = useState<BacktestResponsePayload | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [isPending, startTransition] = useTransition();

  const normalizedSymbol = symbol.trim().toUpperCase() || DEFAULT_SYMBOL;
  const bestResult = useMemo(() => {
    if (!result?.results.length) {
      return null;
    }

    return result.results.reduce((best, candidate) =>
      candidate.metrics.totalReturnPercent > best.metrics.totalReturnPercent ? candidate : best,
    );
  }, [result]);
  const equityChart = useMemo(() => (result ? buildEquityChart(result.results) : null), [result]);
  const recentTrades = useMemo(() => {
    if (!result) {
      return [];
    }

    return result.results
      .flatMap((strategyResult) =>
        strategyResult.trades.slice(-8).map((trade) => ({
          ...trade,
          strategyName: strategyResult.strategy.name,
        })),
      )
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 10);
  }, [result]);

  function updateStrategy(index: number, patch: Partial<StrategyFormState>) {
    setStrategies((current) =>
      current.map((strategy, strategyIndex) => (strategyIndex === index ? { ...strategy, ...patch } : strategy)),
    );
  }

  function resetStrategies() {
    setStrategies(initialStrategies);
    setResult(null);
    setMessage("");
    setMessageTone("info");
  }

  async function runBacktest() {
    setMessage("");
    setMessageTone("info");

    if (!normalizedSymbol) {
      setMessage("Enter a Yahoo Finance stock symbol.");
      setMessageTone("error");
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/backtests", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              symbol: normalizedSymbol,
              range,
              initialCapital: parseNumber(initialCapital, 100_000),
              commissionPerTrade: parseNumber(commissionPerTrade, 0),
              slippageBps: parseNumber(slippageBps, 5),
              strategies: strategies.map(buildStrategyPayload),
            }),
          });

          const payload = (await response.json()) as BacktestResponsePayload & { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to run backtest.");
          }

          setResult(payload);
          setMessageTone("info");
          setMessage(
            `Backtested ${payload.symbol} from ${formatDate(payload.startDate)} to ${formatDate(
              payload.endDate,
            )} using ${payload.pointsCount} Yahoo Finance daily bars.`,
          );
        } catch (error) {
          const nextMessage = error instanceof Error ? error.message : "Unable to run backtest.";
          setMessage(nextMessage);
          setMessageTone("error");
        }
      })();
    });
  }

  function renderStrategyFields(strategy: StrategyFormState, index: number) {
    return (
      <article key={strategy.id} className="strategy-builder-card">
        <div className="strategy-card-header">
          <div>
            <p className="eyebrow">Strategy {index + 1}</p>
            <strong>{strategy.name || `Strategy ${index + 1}`}</strong>
          </div>
          <span className="status-badge">{strategyTypeLabels[strategy.type]}</span>
        </div>

        <label>
          Strategy Name
          <input
            type="text"
            value={strategy.name}
            onChange={(event) => updateStrategy(index, { name: event.target.value })}
          />
        </label>

        <label>
          Strategy Type
          <select
            value={strategy.type}
            onChange={(event) =>
              updateStrategy(index, {
                type: event.target.value as BacktestStrategyType,
              })
            }
          >
            {Object.entries(strategyTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {strategy.type === "sma-cross" ? (
          <div className="strategy-control-grid">
            <label>
              Fast SMA
              <input
                type="number"
                min="2"
                max="120"
                value={strategy.fastWindow}
                onChange={(event) => updateStrategy(index, { fastWindow: event.target.value })}
              />
            </label>
            <label>
              Slow SMA
              <input
                type="number"
                min="3"
                max="260"
                value={strategy.slowWindow}
                onChange={(event) => updateStrategy(index, { slowWindow: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        {strategy.type === "rsi-reversion" ? (
          <div className="strategy-control-grid">
            <label>
              RSI Period
              <input
                type="number"
                min="2"
                max="80"
                value={strategy.rsiPeriod}
                onChange={(event) => updateStrategy(index, { rsiPeriod: event.target.value })}
              />
            </label>
            <label>
              Buy Below
              <input
                type="number"
                min="1"
                max="60"
                value={strategy.rsiBuyBelow}
                onChange={(event) => updateStrategy(index, { rsiBuyBelow: event.target.value })}
              />
            </label>
            <label>
              Sell Above
              <input
                type="number"
                min="40"
                max="99"
                value={strategy.rsiSellAbove}
                onChange={(event) => updateStrategy(index, { rsiSellAbove: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        {strategy.type === "breakout" ? (
          <div className="strategy-control-grid">
            <label>
              Entry High
              <input
                type="number"
                min="5"
                max="260"
                value={strategy.breakoutWindow}
                onChange={(event) => updateStrategy(index, { breakoutWindow: event.target.value })}
              />
            </label>
            <label>
              Exit Low
              <input
                type="number"
                min="2"
                max="180"
                value={strategy.exitWindow}
                onChange={(event) => updateStrategy(index, { exitWindow: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        {strategy.type === "custom-rules" ? (
          <div className="custom-rule-grid">
            <label>
              Entry Rule
              <select
                value={strategy.customEntryKind}
                onChange={(event) =>
                  updateStrategy(index, {
                    customEntryKind: event.target.value as CustomRuleKind,
                  })
                }
              >
                {Object.entries(customRuleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Entry Period
              <input
                type="number"
                min="2"
                max="260"
                value={strategy.customEntryPeriod}
                onChange={(event) => updateStrategy(index, { customEntryPeriod: event.target.value })}
              />
            </label>
            <label>
              Entry Threshold
              <input
                type="number"
                min="1"
                max="99"
                value={strategy.customEntryThreshold}
                onChange={(event) => updateStrategy(index, { customEntryThreshold: event.target.value })}
              />
            </label>
            <label>
              Exit Rule
              <select
                value={strategy.customExitKind}
                onChange={(event) =>
                  updateStrategy(index, {
                    customExitKind: event.target.value as CustomRuleKind,
                  })
                }
              >
                {Object.entries(customRuleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Exit Period
              <input
                type="number"
                min="2"
                max="260"
                value={strategy.customExitPeriod}
                onChange={(event) => updateStrategy(index, { customExitPeriod: event.target.value })}
              />
            </label>
            <label>
              Exit Threshold
              <input
                type="number"
                min="1"
                max="99"
                value={strategy.customExitThreshold}
                onChange={(event) => updateStrategy(index, { customExitThreshold: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        <div className="strategy-control-grid">
          <label>
            Stop Loss %
            <input
              type="number"
              min="0"
              max="90"
              step="0.5"
              value={strategy.stopLossPercent}
              onChange={(event) => updateStrategy(index, { stopLossPercent: event.target.value })}
            />
          </label>
          <label>
            Take Profit %
            <input
              type="number"
              min="0"
              max="500"
              step="0.5"
              value={strategy.takeProfitPercent}
              onChange={(event) => updateStrategy(index, { takeProfitPercent: event.target.value })}
            />
          </label>
        </div>
      </article>
    );
  }

  return (
    <main className="page-shell terminal-shell">
      <section className="hero hero-terminal">
        <div>
          <p className="kicker">Backtesting Engine</p>
          <h1>Compare trading strategies against long-range history.</h1>
          <p className="hero-copy">
            Compare trend, mean-reversion, breakout, or custom rule sets against buy-and-hold with slippage,
            commissions, drawdown, Sharpe, win rate, and trade-level diagnostics.
          </p>
        </div>

        <div className="hero-panel">
          <div>
            <span className="panel-label">Symbol</span>
            <strong>{result?.symbol ?? normalizedSymbol}</strong>
          </div>
          <div>
            <span className="panel-label">Best Strategy</span>
            <strong>{bestResult?.strategy.name ?? "Not run"}</strong>
          </div>
          <div>
            <span className="panel-label">Benchmark</span>
            <strong>{result ? formatSignedPercent(result.benchmarkReturnPercent) : "Pending"}</strong>
          </div>
          <div>
            <span className="panel-label">User</span>
            <strong>{user.email ?? user.name ?? "User"}</strong>
          </div>
        </div>
      </section>

      <section className="layout-grid backtest-layout">
        <aside className="control-panel backtest-control-panel">
          <div className="panel-heading">
            <p className="kicker">Market Setup</p>
            <h2>Backtest controls</h2>
          </div>

          <label>
            Yahoo Symbol
            <input
              type="text"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              placeholder="AAPL, MSFT, RELIANCE.NS"
            />
          </label>

          <div className="strategy-control-grid">
            <label>
              Data Range
              <select value={range} onChange={(event) => setRange(event.target.value)}>
                <option value="3y">3 Years</option>
                <option value="5y">5 Years</option>
                <option value="10y">10 Years</option>
                <option value="max">Max Available</option>
              </select>
            </label>
            <label>
              Initial Capital
              <input
                type="number"
                min="100"
                step="1000"
                value={initialCapital}
                onChange={(event) => setInitialCapital(event.target.value)}
              />
            </label>
            <label>
              Commission
              <input
                type="number"
                min="0"
                step="0.01"
                value={commissionPerTrade}
                onChange={(event) => setCommissionPerTrade(event.target.value)}
              />
            </label>
            <label>
              Slippage BPS
              <input
                type="number"
                min="0"
                max="1000"
                step="1"
                value={slippageBps}
                onChange={(event) => setSlippageBps(event.target.value)}
              />
            </label>
          </div>

          <div className="action-row">
            <button type="button" onClick={runBacktest} disabled={isPending}>
              {isPending ? "Testing..." : "Run Backtest"}
            </button>
            <button type="button" className="ghost-button" onClick={resetStrategies} disabled={isPending}>
              Reset
            </button>
          </div>

          {message ? <p className={`feedback${messageTone === "error" ? " error" : ""}`}>{message}</p> : null}

          <div className="sidebar-divider" />

          <div className="panel-heading panel-heading-compact">
            <p className="kicker">Strategy Builder</p>
            <h2>Create two strategies</h2>
          </div>

          <div className="strategy-builder-stack">{strategies.map(renderStrategyFields)}</div>
        </aside>

        <div className="content-stack">
          {result ? (
            <>
              <section className="metrics-grid backtest-metrics-grid">
                {result.results.map((strategyResult) => (
                  <MetricCard
                    key={strategyResult.strategy.id}
                    label={strategyResult.strategy.name}
                    value={formatSignedPercent(strategyResult.metrics.totalReturnPercent)}
                    note={`${formatCurrency(strategyResult.metrics.endingEquity, result.currency)} ending equity`}
                    accent={strategyAccent(strategyResult)}
                  />
                ))}
                <MetricCard
                  label="Buy and Hold"
                  value={formatSignedPercent(result.benchmarkReturnPercent)}
                  note={`${formatDate(result.startDate)} to ${formatDate(result.endDate)}`}
                  accent="gold"
                />
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <p className="kicker">Equity Curve</p>
                  <h2>Strategy balance over time</h2>
                </div>

                {equityChart ? (
                  <>
                    <div className="chart-shell equity-chart-shell">
                      <svg className="history-chart" viewBox={`0 0 ${equityChart.width} ${equityChart.height}`} role="img">
                        <title>Backtested strategy equity curves</title>
                        <line
                          className="chart-grid-line"
                          x1={equityChart.padding}
                          x2={equityChart.width - equityChart.padding}
                          y1={equityChart.padding}
                          y2={equityChart.padding}
                        />
                        <line
                          className="chart-grid-line"
                          x1={equityChart.padding}
                          x2={equityChart.width - equityChart.padding}
                          y1={equityChart.height - equityChart.padding}
                          y2={equityChart.height - equityChart.padding}
                        />
                        <text x={equityChart.padding} y={equityChart.padding - 6} className="chart-axis-label">
                          High {formatCurrency(equityChart.maxEquity, result.currency)}
                        </text>
                        <text
                          x={equityChart.padding}
                          y={equityChart.height - equityChart.padding - 6}
                          className="chart-axis-label"
                        >
                          Low {formatCurrency(equityChart.minEquity, result.currency)}
                        </text>
                        {equityChart.paths.map((path) => (
                          <path
                            key={path.id}
                            d={path.path}
                            fill="none"
                            stroke={path.color}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ))}
                        {equityChart.paths.map((path) => (
                          <g key={`${path.id}-value`}>
                            <circle cx={path.endLabel.pointX} cy={path.endLabel.pointY} r="4" fill={path.color} />
                            <text
                              x={path.endLabel.x}
                              y={path.endLabel.y}
                              className="chart-value-label"
                              textAnchor="end"
                            >
                              {formatCurrency(path.endLabel.value, result.currency)}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                    <div className="chart-caption">
                      <span>{formatCurrency(equityChart.minEquity, result.currency)}</span>
                      <span>{formatCurrency(equityChart.maxEquity, result.currency)}</span>
                    </div>
                    <div className="equity-legend">
                      {equityChart.paths.map((path) => (
                        <span key={path.id}>
                          <i style={{ background: path.color }} />
                          {path.name}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="empty-state">Run a backtest to render strategy equity curves.</p>
                )}
              </section>

              <section className="strategy-result-grid">
                {result.results.map((strategyResult) => (
                  <article key={strategyResult.strategy.id} className="panel strategy-result-card">
                    <div className="panel-heading">
                      <p className="kicker">{strategyTypeLabels[strategyResult.strategy.type]}</p>
                      <h2>{strategyResult.strategy.name}</h2>
                    </div>

                    <div className="strategy-stat-grid">
                      <MetricCard
                        label="Annualized"
                        value={formatSignedPercent(strategyResult.metrics.annualizedReturnPercent)}
                        accent={strategyAccent(strategyResult)}
                      />
                      <MetricCard
                        label="Max Drawdown"
                        value={formatDrawdown(strategyResult.metrics.maxDrawdownPercent)}
                        accent="red"
                      />
                      <MetricCard
                        label="Sharpe"
                        value={
                          strategyResult.metrics.sharpeRatio === null
                            ? "N/A"
                            : formatNumber(strategyResult.metrics.sharpeRatio, 2)
                        }
                      />
                      <MetricCard
                        label="Win Rate"
                        value={`${strategyResult.metrics.winRatePercent.toFixed(1)}%`}
                        note={`${strategyResult.metrics.tradesCount} closed trades`}
                        accent="gold"
                      />
                      <MetricCard
                        label="Profit Factor"
                        value={
                          strategyResult.metrics.profitFactor === null
                            ? "N/A"
                            : formatNumber(strategyResult.metrics.profitFactor, 2)
                        }
                      />
                      <MetricCard
                        label="Exposure"
                        value={`${strategyResult.metrics.timeInMarketPercent.toFixed(1)}%`}
                      />
                    </div>

                    {strategyResult.notes.length > 0 ? (
                      <ul className="risk-list strategy-note-list">
                        {strategyResult.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="empty-state">No immediate warnings from this run.</p>
                    )}
                  </article>
                ))}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <p className="kicker">Trades</p>
                  <h2>Recent executions</h2>
                </div>

                {recentTrades.length === 0 ? (
                  <p className="empty-state">No strategy fired a trade in this sample.</p>
                ) : (
                  <div className="trade-table">
                    <div className="trade-table-row trade-table-head">
                      <span>Strategy</span>
                      <span>Date</span>
                      <span>Side</span>
                      <span>Price</span>
                      <span>P/L</span>
                    </div>
                    {recentTrades.map((trade) => (
                      <div key={`${trade.strategyName}-${trade.id}`} className="trade-table-row">
                        <span>{trade.strategyName}</span>
                        <span>{formatDate(trade.date)}</span>
                        <span className={trade.side === "buy" ? "performance-neutral" : "performance-green"}>
                          {trade.side.toUpperCase()}
                        </span>
                        <span>{formatCurrency(trade.price, result.currency)}</span>
                        <span
                          className={
                            trade.pnl === null
                              ? "performance-neutral"
                              : trade.pnl >= 0
                                ? "performance-green"
                                : "performance-red"
                          }
                        >
                          {trade.pnl === null ? "Open" : formatCurrency(trade.pnl, result.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <p className="kicker">Next Additions</p>
                  <h2>Make strategy testing stronger</h2>
                </div>
                <div className="suggestion-grid">
                  {result.suggestions.map((suggestion) => (
                    <article key={suggestion} className="risk-block">
                      <p>{suggestion}</p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="panel">
              <div className="panel-heading">
                <p className="kicker">Ready</p>
                <h2>Run the first strategy comparison</h2>
              </div>
              <p className="empty-state">
                Choose a Yahoo Finance symbol, edit the two strategy tickets, then run a long-range daily
                backtest. Results will include buy-and-hold comparison, equity curves, risk metrics, trade
                diagnostics, and suggested upgrades.
              </p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
