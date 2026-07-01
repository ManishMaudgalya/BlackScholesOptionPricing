const SQRT_2PI = Math.sqrt(2 * Math.PI);

function normalPdf(value: number) {
  return Math.exp(-0.5 * value * value) / SQRT_2PI;
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));

  return 0.5 * (1 + sign * erf);
}

export function calculateD1(
  spotPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  riskFreeRate: number,
  volatility: number,
) {
  if (timeToExpiry <= 0 || volatility <= 0) {
    return Number.NaN;
  }

  return (
    (Math.log(spotPrice / strikePrice) + (riskFreeRate + 0.5 * volatility ** 2) * timeToExpiry) /
    (volatility * Math.sqrt(timeToExpiry))
  );
}

export function calculateD2(timeToExpiry: number, volatility: number, d1: number) {
  if (!Number.isFinite(d1) || timeToExpiry <= 0 || volatility <= 0) {
    return Number.NaN;
  }

  return d1 - volatility * Math.sqrt(timeToExpiry);
}

export function blackScholesPrice(
  spotPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  riskFreeRate: number,
  volatility: number,
  optionType: "call" | "put" = "call",
) {
  if (timeToExpiry <= 0 || volatility <= 0) {
    return optionType === "call"
      ? Math.max(spotPrice - strikePrice, 0)
      : Math.max(strikePrice - spotPrice, 0);
  }

  const d1 = calculateD1(spotPrice, strikePrice, timeToExpiry, riskFreeRate, volatility);
  const d2 = calculateD2(timeToExpiry, volatility, d1);

  if (optionType === "call") {
    return spotPrice * normalCdf(d1) - strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCdf(d2);
  }

  return strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCdf(-d2) - spotPrice * normalCdf(-d1);
}

export type GreeksResult = {
  deltaCall: number;
  deltaPut: number;
  gamma: number;
  thetaCall: number;
  thetaPut: number;
  vega: number;
  rhoCall: number;
  rhoPut: number;
};

export function blackScholesGreeks(
  spotPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  riskFreeRate: number,
  volatility: number,
): GreeksResult {
  if (timeToExpiry <= 0 || volatility <= 0) {
    return {
      deltaCall: 0,
      deltaPut: 0,
      gamma: 0,
      thetaCall: 0,
      thetaPut: 0,
      vega: 0,
      rhoCall: 0,
      rhoPut: 0,
    };
  }

  const d1 = calculateD1(spotPrice, strikePrice, timeToExpiry, riskFreeRate, volatility);
  const d2 = calculateD2(timeToExpiry, volatility, d1);
  const nd1 = normalCdf(d1);
  const nd1Neg = normalCdf(-d1);
  const nd2 = normalCdf(d2);
  const nd2Neg = normalCdf(-d2);
  const npd1 = normalPdf(d1);

  const gamma = npd1 / (spotPrice * volatility * Math.sqrt(timeToExpiry));
  const vega = (spotPrice * npd1 * Math.sqrt(timeToExpiry)) / 100;
  const thetaCall =
    (-(spotPrice * npd1 * volatility) / (2 * Math.sqrt(timeToExpiry)) -
      riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * nd2) /
    365;
  const thetaPut =
    (-(spotPrice * npd1 * volatility) / (2 * Math.sqrt(timeToExpiry)) +
      riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * nd2Neg) /
    365;
  const rhoCall = (strikePrice * timeToExpiry * Math.exp(-riskFreeRate * timeToExpiry) * nd2) / 100;
  const rhoPut = (-strikePrice * timeToExpiry * Math.exp(-riskFreeRate * timeToExpiry) * nd2Neg) / 100;

  return {
    deltaCall: nd1,
    deltaPut: -nd1Neg,
    gamma,
    thetaCall,
    thetaPut,
    vega,
    rhoCall,
    rhoPut,
  };
}
