import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MarketDataSnapshotModel } from "@/lib/db/models/market-data-snapshot";
import { PortfolioPositionModel } from "@/lib/db/models/portfolio-position";
import { connectToDatabase } from "@/lib/db/mongodb";
import { buildPortfolio } from "@/lib/portfolio/build-portfolio";
import type { PortfolioPositionRecord, StoredMarketDataSnapshot } from "@/lib/portfolio/types";
import { pullLatestMarketDataSnapshot } from "@/lib/engines/market-data-engine";
import type { StoredMarketDataSnapshot as ServiceStoredMarketDataSnapshot } from "@/lib/services/market-data";

async function loadPortfolioForUser(authUserId: string) {
  const positions = await PortfolioPositionModel.find({ authUserId })
    .sort({ createdAt: -1 })
    .lean<PortfolioPositionRecord[]>();
  const symbols = Array.from(new Set(positions.map((position) => position.symbol)));
  const snapshots =
    symbols.length === 0
      ? []
      : await MarketDataSnapshotModel.find({
          authUserId,
          symbol: { $in: symbols },
        }).lean<StoredMarketDataSnapshot[]>();

  return buildPortfolio(positions, snapshots);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUserId = session.user.id;

  try {
    await connectToDatabase();
    const symbols = await PortfolioPositionModel.find({ authUserId }).distinct("symbol");
    const existingSnapshots =
      symbols.length === 0
        ? []
        : await MarketDataSnapshotModel.find({
            authUserId,
            symbol: { $in: symbols },
          }).lean<ServiceStoredMarketDataSnapshot[]>();
    const snapshotBySymbol = new Map(existingSnapshots.map((snapshot) => [snapshot.symbol, snapshot] as const));

    if (symbols.length === 0) {
      return NextResponse.json({
        portfolio: await loadPortfolioForUser(authUserId),
        refreshedCount: 0,
        failedSymbols: [],
      });
    }

    const refreshResults = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const existingSnapshot = snapshotBySymbol.get(symbol) ?? null;
        const snapshot = await pullLatestMarketDataSnapshot(symbol, {}, existingSnapshot);

        await MarketDataSnapshotModel.findOneAndUpdate(
          {
            authUserId,
            symbol: snapshot.symbol,
          },
          {
            authUserId,
            ...snapshot,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );
        return symbol;
      }),
    );

    const failedSymbols = refreshResults.flatMap((result, index) =>
      result.status === "rejected" ? [symbols[index]] : [],
    );

    return NextResponse.json({
      portfolio: await loadPortfolioForUser(authUserId),
      refreshedCount: refreshResults.length - failedSymbols.length,
      failedSymbols,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh portfolio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
