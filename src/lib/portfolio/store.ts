import { MarketDataSnapshotModel } from "@/lib/db/models/market-data-snapshot";
import { PortfolioAccountModel } from "@/lib/db/models/portfolio-account";
import { PortfolioPositionModel } from "@/lib/db/models/portfolio-position";
import { buildPortfolio } from "@/lib/portfolio/build-portfolio";
import type {
  PortfolioAccountRecord,
  PortfolioPositionRecord,
  PortfolioState,
  StoredMarketDataSnapshot,
} from "@/lib/portfolio/types";

export const DEFAULT_PORTFOLIO_STARTING_CASH = 100000;
export const DEFAULT_PORTFOLIO_CURRENCY = "USD";

export async function ensurePortfolioAccount(authUserId: string, userEmail?: string | null) {
  const normalizedUserEmail = typeof userEmail === "string" ? userEmail : "";
  const account = await PortfolioAccountModel.findOneAndUpdate(
    { authUserId },
    {
      $setOnInsert: {
        authUserId,
        ...(normalizedUserEmail ? {} : { userEmail: "" }),
        baseCurrency: DEFAULT_PORTFOLIO_CURRENCY,
        startingCash: DEFAULT_PORTFOLIO_STARTING_CASH,
        cashBalance: DEFAULT_PORTFOLIO_STARTING_CASH,
      },
      ...(normalizedUserEmail ? { $set: { userEmail: normalizedUserEmail } } : {}),
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  ).lean<PortfolioAccountRecord | null>();

  if (!account) {
    throw new Error("Unable to initialize the portfolio account.");
  }

  return account;
}

export async function debitPortfolioCash(authUserId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Trade cost must be greater than zero.");
  }

  const account = await PortfolioAccountModel.findOneAndUpdate(
    {
      authUserId,
      cashBalance: { $gte: amount },
    },
    {
      $inc: { cashBalance: -amount },
    },
    {
      new: true,
    },
  ).lean<PortfolioAccountRecord | null>();

  if (!account) {
    throw new Error("Insufficient cash balance. Reduce the order size or add less capital to the trade.");
  }

  return account;
}

export async function creditPortfolioCash(authUserId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  await PortfolioAccountModel.findOneAndUpdate(
    { authUserId },
    {
      $inc: { cashBalance: amount },
    },
  );
}

export async function loadPortfolioForUser(authUserId: string, userEmail?: string | null): Promise<PortfolioState> {
  const account = await ensurePortfolioAccount(authUserId, userEmail);
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

  return buildPortfolio(positions, snapshots, account);
}
