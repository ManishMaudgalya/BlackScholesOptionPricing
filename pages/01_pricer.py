import streamlit as st
import numpy as np
from scipy.stats import norm

#Black-Scholes
def bs_price(S, K, T, r, sigma, option_type="call"):
    """Black-Scholes price for European call or put."""
    if T <= 0:
        if option_type == "call":
            return max(S - K, 0)
        else:
            return max(K - S, 0)
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    if option_type == "call":
        return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    else:
        return K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)

def bs_greeks(S, K, T, r, sigma):
    """Return dict of greeks for call and put."""
    if T <= 0:
        return {k: 0.0 for k in ["delta_c","delta_p","gamma","theta_c","theta_p","vega","rho_c","rho_p"]}
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    nd1  = norm.cdf(d1)
    nd1_ = norm.cdf(-d1)
    nd2  = norm.cdf(d2)
    nd2_ = norm.cdf(-d2)
    npd1 = norm.pdf(d1)
    gamma  = npd1 / (S * sigma * np.sqrt(T))
    vega   = S * npd1 * np.sqrt(T) / 100          # per 1% vol move
    theta_c = (-(S * npd1 * sigma) / (2 * np.sqrt(T)) - r * K * np.exp(-r * T) * nd2)  / 365
    theta_p = (-(S * npd1 * sigma) / (2 * np.sqrt(T)) + r * K * np.exp(-r * T) * nd2_) / 365
    rho_c  = K * T * np.exp(-r * T) * nd2  / 100  # per 1% rate move
    rho_p  = -K * T * np.exp(-r * T) * nd2_ / 100
    return dict(delta_c=nd1, delta_p=-nd1_, gamma=gamma,
                theta_c=theta_c, theta_p=theta_p,
                vega=vega, rho_c=rho_c, rho_p=rho_p)

#Sidebar inputs
st.sidebar.markdown("## Parameters")

S     = st.sidebar.number_input("Spot Price (S)",        min_value=0.01, value=100.0, step=1.0)
K     = st.sidebar.number_input("Strike Price (K)",      min_value=0.01, value=100.0, step=1.0)
T     = st.sidebar.number_input("Time to Expiry (Years)",min_value=0.0,  value=1.0,   step=0.05, format="%.2f")
r     = st.sidebar.number_input("Risk-Free Rate (%)",    min_value=0.0,  value=5.0,   step=0.1,  format="%.2f") / 100
sigma = st.sidebar.number_input("Volatility (%)",        min_value=0.01, value=20.0,  step=0.5,  format="%.2f") / 100

#Header
st.markdown(
    """
    <h1 style='font-family:"IBM Plex Mono",monospace; font-size:1.6rem;
               color:#e2e8f0; margin-bottom:4px;'>
        Black-Scholes Option Pricer
    </h1>
    <p style='color:#475569; font-size:0.85rem; margin-top:0;'>
        European vanilla options · Continuous dividend-free model
    </p>
    """,
    unsafe_allow_html=True,
)

#Option prices─
call_price = bs_price(S, K, T, r, sigma, "call")
put_price  = bs_price(S, K, T, r, sigma, "put")

st.markdown('<div class="section-header">Option Prices</div>', unsafe_allow_html=True)

col1, col2, col3 = st.columns(3)

with col1:
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">Call Price</div>
            <div class="metric-value call-color">${call_price:.4f}</div>
        </div>""", unsafe_allow_html=True)

with col2:
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">Put Price</div>
            <div class="metric-value put-color">${put_price:.4f}</div>
        </div>""", unsafe_allow_html=True)

with col3:
    pcp = call_price - put_price - (S - K * np.exp(-r * T))
    moneyness = "ATM" if abs(S - K) / K < 0.01 else ("ITM" if S > K else "OTM")
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">Moneyness</div>
            <div class="metric-value" style="color:#facc15; font-size:1.6rem;">{moneyness}</div>
            <div style="color:#475569; font-size:0.75rem; margin-top:4px;">Put-Call Parity Δ: {pcp:.6f}</div>
        </div>""", unsafe_allow_html=True)

#Greeks────────
st.markdown('<div class="section-header">Greeks</div>', unsafe_allow_html=True)

g = bs_greeks(S, K, T, r, sigma)

greeks_data = [
    ("Delta  (Call)", f"{g['delta_c']:.4f}",  "∂V/∂S — call"),
    ("Delta  (Put)",  f"{g['delta_p']:.4f}",  "∂V/∂S — put"),
    ("Gamma",         f"{g['gamma']:.6f}",    "∂²V/∂S²"),
    ("Theta  (Call)", f"{g['theta_c']:.4f}",  "per calendar day"),
    ("Theta  (Put)",  f"{g['theta_p']:.4f}",  "per calendar day"),
    ("Vega",          f"{g['vega']:.4f}",     "per 1% vol move"),
    ("Rho    (Call)", f"{g['rho_c']:.4f}",    "per 1% rate move"),
    ("Rho    (Put)",  f"{g['rho_p']:.4f}",    "per 1% rate move"),
]

cols = st.columns(4)
for i, (label, val, note) in enumerate(greeks_data):
    with cols[i % 4]:
        st.markdown(f"""
            <div class="metric-card" style="margin-bottom:12px;">
                <div class="metric-label">{label}</div>
                <div class="metric-value greek-value">{val}</div>
                <div style="color:#475569; font-size:0.72rem; margin-top:4px;">{note}</div>
            </div>""", unsafe_allow_html=True)

#Model inputs summary ───────────────────────────────────────────────────────
st.markdown('<div class="section-header">Model Inputs Summary</div>', unsafe_allow_html=True)

d1_val = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T)) if T > 0 else float('nan')
d2_val = d1_val - sigma * np.sqrt(T) if T > 0 else float('nan')

summary_cols = st.columns(5)
labels_vals = [
    ("Spot (S)",    f"${S:.2f}"),
    ("Strike (K)",  f"${K:.2f}"),
    ("Expiry (T)",  f"{T:.4f} yr"),
    ("Rate (r)",    f"{r*100:.2f}%"),
    ("Vol (σ)",     f"{sigma*100:.2f}%"),
]
for col, (lbl, val) in zip(summary_cols, labels_vals):
    with col:
        st.markdown(f"""
            <div class="metric-card">
                <div class="metric-label">{lbl}</div>
                <div class="metric-value" style="font-size:1.2rem; color:#cbd5e1;">{val}</div>
            </div>""", unsafe_allow_html=True)

st.markdown('<div class="section-header">d1 / d2 Intermediates</div>', unsafe_allow_html=True)
d_cols = st.columns(4)
intermediates = [
    ("d1", f"{d1_val:.6f}"),
    ("d2", f"{d2_val:.6f}"),
    ("N(d1)", f"{norm.cdf(d1_val):.6f}" if not np.isnan(d1_val) else "—"),
    ("N(d2)", f"{norm.cdf(d2_val):.6f}" if not np.isnan(d2_val) else "—"),
]
for col, (lbl, val) in zip(d_cols, intermediates):
    with col:
        st.markdown(f"""
            <div class="metric-card">
                <div class="metric-label">{lbl}</div>
                <div class="metric-value" style="font-size:1.1rem; color:#a78bfa;">{val}</div>
            </div>""", unsafe_allow_html=True)
