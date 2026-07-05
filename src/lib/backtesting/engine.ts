import type {
  BacktestResult,
  BacktestRunInput,
  BacktestStrategyInput,
  BacktestStrategyType,
  BacktestTrade,
  CustomRuleInput,
  CustomRuleKind,
  EquityPoint,
} from "@/lib/backtesting/types";
import type { HistoricalPoint } from "@/lib/services/market-data";

const TRADING_DAYS_PER_YEAR = 252;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

const STRATEGY_TYPES: BacktestStrategyType[] = ["sma-cross", "rsi-reversion", "breakout", "custom-rules"];
const CUSTOM_RULE_KINDS: CustomRuleKind[] = ["price-above-sma", "price-below-sma", "rsi-below", "rsi-above"];

export const BACKTESTING_IMPROVEMENT_SUGGESTIONS = [
  "Add walk-forward testing so optimized parameters are validated on unseen date ranges.",
  "Add parameter heatmaps for fast/slow averages, RSI thresholds, and breakout windows.",
  "Add dividend-adjusted return handling, tax lots, borrow fees, and short-selling support.",
  "Add position sizing models such as fixed fractional risk, volatility targeting, and Kelly caps.",
  "Add Monte Carlo resampling and benchmark overlays for SPY, sector ETFs, and buy-and-hold.",
  "Add a strategy library with saved templates, tags, and exportable trade journals.",
];

type PreparedStrategy = Required<
  Pick<
    BacktestStrategyInput,
    | "id"
    | "name"
    | "type"
    | "fastWindow"
    | "slowWindow"
    | "rsiPeriod"
    | "rsiBuyBelow"
    | "rsiSellAbove"
    | "breakoutWindow"
    | "exitWindow"
    | "stopLossPercent"
    | "takeProfitPercent"
  >
> & {
  customEntry: Required<CustomRuleInput>;
  customExit: Required<CustomRuleInput>;
};

type SignalDecision = {
  active: boolean;
  reason: string;
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  return Math.round(clampNumber(value, min, max, fallback));
}

function normalizeStrategyType(value: unknown): BacktestStrategyType {
  return typeof value === "string" && STRATEGY_TYPES.includes(value as BacktestStrategyType)
    ? (value as BacktestStrategyType)
    : "sma-cross";
}

function normalizeCustomRuleKind(value: unknown, fallback: CustomRuleKind): CustomRuleKind {
  return typeof value === "string" && CUSTOM_RULE_KINDS.includes(value as CustomRuleKind)
    ? (value as CustomRuleKind)
    : fallback;
}

function prepareCustomRule(rule: CustomRuleInput | undefined, fallback: Required<CustomRuleInput>) {
  const nextRule = rule ?? {};

  return {
    kind: normalizeCustomRuleKind(nextRule.kind, fallback.kind),
    period: clampInteger(nextRule.period, 2, 260, fallback.period),
    threshold: clampNumber(nextRule.threshold, 1, 99, fallback.threshold),
  };
}

function prepareStrategy(input: BacktestStrategyInput, index: number): PreparedStrategy {
  const type = normalizeStrategyType(input.type);
  const fastWindow = clampInteger(input.fastWindow, 2, 120, index === 0 ? 20 : 50);
  const slowWindow = Math.max(
    fastWindow + 1,
    clampInteger(input.slowWindow, fastWindow + 1, 260, index === 0 ? 50 : 200),
  );

  return {
    ...input,
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : `strategy-${index + 1}`,
    name:
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim().slice(0, 80)
        : `Strategy ${index + 1}`,
    type,
    fastWindow,
    slowWindow,
    rsiPeriod: clampInteger(input.rsiPeriod, 2, 80, 14),
    rsiBuyBelow: clampNumber(input.rsiBuyBelow, 1, 60, 30),
    rsiSellAbove: clampNumber(input.rsiSellAbove, 40, 99, 60),
    breakoutWindow: clampInteger(input.breakoutWindow, 5, 260, 55),
    exitWindow: clampInteger(input.exitWindow, 2, 180, 20),
    stopLossPercent: clampNumber(input.stopLossPercent, 0, 90, 0),
    takeProfitPercent: clampNumber(input.takeProfitPercent, 0, 500, 0),
    customEntry: prepareCustomRule(input.customEntry, {
      kind: "price-above-sma",
      period: 50,
      threshold: 30,
    }),
    customExit: prepareCustomRule(input.customExit, {
      kind: "price-below-sma",
      period: 50,
      threshold: 70,
    }),
  };
}

