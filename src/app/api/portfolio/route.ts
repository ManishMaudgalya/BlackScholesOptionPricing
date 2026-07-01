import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { PortfolioPositionModel } from "@/lib/db/models/portfolio-position";
import { MarketDataSnapshotModel } from "@/lib/db/models/market-data-snapshot";
import { connectToDatabase } from "@/lib/db/mongodb";
import { buildPortfolio } from "@/lib/portfolio/build-portfolio";
import type { PortfolioPositionRecord, StoredMarketDataSnapshot } from "@/lib/portfolio/types";
import { pullLatestMarketDataSnapshot } from "@/lib/engines/market-data-engine";
import type { StoredMarketDataSnapshot as ServiceStoredMarketDataSnapshot } from "@/lib/services/market-data";

type CreatePortfolioPositionBody = {
  symbol?: unknown;
  quantity?: unknown;
  purchasePrice?: unknown;
};

function normalizeSymbol(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeNumber(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric field: ${field}`);
  }
  return parsed;
}

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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUserId = session.user.id;

  try {
    await connectToDatabase();
    const portfolio = await loadPortfolioForUser(authUserId);
    return NextResponse.json({ portfolio });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load portfolio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUserId = session.user.id;

  try {
    const body = (await request.json()) as CreatePortfolioPositionBody;
    const symbol = normalizeSymbol(body.symbol);
    if (!symbol) {
      throw new Error("A stock symbol is required.");
    }

    const quantity = normalizeNumber(body.quantity, "quantity");
    const purchasePrice = normalizeNumber(body.purchasePrice, "purchasePrice");

    await connectToDatabase();
    await PortfolioPositionModel.create({
      authUserId,
      userEmail: session.user.email ?? "",
      symbol,
      quantity,
      purchasePrice,
    });

    let refreshError = "";

    try {
      const existingSnapshot = await MarketDataSnapshotModel.findOne({
        authUserId,
        symbol,
      })
        .sort({ updatedAt: -1 })
        .lean<ServiceStoredMarketDataSnapshot | null>();
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
    } catch (error) {
      refreshError = error instanceof Error ? error.message : "Unable to refresh market data for the new holding.";
    }

    const portfolio = await loadPortfolioForUser(authUserId);
    return NextResponse.json({ portfolio, refreshError }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add portfolio holding.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
