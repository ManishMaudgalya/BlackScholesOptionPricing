import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  BACKTESTING_IMPROVEMENT_SUGGESTIONS,
  runBacktestPair,
} from "@/lib/backtesting/engine";
import type {
  BacktestRequestPayload,
  BacktestResponsePayload,
  BacktestStrategyInput,
  CustomRuleInput,
  CustomRuleKind,
} from "@/lib/backtesting/types";
import { fetchYahooHistoricalData } from "@/lib/services/yahoo-finance";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_SYMBOL = "AAPL";
const DEFAULT_RANGE = "10y";
const SUPPORTED_RANGES = new Set(["3y", "5y", "10y", "max"]);
const SUPPORTED_RULE_KINDS = new Set<CustomRuleKind>([
  "price-above-sma",
  "price-below-sma",
  "rsi-below",
  "rsi-above",
]);

function normalizeSymbol(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : DEFAULT_SYMBOL;
}

function normalizeRange(value: unknown) {
  return typeof value === "string" && SUPPORTED_RANGES.has(value) ? value : DEFAULT_RANGE;
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeCustomRule(value: unknown, fallbackKind: CustomRuleKind): CustomRuleInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      kind: fallbackKind,
    };
  }

  const record = value as Record<string, unknown>;
  return {
    kind:
      typeof record.kind === "string" && SUPPORTED_RULE_KINDS.has(record.kind as CustomRuleKind)
        ? (record.kind as CustomRuleKind)
        : fallbackKind,
    period: normalizeNumber(record.period, 50),
    threshold: normalizeNumber(record.threshold, fallbackKind === "rsi-below" ? 30 : 70),
  };
}

function normalizeStrategy(value: unknown, index: number): BacktestStrategyInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      id: `strategy-${index + 1}`,
      name: `Strategy ${index + 1}`,
      type: index === 0 ? "sma-cross" : "breakout",
    };
  }

  const record = value as Record<string, unknown>;
  return {
    id: normalizeString(record.id, `strategy-${index + 1}`),
    name: normalizeString(record.name, `Strategy ${index + 1}`),
    type: normalizeString(record.type, index === 0 ? "sma-cross" : "breakout") as BacktestStrategyInput["type"],
    fastWindow: normalizeNumber(record.fastWindow, index === 0 ? 20 : 50),
    slowWindow: normalizeNumber(record.slowWindow, index === 0 ? 50 : 200),
    rsiPeriod: normalizeNumber(record.rsiPeriod, 14),
    rsiBuyBelow: normalizeNumber(record.rsiBuyBelow, 30),
    rsiSellAbove: normalizeNumber(record.rsiSellAbove, 60),
    breakoutWindow: normalizeNumber(record.breakoutWindow, 55),
    exitWindow: normalizeNumber(record.exitWindow, 20),
    stopLossPercent: normalizeNumber(record.stopLossPercent, 0),
    takeProfitPercent: normalizeNumber(record.takeProfitPercent, 0),
    customEntry: normalizeCustomRule(record.customEntry, "price-above-sma"),
    customExit: normalizeCustomRule(record.customExit, "price-below-sma"),
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const body = (payload ?? {}) as BacktestRequestPayload;
  const rawStrategies = Array.isArray(body.strategies) ? body.strategies : [];
  const strategies = rawStrategies.slice(0, 2).map((strategy, index) => normalizeStrategy(strategy, index));

  if (strategies.length !== 2) {
    return NextResponse.json({ error: "Exactly two strategies are required for comparison." }, { status: 400 });
  }

  const symbol = normalizeSymbol(body.symbol);
  const range = normalizeRange(body.range);
  const interval = "1d";
  const initialCapital = normalizeNumber(body.initialCapital, 100_000);
  const commissionPerTrade = normalizeNumber(body.commissionPerTrade, 0);
  const slippageBps = normalizeNumber(body.slippageBps, 5);

  try {
    const snapshot = await fetchYahooHistoricalData(symbol, {
      range,
      interval,
    });
    const results = runBacktestPair({
      symbol: snapshot.symbol,
      points: snapshot.points,
      strategies,
      initialCapital,
      commissionPerTrade,
      slippageBps,
    });

    const response: BacktestResponsePayload = {
      symbol: snapshot.symbol,
      shortName: snapshot.shortName,
      currency: snapshot.currency,
      range: snapshot.range,
      interval: snapshot.interval,
      source: "yahoo-finance",
      fetchedAt: snapshot.fetchedAt,
      startDate: snapshot.points[0].date,
      endDate: snapshot.points[snapshot.points.length - 1].date,
      pointsCount: snapshot.points.length,
      initialCapital,
      commissionPerTrade,
      slippageBps,
      benchmarkReturnPercent: results[0]?.metrics.benchmarkReturnPercent ?? 0,
      results,
      suggestions: BACKTESTING_IMPROVEMENT_SUGGESTIONS,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backtest failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
