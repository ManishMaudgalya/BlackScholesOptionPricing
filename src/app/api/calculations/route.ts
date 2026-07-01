import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CalculationModel } from "@/lib/db/models/calculation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { blackScholesGreeks, blackScholesPrice } from "@/lib/finance/black-scholes";

type CreateCalculationBody = {
  spotPrice: number;
  strikePrice: number;
  timeToExpiry: number;
  riskFreeRate: number;
  volatility: number;
  optionType: "call" | "put";
  marketData?: {
    symbol?: string;
    shortName?: string;
    source?: string;
    currency?: string;
    latestClose?: number;
    latestCloseAt?: string;
    realizedVolatility?: number;
    fetchedAt?: string;
  };
};

function normalizeNumber(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric field: ${field}`);
  }
  return parsed;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const calculations = await CalculationModel.find({ authUserId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    return NextResponse.json({ calculations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load calculations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<CreateCalculationBody>;
    const optionType = body.optionType === "put" ? "put" : "call";

    const inputs = {
      spotPrice: normalizeNumber(body.spotPrice, "spotPrice"),
      strikePrice: normalizeNumber(body.strikePrice, "strikePrice"),
      timeToExpiry: normalizeNumber(body.timeToExpiry, "timeToExpiry"),
      riskFreeRate: normalizeNumber(body.riskFreeRate, "riskFreeRate"),
      volatility: normalizeNumber(body.volatility, "volatility"),
      optionType,
    };
    const marketData = body.marketData
      ? {
          symbol: normalizeString(body.marketData.symbol),
          shortName: normalizeString(body.marketData.shortName),
          source: normalizeString(body.marketData.source),
          currency: normalizeString(body.marketData.currency) || "USD",
          latestClose:
            typeof body.marketData.latestClose === "number" && Number.isFinite(body.marketData.latestClose)
              ? body.marketData.latestClose
              : null,
          latestCloseAt: normalizeString(body.marketData.latestCloseAt) || null,
          realizedVolatility:
            typeof body.marketData.realizedVolatility === "number" &&
            Number.isFinite(body.marketData.realizedVolatility)
              ? body.marketData.realizedVolatility
              : null,
          fetchedAt: normalizeString(body.marketData.fetchedAt) || null,
        }
      : undefined;

    const prices = {
      call: blackScholesPrice(
        inputs.spotPrice,
        inputs.strikePrice,
        inputs.timeToExpiry,
        inputs.riskFreeRate,
        inputs.volatility,
        "call",
      ),
      put: blackScholesPrice(
        inputs.spotPrice,
        inputs.strikePrice,
        inputs.timeToExpiry,
        inputs.riskFreeRate,
        inputs.volatility,
        "put",
      ),
    };

    const greeks = blackScholesGreeks(
      inputs.spotPrice,
      inputs.strikePrice,
      inputs.timeToExpiry,
      inputs.riskFreeRate,
      inputs.volatility,
    );

    await connectToDatabase();
    const calculation = await CalculationModel.create({
      authUserId: session.user.id,
      userEmail: session.user.email ?? "",
      inputs,
      results: { prices, greeks },
      marketData,
    });

    return NextResponse.json({ calculation }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save calculation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
