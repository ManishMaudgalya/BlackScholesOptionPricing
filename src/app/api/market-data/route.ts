import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MarketDataSnapshotModel } from "@/lib/db/models/market-data-snapshot";
import { fetchYahooHistoricalData } from "@/lib/services/yahoo-finance";

const DEFAULT_SYMBOL = "AAPL";

function normalizeSymbol(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const symbol = normalizeSymbol(url.searchParams.get("symbol")) || DEFAULT_SYMBOL;

  try {
    await connectToDatabase();
    const snapshot = await MarketDataSnapshotModel.findOne({
      authUserId: session.user.id,
      symbol,
    })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load market data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

  const body = (payload ?? {}) as {
    symbol?: unknown;
    range?: unknown;
    interval?: unknown;
  };

  const symbol = normalizeSymbol(body.symbol) || DEFAULT_SYMBOL;
  const range = typeof body.range === "string" && body.range.trim() ? body.range.trim() : "1y";
  const interval = typeof body.interval === "string" && body.interval.trim() ? body.interval.trim() : "1d";

  try {
    const snapshot = await fetchYahooHistoricalData(symbol, { range, interval });
    await connectToDatabase();

    const savedSnapshot = await MarketDataSnapshotModel.findOneAndUpdate(
      {
        authUserId: session.user.id,
        symbol: snapshot.symbol,
      },
      {
        authUserId: session.user.id,
        ...snapshot,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    ).lean();

    return NextResponse.json({ snapshot: savedSnapshot }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh market data.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
