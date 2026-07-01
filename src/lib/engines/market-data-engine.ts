import { pullMassiveMarketDataSnapshot } from "@/lib/services/massive";
import {
  isUsStockSymbol,
  type MarketDataSnapshot,
  type StoredMarketDataSnapshot,
} from "@/lib/services/market-data";
import { fetchYahooHistoricalData } from "@/lib/services/yahoo-finance";

type PullMarketDataOptions = {
  range?: string;
  interval?: string;
};

export async function pullLatestMarketDataSnapshot(
  symbol: string,
  options: PullMarketDataOptions = {},
  existingSnapshot?: StoredMarketDataSnapshot | null,
): Promise<MarketDataSnapshot> {
  if (isUsStockSymbol(symbol)) {
    return pullMassiveMarketDataSnapshot(symbol, existingSnapshot ?? null, options);
  }

  return fetchYahooHistoricalData(symbol, options);
}
