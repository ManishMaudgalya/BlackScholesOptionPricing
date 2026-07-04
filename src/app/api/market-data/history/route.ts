import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MarketDataSnapshotModel } from "@/lib/db/models/market-data-snapshot";
import { pullLatestMarketDataSnapshot } from "@/lib/engines/market-data-engine";
import type { StoredMarketDataSnapshot } from "@/lib/services/market-data";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_SYMBOL = "AAPL";

function normalizeSymbol(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const symbol = normalizeSymbol(url.searchParams.get("symbol")) || DEFAULT_SYMBOL;
  const range = normalizeString(url.searchParams.get("range"), "5y");
  const interval = normalizeString(url.searchParams.get("interval"), "1d");

  try {
    await connectToDatabase();
    const existingSnapshot = await MarketDataSnapshotModel.findOne({
      authUserId: session.user.id,
      symbol,
    })
      .sort({ updatedAt: -1 })
      .lean<StoredMarketDataSnapshot | null>();
    const snapshot = await pullLatestMarketDataSnapshot(symbol, { range, interval }, existingSnapshot);

    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load historical market data.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
