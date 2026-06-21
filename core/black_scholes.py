from __future__ import annotations

import numpy as np
from scipy.stats import norm


def bs_price(S: float, K: float, T: float, r: float, sigma: float, option_type: str = "call") -> float:
    """Black-Scholes price for a European call or put."""
    if T <= 0 or sigma <= 0:
        return max(S - K, 0.0) if option_type == "call" else max(K - S, 0.0)

    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    if option_type == "call":
        return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    return K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)


def bs_greeks(S: float, K: float, T: float, r: float, sigma: float) -> dict[str, float]:
    """Black-Scholes greeks for a European option."""
    if T <= 0 or sigma <= 0:
        return {k: 0.0 for k in ["delta_c", "delta_p", "gamma", "theta_c", "theta_p", "vega", "rho_c", "rho_p"]}

    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    nd1 = norm.cdf(d1)
    nd1_neg = norm.cdf(-d1)
    nd2 = norm.cdf(d2)
    nd2_neg = norm.cdf(-d2)
    npd1 = norm.pdf(d1)

    gamma = npd1 / (S * sigma * np.sqrt(T))
    vega = S * npd1 * np.sqrt(T) / 100
    theta_c = (-(S * npd1 * sigma) / (2 * np.sqrt(T)) - r * K * np.exp(-r * T) * nd2) / 365
    theta_p = (-(S * npd1 * sigma) / (2 * np.sqrt(T)) + r * K * np.exp(-r * T) * nd2_neg) / 365
    rho_c = K * T * np.exp(-r * T) * nd2 / 100
    rho_p = -K * T * np.exp(-r * T) * nd2_neg / 100

    return {
        "delta_c": nd1,
        "delta_p": -nd1_neg,
        "gamma": gamma,
        "theta_c": theta_c,
        "theta_p": theta_p,
        "vega": vega,
        "rho_c": rho_c,
        "rho_p": rho_p,
    }
