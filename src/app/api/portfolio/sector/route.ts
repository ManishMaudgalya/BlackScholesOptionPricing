import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MarketDataSnapshotModel } from "@/lib/db/models/market-data-snapshot";
import { PortfolioPositionModel } from "@/lib/db/models/portfolio-position";
import { connectToDatabase } from "@/lib/db/mongodb";
import { pullLatestMarketDataSnapshot } from "@/lib/engines/market-data-engine";
import { getPortfolioSectorModel } from "@/lib/portfolio/sector-presets";
import { creditPortfolioCash, debitPortfolioCash, ensurePortfolioAccount, loadPortfolioForUser } from "@/lib/portfolio/store";
import { fetchFxSeries } from "@/lib/services/currency-engine";
import type { StoredMarketDataSnapshot } from "@/lib/services/market-data";

export const runtime = "nodejs";
export const maxDuration = 300;

type CreateSectorPortfolioBody = {
  sector?: unknown;
  budget?: unknown;
};

function normalizeSector(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeBudget(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Sector budget must be greater than zero.");
  }
  return parsed;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = session.user;
  const authUserId = session.user.id;
  const accountCurrency = "USD";

  try {
    const body = (await request.json()) as CreateSectorPortfolioBody;
    const sector = normalizeSector(body.sector);
    const budget = normalizeBudget(body.budget);
    const sectorModel = getPortfolioSectorModel(sector);

    if (!sectorModel) {
      throw new Error("Select a valid sector basket.");
    }

    await connectToDatabase();
    await ensurePortfolioAccount(authUserId, sessionUser.email);

    const existingSnapshots = await MarketDataSnapshotModel.find({
      authUserId,
      symbol: { $in: sectorModel.symbols },
    }).lean<StoredMarketDataSnapshot[]>();
    const snapshotBySymbol = new Map(existingSnapshots.map((snapshot) => [snapshot.symbol, snapshot] as const));

    const snapshotResults = await Promise.allSettled(
      sectorModel.symbols.map(async (symbol) => {
        const snapshot = await pullLatestMarketDataSnapshot(symbol, { range: "1y", interval: "1d" }, snapshotBySymbol.get(symbol));

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

        return snapshot;
      }),
    );

    const failedSymbols = snapshotResults.flatMap((result, index) =>
      result.status === "rejected" ? [sectorModel.symbols[index]] : [],
    );
    const successfulSnapshots = snapshotResults.flatMap((result) => {
      if (result.status !== "fulfilled") {
        return [];
      }

      const livePrice = result.value.regularMarketPrice ?? result.value.latestClose;
      return livePrice > 0
        ? [
            {
              snapshot: result.value,
              livePrice,
            },
          ]
        : [];
    });

    if (successfulSnapshots.length === 0) {
      throw new Error("Unable to price any symbols in the selected sector basket right now.");
    }

    const allocationPerSymbol = budget / successfulSnapshots.length;
    const fxSeriesEntries = await Promise.all(
      successfulSnapshots.map(async ({ snapshot }) => [snapshot.symbol, await fetchFxSeries(snapshot.currency, accountCurrency, { range: "1y", interval: "1d" })] as const),
    );
    const fxSeriesBySymbol = new Map(fxSeriesEntries);
    const positionsToCreate = successfulSnapshots
      .map(({ snapshot, livePrice }) => {
        const fxSeries = fxSeriesBySymbol.get(snapshot.symbol);
        const fxRate = fxSeries?.latestRate ?? 1;
        const quantity = Number((allocationPerSymbol / (livePrice * fxRate)).toFixed(6));
        const costBasisBase = quantity * livePrice * fxRate;
        return quantity > 0
          ? {
              authUserId,
              userEmail: sessionUser.email ?? "",
              symbol: snapshot.symbol,
              quantity,
              purchasePrice: livePrice,
              purchaseCurrency: snapshot.currency,
              purchaseFxRate: fxRate,
              costBasisBase,
            }
          : null;
      })
      .filter((position): position is NonNullable<typeof position> => position !== null);

    if (positionsToCreate.length === 0) {
      throw new Error("The selected budget is too small to build the requested sector basket.");
    }

    const spentCash = positionsToCreate.reduce((sum, position) => sum + position.costBasisBase, 0);
    await debitPortfolioCash(authUserId, spentCash);

    try {
      await PortfolioPositionModel.insertMany(positionsToCreate, { ordered: true });
    } catch (error) {
      await creditPortfolioCash(authUserId, spentCash);
      throw error;
    }

    const portfolio = await loadPortfolioForUser(authUserId, sessionUser.email);
    return NextResponse.json(
      {
        portfolio,
        spentCash,
        failedSymbols,
        purchasedSymbols: positionsToCreate.map((position) => position.symbol),
        sectorLabel: sectorModel.label,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build the sector portfolio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
