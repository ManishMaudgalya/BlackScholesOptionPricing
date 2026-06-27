import numpy as np
import streamlit as st
from scipy.stats import norm

from core.angelone import init_session_state, pick_greek_row, render_connection_sidebar
from core.black_scholes import bs_greeks, bs_price


init_session_state()
render_connection_sidebar()

st.markdown(
    """
    <div class="hero-panel">
        <div class="hero-title">Live-Aware Option Pricer</div>
        <p class="hero-subtitle">
            Uses the latest synced AngelOne quote as spot input and the optionGreek IV as the default volatility surface.
            You can still override every input manually.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

option_greeks = st.session_state.get("option_greeks") or []
live_snapshot = st.session_state.get("ao_market_snapshot")
use_live_context = bool(st.session_state.get("use_live_spot") and live_snapshot)

st.sidebar.markdown("## Pricing Inputs")

default_spot = st.session_state.get("synced_spot") if use_live_context and st.session_state.get("synced_spot") else 100.0
default_T = st.session_state.get("synced_time_to_expiry") if use_live_context and st.session_state.get("synced_time_to_expiry") else 1.0

available_strikes = sorted({row["strike_price"] for row in option_greeks if row.get("strike_price") is not None})
selected_side = st.sidebar.radio("Option Side", ["Call", "Put"], horizontal=True).lower()
selected_side_code = "CE" if selected_side == "call" else "PE"

selected_live_strike = None
selected_live_row = None

if available_strikes:
    atm_reference = default_spot or available_strikes[0]
    atm_index = min(range(len(available_strikes)), key=lambda idx: abs(available_strikes[idx] - atm_reference))
    selected_live_strike = st.sidebar.selectbox(
        "Live Chain Strike",
        available_strikes,
        index=atm_index,
        format_func=lambda strike: f"{strike:.2f}",
    )
    selected_live_row = pick_greek_row(option_greeks, strike=selected_live_strike, option_type=selected_side_code)

default_volatility = 20.0
if use_live_context and selected_live_row:
    default_volatility = selected_live_row["iv_percent"]
elif use_live_context and st.session_state.get("synced_volatility") is not None:
    default_volatility = st.session_state["synced_volatility"] * 100

S = st.sidebar.number_input("Spot Price (S)", min_value=0.01, value=float(default_spot), step=1.0)

if selected_live_strike is not None:
    use_live_strike = st.sidebar.toggle("Use selected live strike", value=True)
    live_strike_default = float(selected_live_strike) if use_live_strike else 100.0
    K = st.sidebar.number_input("Strike Price (K)", min_value=0.01, value=live_strike_default, step=1.0)
else:
    K = st.sidebar.number_input("Strike Price (K)", min_value=0.01, value=100.0, step=1.0)

T = st.sidebar.number_input("Time to Expiry (Years)", min_value=0.0, value=float(default_T or 1.0), step=0.01, format="%.4f")
r = st.sidebar.number_input("Risk-Free Rate (%)", min_value=0.0, value=5.0, step=0.1, format="%.2f") / 100
sigma = st.sidebar.number_input("Volatility (%)", min_value=0.01, value=float(default_volatility), step=0.1, format="%.2f") / 100

if live_snapshot:
    st.sidebar.info(
        f"Synced market context: `{live_snapshot['trading_symbol']}` @ ₹{live_snapshot['ltp']:.2f}\n\n"
        f"Updated: {st.session_state.get('last_updated') or '—'}"
    )

st.markdown(
    f"""
    <div class="info-card">
        <strong>Current model context</strong><br>
        <span style="color:#8ea3bc;">
            Spot ₹{S:.2f} · Strike ₹{K:.2f} · Expiry {T:.4f} years · Volatility {sigma * 100:.2f}% ·
            Option side {selected_side.upper()}
        </span>
    </div>
    """,
    unsafe_allow_html=True,
)

call_price = bs_price(S, K, T, r, sigma, "call")
put_price = bs_price(S, K, T, r, sigma, "put")
model_greeks = bs_greeks(S, K, T, r, sigma)

st.markdown('<div class="section-header">Option Prices</div>', unsafe_allow_html=True)
price_cols = st.columns(3)
price_cards = [
    ("Call Price", f"₹{call_price:.4f}", "#59e0a2"),
    ("Put Price", f"₹{put_price:.4f}", "#ff8d7c"),
    ("Put-Call Parity Δ", f"{call_price - put_price - (S - K * np.exp(-r * T)):.6f}", "#ffd166"),
]
for col, (label, value, color) in zip(price_cols, price_cards):
    with col:
        st.markdown(
            f"""
            <div class="metric-card">
                <div class="metric-label">{label}</div>
                <div class="metric-value" style="font-size:1.5rem; color:{color};">{value}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

st.markdown('<div class="section-header">Model Greeks</div>', unsafe_allow_html=True)
model_cards = [
    ("Delta (Call)", f"{model_greeks['delta_c']:.4f}", "Model sensitivity to spot"),
    ("Delta (Put)", f"{model_greeks['delta_p']:.4f}", "Model sensitivity to spot"),
    ("Gamma", f"{model_greeks['gamma']:.6f}", "Second derivative vs spot"),
    ("Theta (Call)", f"{model_greeks['theta_c']:.4f}", "Per calendar day"),
    ("Theta (Put)", f"{model_greeks['theta_p']:.4f}", "Per calendar day"),
    ("Vega", f"{model_greeks['vega']:.4f}", "Per 1% vol move"),
    ("Rho (Call)", f"{model_greeks['rho_c']:.4f}", "Per 1% rate move"),
    ("Rho (Put)", f"{model_greeks['rho_p']:.4f}", "Per 1% rate move"),
]
model_cols = st.columns(4)
for idx, (label, value, note) in enumerate(model_cards):
    with model_cols[idx % 4]:
        st.markdown(
            f"""
            <div class="metric-card" style="margin-bottom:12px;">
                <div class="metric-label">{label}</div>
                <div class="metric-value greek-value">{value}</div>
                <div style="color:#6f88a5; font-size:0.72rem; margin-top:4px;">{note}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

st.markdown('<div class="section-header">Live OptionGreek Comparison</div>', unsafe_allow_html=True)
if selected_live_row:
    live_compare_cols = st.columns(5)
    live_cards = [
        ("Live Delta", f"{selected_live_row['delta']:.4f}"),
        ("Live Gamma", f"{selected_live_row['gamma']:.6f}"),
        ("Live Theta", f"{selected_live_row['theta']:.4f}"),
        ("Live Vega", f"{selected_live_row['vega']:.4f}"),
        ("Live IV", f"{selected_live_row['iv_percent']:.2f}%"),
    ]
    for col, (label, value) in zip(live_compare_cols, live_cards):
        with col:
            st.markdown(
                f"""
                <div class="metric-card">
                    <div class="metric-label">{label}</div>
                    <div class="metric-value" style="font-size:1.05rem; color:#dce6f2;">{value}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    compare_cols = st.columns(4)
    compare_rows = [
        ("Delta gap", model_greeks["delta_c"] - selected_live_row["delta"] if selected_side == "call" else model_greeks["delta_p"] - selected_live_row["delta"]),
        ("Gamma gap", model_greeks["gamma"] - selected_live_row["gamma"]),
        ("Theta gap", model_greeks["theta_c"] - selected_live_row["theta"] if selected_side == "call" else model_greeks["theta_p"] - selected_live_row["theta"]),
        ("Vega gap", model_greeks["vega"] - selected_live_row["vega"]),
    ]
    for col, (label, value) in zip(compare_cols, compare_rows):
        with col:
            st.markdown(
                f"""
                <div class="metric-card">
                    <div class="metric-label">{label}</div>
                    <div class="metric-value" style="font-size:1.1rem; color:#8dc9ff;">{value:.6f}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.caption(
        f"Live row source: {live_snapshot['underlying']} {selected_live_row['expiry']} "
        f"{selected_live_row['option_type']} {selected_live_row['strike_price']:.2f} · "
        f"volume {selected_live_row['trade_volume']:,.0f}"
    )
else:
    st.info("No matching live optionGreek row is available for the current strike and side. Fetch an expiry in Live Market Feed first.")

st.markdown('<div class="section-header">Intermediate Terms</div>', unsafe_allow_html=True)
d1_val = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T)) if T > 0 and sigma > 0 else float("nan")
d2_val = d1_val - sigma * np.sqrt(T) if T > 0 and sigma > 0 else float("nan")

intermediate_cols = st.columns(4)
intermediates = [
    ("d1", f"{d1_val:.6f}" if not np.isnan(d1_val) else "—"),
    ("d2", f"{d2_val:.6f}" if not np.isnan(d2_val) else "—"),
    ("N(d1)", f"{norm.cdf(d1_val):.6f}" if not np.isnan(d1_val) else "—"),
    ("N(d2)", f"{norm.cdf(d2_val):.6f}" if not np.isnan(d2_val) else "—"),
]
for col, (label, value) in zip(intermediate_cols, intermediates):
    with col:
        st.markdown(
            f"""
            <div class="metric-card">
                <div class="metric-label">{label}</div>
                <div class="metric-value" style="font-size:1.05rem; color:#dce6f2;">{value}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