function normalizePoints(points: HistoricalPoint[]) {
  return points
    .filter(
      (point) =>
        Number.isFinite(point.open) &&
        Number.isFinite(point.high) &&
        Number.isFinite(point.low) &&
        Number.isFinite(point.close) &&
        Date.parse(point.date),
    )
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function simpleMovingAverage(points: HistoricalPoint[], endIndex: number, window: number) {
  const startIndex = endIndex - window + 1;
  if (startIndex < 0) {
    return null;
  }

  let total = 0;
  for (let index = startIndex; index <= endIndex; index += 1) {
    total += points[index].close;
  }
  return total / window;
}

function relativeStrengthIndex(points: HistoricalPoint[], endIndex: number, period: number) {
  if (endIndex - period < 0) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let index = endIndex - period + 1; index <= endIndex; index += 1) {
    const change = points[index].close - points[index - 1].close;
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;

  if (averageLoss === 0) {
    return averageGain === 0 ? 50 : 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function rollingHigh(points: HistoricalPoint[], endIndex: number, window: number) {
  const startIndex = endIndex - window + 1;
  if (startIndex < 0) {
    return null;
  }

  let high = Number.NEGATIVE_INFINITY;
  for (let index = startIndex; index <= endIndex; index += 1) {
    high = Math.max(high, points[index].high);
  }
  return high;
}

function rollingLow(points: HistoricalPoint[], endIndex: number, window: number) {
  const startIndex = endIndex - window + 1;
  if (startIndex < 0) {
    return null;
  }

  let low = Number.POSITIVE_INFINITY;
  for (let index = startIndex; index <= endIndex; index += 1) {
    low = Math.min(low, points[index].low);
  }
  return low;
}

function evaluateCustomRule(rule: Required<CustomRuleInput>, points: HistoricalPoint[], signalIndex: number) {
  const signalPoint = points[signalIndex];

  switch (rule.kind) {
    case "price-above-sma": {
      const average = simpleMovingAverage(points, signalIndex, rule.period);
      return average === null ? false : signalPoint.close > average;
    }
    case "price-below-sma": {
      const average = simpleMovingAverage(points, signalIndex, rule.period);
      return average === null ? false : signalPoint.close < average;
    }
    case "rsi-below": {
      const rsi = relativeStrengthIndex(points, signalIndex, rule.period);
      return rsi === null ? false : rsi < rule.threshold;
    }
    case "rsi-above": {
      const rsi = relativeStrengthIndex(points, signalIndex, rule.period);
      return rsi === null ? false : rsi > rule.threshold;
    }
    default:
      return false;
  }
}

function describeCustomRule(rule: Required<CustomRuleInput>) {
  switch (rule.kind) {
    case "price-above-sma":
      return `close above ${rule.period}D SMA`;
    case "price-below-sma":
      return `close below ${rule.period}D SMA`;
    case "rsi-below":
      return `${rule.period}D RSI below ${rule.threshold.toFixed(0)}`;
    case "rsi-above":
      return `${rule.period}D RSI above ${rule.threshold.toFixed(0)}`;
    default:
      return "custom rule";
  }
}

function shouldEnter(strategy: PreparedStrategy, points: HistoricalPoint[], signalIndex: number): SignalDecision {
  const signalPoint = points[signalIndex];

  switch (strategy.type) {
    case "sma-cross": {
      const previousFast = simpleMovingAverage(points, signalIndex - 1, strategy.fastWindow);
      const previousSlow = simpleMovingAverage(points, signalIndex - 1, strategy.slowWindow);
      const fast = simpleMovingAverage(points, signalIndex, strategy.fastWindow);
      const slow = simpleMovingAverage(points, signalIndex, strategy.slowWindow);
      return {
        active:
          previousFast !== null &&
          previousSlow !== null &&
          fast !== null &&
          slow !== null &&
          previousFast <= previousSlow &&
          fast > slow,
        reason: `${strategy.fastWindow}D SMA crossed above ${strategy.slowWindow}D SMA`,
      };
    }
    case "rsi-reversion": {
      const rsi = relativeStrengthIndex(points, signalIndex, strategy.rsiPeriod);
      return {
        active: rsi !== null && rsi <= strategy.rsiBuyBelow,
        reason: `${strategy.rsiPeriod}D RSI at or below ${strategy.rsiBuyBelow.toFixed(0)}`,
      };
    }
    case "breakout": {
      const priorHigh = rollingHigh(points, signalIndex - 1, strategy.breakoutWindow);
      return {
        active: priorHigh !== null && signalPoint.close > priorHigh,
        reason: `close broke ${strategy.breakoutWindow}D high`,
      };
    }
    case "custom-rules":
      return {
        active: evaluateCustomRule(strategy.customEntry, points, signalIndex),
        reason: describeCustomRule(strategy.customEntry),
      };
    default:
      return { active: false, reason: "no signal" };
  }
}

function shouldExit(
  strategy: PreparedStrategy,
  points: HistoricalPoint[],
  signalIndex: number,
  entryPrice: number,
): SignalDecision {
  const signalPoint = points[signalIndex];

  if (strategy.stopLossPercent && signalPoint.close <= entryPrice * (1 - strategy.stopLossPercent / 100)) {
    return {
      active: true,
      reason: `${strategy.stopLossPercent.toFixed(1)}% stop loss`,
    };
  }

  if (strategy.takeProfitPercent && signalPoint.close >= entryPrice * (1 + strategy.takeProfitPercent / 100)) {
    return {
      active: true,
      reason: `${strategy.takeProfitPercent.toFixed(1)}% take profit`,
    };
  }

  switch (strategy.type) {
    case "sma-cross": {
      const previousFast = simpleMovingAverage(points, signalIndex - 1, strategy.fastWindow);
      const previousSlow = simpleMovingAverage(points, signalIndex - 1, strategy.slowWindow);
      const fast = simpleMovingAverage(points, signalIndex, strategy.fastWindow);
      const slow = simpleMovingAverage(points, signalIndex, strategy.slowWindow);
      return {
        active:
          previousFast !== null &&
          previousSlow !== null &&
          fast !== null &&
          slow !== null &&
          previousFast >= previousSlow &&
          fast < slow,
        reason: `${strategy.fastWindow}D SMA crossed below ${strategy.slowWindow}D SMA`,
      };
    }
    case "rsi-reversion": {
      const rsi = relativeStrengthIndex(points, signalIndex, strategy.rsiPeriod);
      return {
        active: rsi !== null && rsi >= strategy.rsiSellAbove,
        reason: `${strategy.rsiPeriod}D RSI at or above ${strategy.rsiSellAbove.toFixed(0)}`,
      };
    }
    case "breakout": {
      const priorLow = rollingLow(points, signalIndex - 1, strategy.exitWindow);
      return {
        active: priorLow !== null && signalPoint.close < priorLow,
        reason: `close broke ${strategy.exitWindow}D low`,
      };
    }
    case "custom-rules":
      return {
        active: evaluateCustomRule(strategy.customExit, points, signalIndex),
        reason: describeCustomRule(strategy.customExit),
      };
    default:
      return { active: false, reason: "no signal" };
  }
}

function calculateSharpeRatio(equityCurve: EquityPoint[]) {
  const returns = equityCurve
    .slice(1)
    .map((point, index) => point.equity / equityCurve[index].equity - 1)
    .filter((value) => Number.isFinite(value));

  if (returns.length < 2) {
    return null;
  }

  const averageReturn = returns.reduce((total, value) => total + value, 0) / returns.length;
  const variance =
    returns.reduce((total, value) => total + (value - averageReturn) ** 2, 0) / (returns.length - 1);
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation === 0) {
    return null;
  }

  return (averageReturn / standardDeviation) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

function calculateAnnualizedReturn(startDate: string, endDate: string, initialCapital: number, endingEquity: number) {
  const years = Math.max((Date.parse(endDate) - Date.parse(startDate)) / MS_PER_YEAR, 1 / MS_PER_YEAR);
  return ((endingEquity / initialCapital) ** (1 / years) - 1) * 100;
}

function buildNotes(result: BacktestResult, benchmarkReturnPercent: number) {
  const notes: string[] = [];

  if (result.metrics.tradesCount === 0) {
    notes.push("No completed trades fired. Loosen the signal thresholds or shorten the lookback windows.");
  }

  if (result.metrics.totalReturnPercent < benchmarkReturnPercent) {
    notes.push("The strategy underperformed buy-and-hold over this sample.");
  }

  if (result.metrics.maxDrawdownPercent > 30) {
    notes.push("Max drawdown is elevated. Test volatility sizing, stops, or a market-regime filter.");
  }

  if (result.metrics.timeInMarketPercent < 15 && result.metrics.tradesCount < 3) {
    notes.push("The strategy has low exposure and few observations, so the metrics are fragile.");
  }

  return notes;
}

export function runBacktest({
  symbol: _symbol,
  points,
  strategy: rawStrategy,
  initialCapital,
  commissionPerTrade,
  slippageBps,
}: BacktestRunInput): BacktestResult {
  const normalizedPoints = normalizePoints(points);
  if (normalizedPoints.length < 60) {
    throw new Error("At least 60 daily Yahoo Finance bars are required for backtesting.");
  }

  const strategy = prepareStrategy(rawStrategy, 0);
  const startingCash = clampNumber(initialCapital, 100, 100_000_000, 100_000);
  const fee = clampNumber(commissionPerTrade, 0, 10_000, 0);
  const slippageRate = clampNumber(slippageBps, 0, 1_000, 5) / 10_000;

  let cash = startingCash;
  let shares = 0;
  let entryPrice = 0;
  let entryCost = 0;
  let investedDays = 0;
  let tradeCounter = 0;
  let peakEquity = startingCash;

  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [
    {
      date: normalizedPoints[0].date,
      equity: startingCash,
      drawdownPercent: 0,
    },
  ];

  function buy(point: HistoricalPoint, reason: string) {
    if (shares > 0 || cash <= fee) {
      return;
    }

    const executionPrice = point.open * (1 + slippageRate);
    const deployableCash = cash - fee;
    const nextShares = deployableCash / executionPrice;
    if (!Number.isFinite(nextShares) || nextShares <= 0) {
      return;
    }

    shares = nextShares;
    entryPrice = executionPrice;
    entryCost = shares * executionPrice + fee;
    cash = 0;
    tradeCounter += 1;

    trades.push({
      id: `${strategy.id}-${tradeCounter}`,
      side: "buy",
      date: point.date,
      price: executionPrice,
      shares,
      value: shares * executionPrice,
      fee,
      reason,
      pnl: null,
      pnlPercent: null,
    });
  }

  function sell(point: HistoricalPoint, rawPrice: number, reason: string) {
    if (shares <= 0) {
      return;
    }

    const executionPrice = rawPrice * (1 - slippageRate);
    const grossValue = shares * executionPrice;
    const netValue = grossValue - fee;
    const pnl = netValue - entryCost;
    const pnlPercent = entryCost > 0 ? (pnl / entryCost) * 100 : 0;

    cash += netValue;
    tradeCounter += 1;

    trades.push({
      id: `${strategy.id}-${tradeCounter}`,
      side: "sell",
      date: point.date,
      price: executionPrice,
      shares,
      value: grossValue,
      fee,
      reason,
      pnl,
      pnlPercent,
    });

    shares = 0;
    entryPrice = 0;
    entryCost = 0;
  }

  for (let index = 1; index < normalizedPoints.length; index += 1) {
    const currentPoint = normalizedPoints[index];
    const signalIndex = index - 1;

    if (shares > 0) {
      const exitDecision = shouldExit(strategy, normalizedPoints, signalIndex, entryPrice);
      if (exitDecision.active) {
        sell(currentPoint, currentPoint.open, exitDecision.reason);
      }
    }

    if (shares === 0) {
      const entryDecision = shouldEnter(strategy, normalizedPoints, signalIndex);
      if (entryDecision.active) {
        buy(currentPoint, entryDecision.reason);
      }
    }

    if (shares > 0) {
      investedDays += 1;
    }

    const equity = cash + shares * currentPoint.close;
    peakEquity = Math.max(peakEquity, equity);
    const drawdownPercent = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    equityCurve.push({
      date: currentPoint.date,
      equity,
      drawdownPercent,
    });
  }

  if (shares > 0) {
    const lastPoint = normalizedPoints[normalizedPoints.length - 1];
    sell(lastPoint, lastPoint.close, "final liquidation");
    peakEquity = Math.max(peakEquity, cash);
    equityCurve[equityCurve.length - 1] = {
      date: lastPoint.date,
      equity: cash,
      drawdownPercent: peakEquity > 0 ? ((peakEquity - cash) / peakEquity) * 100 : 0,
    };
  }

  const firstPoint = normalizedPoints[0];
  const lastPoint = normalizedPoints[normalizedPoints.length - 1];
  const endingEquity = equityCurve[equityCurve.length - 1].equity;
  const sellTrades = trades.filter((trade) => trade.side === "sell");
  const positivePnl = sellTrades
    .map((trade) => trade.pnl ?? 0)
    .filter((pnl) => pnl > 0)
    .reduce((total, pnl) => total + pnl, 0);
  const negativePnl = sellTrades
    .map((trade) => trade.pnl ?? 0)
    .filter((pnl) => pnl < 0)
    .reduce((total, pnl) => total + Math.abs(pnl), 0);
  const winningTrades = sellTrades.filter((trade) => (trade.pnl ?? 0) > 0).length;
  const benchmarkReturnPercent = ((lastPoint.close - firstPoint.close) / firstPoint.close) * 100;

  const result: BacktestResult = {
    strategy,
    metrics: {
      endingEquity,
      totalReturnPercent: ((endingEquity - startingCash) / startingCash) * 100,
      annualizedReturnPercent: calculateAnnualizedReturn(firstPoint.date, lastPoint.date, startingCash, endingEquity),
      benchmarkReturnPercent,
      maxDrawdownPercent: Math.max(...equityCurve.map((point) => point.drawdownPercent)),
      sharpeRatio: calculateSharpeRatio(equityCurve),
      tradesCount: sellTrades.length,
      winRatePercent: sellTrades.length === 0 ? 0 : (winningTrades / sellTrades.length) * 100,
      profitFactor: negativePnl === 0 ? (positivePnl > 0 ? null : 0) : positivePnl / negativePnl,
      timeInMarketPercent: (investedDays / Math.max(normalizedPoints.length - 1, 1)) * 100,
    },
    equityCurve,
    trades,
    notes: [],
  };

  return {
    ...result,
    notes: buildNotes(result, benchmarkReturnPercent),
  };
}

export function runBacktestPair(input: Omit<BacktestRunInput, "strategy"> & { strategies: BacktestStrategyInput[] }) {
  return input.strategies.map((strategy, index) =>
    runBacktest({
      ...input,
      strategy: {
        ...strategy,
        id: strategy.id || `strategy-${index + 1}`,
        name: strategy.name || `Strategy ${index + 1}`,
      },
    }),
  );
}
