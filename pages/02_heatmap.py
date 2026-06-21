import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from core.angelone import init_session_state, render_connection_sidebar
from core.black_scholes import bs_price


init_session_state()
render_connection_sidebar()

st.markdown(
    """
    <div class="hero-panel">
        <div class="hero-title">Option Greeks Heatmap</div>
        <p class="hero-subtitle">
            Live heatmap built from AngelOne <code>optionGreek</code> rows. When no live greek chain is loaded,
            the page falls back to a fast theoretical Black-Scholes price surface.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

live_snapshot = st.session_state.get("ao_market_snapshot")
option_greeks = st.session_state.get("option_greeks") or []

st.sidebar.markdown("## Heatmap Controls")
view_mode = "Live Option Greeks" if option_greeks else "Model Price Surface"
st.sidebar.info(f"Current mode: {view_mode}")

if option_greeks:
    option_side = st.sidebar.radio("Contract Side", ["CE", "PE"], horizontal=True)
    greek_metrics = {
        "delta": "Delta",
        "gamma": "Gamma",
        "theta": "Theta",
        "vega": "Vega",
        "iv_percent": "Implied Volatility (%)",
        "trade_volume": "Trade Volume",
    }
    selected_metrics = st.sidebar.multiselect(
        "Greek Columns",
        list(greek_metrics.keys()),
        default=["delta", "gamma", "theta", "vega", "iv_percent"],
        format_func=lambda key: greek_metrics[key],
    )
    normalize = st.sidebar.toggle("Normalize Each Column", value=True)

    filtered = pd.DataFrame(option_greeks)
    filtered = filtered[filtered["option_type"] == option_side].sort_values("strike_price").reset_index(drop=True)

    if filtered.empty:
        st.warning(f"No `{option_side}` rows were returned for the current expiry.")
    elif selected_metrics:
        raw_df = filtered[["strike_price"] + selected_metrics].copy()
        display_df = raw_df.set_index("strike_price")

        if normalize:
            denom = (display_df.max() - display_df.min()).replace(0, 1)
            z_values = ((display_df - display_df.min()) / denom).values
            colorbar_title = "Relative Intensity"
        else:
            z_values = display_df.values
            colorbar_title = "Raw Value"

        fig = go.Figure(
            data=go.Heatmap(
                z=z_values,
                x=[greek_metrics[key] for key in selected_metrics],
                y=[f"{strike:.2f}" for strike in display_df.index],
                customdata=display_df.values,
                colorscale="Turbo",
                hovertemplate="<b>Strike</b> %{y}<br><b>Metric</b> %{x}<br><b>Value</b> %{customdata:.6f}<extra></extra>",
                colorbar=dict(title=colorbar_title),
            )
        )
        fig.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(8,18,33,0.7)",
            margin=dict(t=30, l=20, r=20, b=20),
            height=640,
            xaxis_title="Greek Metric",
            yaxis_title=f"{option_side} Strike",
            font=dict(family="IBM Plex Mono", color="#dce6f2"),
        )
        st.plotly_chart(fig, use_container_width=True)

        atm_strike = live_snapshot["ltp"] if live_snapshot else float(display_df.index.iloc[len(display_df.index) // 2])
        closest_idx = min(range(len(display_df.index)), key=lambda idx: abs(display_df.index[idx] - atm_strike))
        atm_row = filtered.iloc[closest_idx]

        st.markdown('<div class="section-header">ATM-like Strike Snapshot</div>', unsafe_allow_html=True)
        atm_cols = st.columns(min(len(selected_metrics), 5))
        for col, metric_key in zip(atm_cols, selected_metrics[:5]):
            with col:
                st.markdown(
                    f"""
                    <div class="metric-card">
                        <div class="metric-label">{greek_metrics[metric_key]}</div>
                        <div class="metric-value" style="font-size:1.05rem; color:#dce6f2;">{atm_row[metric_key]:.6f}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

        formatted_df = display_df.copy()
        for metric in formatted_df.columns:
            if metric == "trade_volume":
                formatted_df[metric] = formatted_df[metric].map(lambda value: f"{value:,.0f}")
            elif metric == "iv_percent":
                formatted_df[metric] = formatted_df[metric].map(lambda value: f"{value:.2f}%")
            else:
                formatted_df[metric] = formatted_df[metric].map(lambda value: f"{value:.6f}")
        formatted_df.index = [f"{strike:.2f}" for strike in formatted_df.index]
        st.dataframe(formatted_df.rename(columns=greek_metrics), use_container_width=True)
    else:
        st.warning("Pick at least one greek metric to render the heatmap.")
else:
    st.info("No live option-greek chain is loaded. Fetch a market snapshot with expiry data in Live Market Feed to switch this page to live greeks.")

    S = st.sidebar.number_input("Spot Price (S)", min_value=0.01, value=100.0, step=1.0)
    T = st.sidebar.number_input("Time to Expiry (Years)", min_value=0.01, value=1.0, step=0.05, format="%.2f")
    r = st.sidebar.number_input("Risk-Free Rate (%)", min_value=0.0, value=5.0, step=0.1, format="%.2f") / 100

    st.sidebar.markdown("---")
    st.sidebar.markdown("**Volatility Axis**")
    vol_min = st.sidebar.slider("Min Vol (%)", 1, 100, 10)
    vol_max = st.sidebar.slider("Max Vol (%)", 1, 200, 60)
    vol_steps = st.sidebar.slider("# Vol Steps", 5, 30, 11)

    st.sidebar.markdown("**Strike Axis**")
    K_pct_min = st.sidebar.slider("Min Strike (% of Spot)", 50, 100, 70)
    K_pct_max = st.sidebar.slider("Max Strike (% of Spot)", 100, 200, 130)
    K_steps = st.sidebar.slider("# Strike Steps", 5, 30, 13)

    option_type = st.sidebar.radio("Option Type", ["Call", "Put"], horizontal=True).lower()
    vols = np.linspace(vol_min / 100, vol_max / 100, vol_steps)
    strikes = np.linspace(K_pct_min / 100 * S, K_pct_max / 100 * S, K_steps)

    prices = np.zeros((len(strikes), len(vols)))
    for i, strike in enumerate(strikes):
        for j, sigma in enumerate(vols):
            prices[i, j] = bs_price(S, strike, T, r, sigma, option_type)

    fig = go.Figure(
        data=go.Heatmap(
            z=prices,
            x=[f"{vol * 100:.1f}%" for vol in vols],
            y=[f"${strike:.1f}" for strike in strikes],
            colorscale="Viridis",
            hovertemplate="<b>Vol</b> %{x}<br><b>Strike</b> %{y}<br><b>Price</b> $%{z:.4f}<extra></extra>",
        )
    )
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(8,18,33,0.7)",
        margin=dict(t=30, l=20, r=20, b=20),
        height=620,
        xaxis_title="Implied Volatility",
        yaxis_title="Strike Price",
        font=dict(family="IBM Plex Mono", color="#dce6f2"),
    )
    st.plotly_chart(fig, use_container_width=True)
