export const PORTFOLIO_SECTOR_MODELS = [
  {
    id: "technology",
    label: "Technology Leaders",
    thesis: "Large-cap software, devices, and semiconductors with strong index influence.",
    symbols: ["AAPL", "MSFT", "NVDA", "AVGO"],
  },
  {
    id: "healthcare",
    label: "Healthcare Majors",
    thesis: "Defensive healthcare allocation across pharma, managed care, and biopharma.",
    symbols: ["LLY", "UNH", "JNJ", "ABBV"],
  },
  {
    id: "financials",
    label: "Financial Heavyweights",
    thesis: "Money-center banking, asset management, and capital-markets exposure.",
    symbols: ["JPM", "GS", "BLK", "BAC"],
  },
  {
    id: "energy",
    label: "Energy Complex",
    thesis: "Integrated majors plus upstream and services for commodity-linked exposure.",
    symbols: ["XOM", "CVX", "EOG", "SLB"],
  },
  {
    id: "consumer",
    label: "Consumer Franchise",
    thesis: "Consumer platforms and staples with durable brand and cash-flow profiles.",
    symbols: ["AMZN", "COST", "MCD", "PG"],
  },
  {
    id: "industrials",
    label: "Industrial Cycle",
    thesis: "Aerospace, machinery, and capital-goods names tied to economic momentum.",
    symbols: ["GE", "CAT", "RTX", "DE"],
  },
] as const;

export type PortfolioSectorId = (typeof PORTFOLIO_SECTOR_MODELS)[number]["id"];

export const DEFAULT_PORTFOLIO_SECTOR_ID = PORTFOLIO_SECTOR_MODELS[0].id;

export function getPortfolioSectorModel(rawSectorId: string) {
  const sectorId = rawSectorId.trim().toLowerCase();
  return PORTFOLIO_SECTOR_MODELS.find((sector) => sector.id === sectorId) ?? null;
}
