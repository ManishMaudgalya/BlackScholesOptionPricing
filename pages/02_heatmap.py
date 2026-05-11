import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from scipy.stats import norm

#Black-Scholes helper
def bs_price(S, K, T, r, sigma, option_type="call"):
    if T <= 0 or sigma <= 0:
        return max(S - K, 0) if option_type == "call" else max(K - S, 0)
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    if option_type == "call":
        return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    else:
        return K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)

#Sidebar controls
st.sidebar.markdown("## Heatmap Parameters")

S   = st.sidebar.number_input("Spot Price (S)",        min_value=0.01, value=100.0, step=1.0)
T   = st.sidebar.number_input("Time to Expiry (Years)",min_value=0.01, value=1.0,   step=0.05, format="%.2f")
r   = st.sidebar.number_input("Risk-Free Rate (%)",    min_value=0.0,  value=5.0,   step=0.1,  format="%.2f") / 100

st.sidebar.markdown("---")
st.sidebar.markdown("**Volatility Axis**")
vol_min   = st.sidebar.slider("Min Vol (%)",    1,  100, 10)
vol_max   = st.sidebar.slider("Max Vol (%)",    1,  200, 60)
vol_steps = st.sidebar.slider("# Vol Steps",   5,   30, 11)

st.sidebar.markdown("**Strike Axis**")
K_pct_min = st.sidebar.slider("Min Strike (% of Spot)", 50,  100, 70)
K_pct_max = st.sidebar.slider("Max Strike (% of Spot)", 100, 200, 130)
K_steps   = st.sidebar.slider("# Strike Steps",          5,   30, 13)

option_type = st.sidebar.radio("Option Type", ["Call", "Put"], horizontal=True).lower()
color_scale = st.sidebar.selectbox("Color Scale", ["Viridis", "Plasma", "RdYlGn", "Blues", "Hot", "Turbo"])

#Build grid
vols    = np.linspace(vol_min / 100, vol_max / 100, vol_steps)
strikes = np.linspace(K_pct_min / 100 * S, K_pct_max / 100 * S, K_steps)

prices = np.zeros((len(strikes), len(vols)))
for i, K in enumerate(strikes):
    for j, sigma in enumerate(vols):
        prices[i, j] = bs_price(S, K, T, r, sigma, option_type)

vol_labels    = [f"{v*100:.1f}%" for v in vols]
strike_labels = [f"${k:.1f}"    for k in strikes]

#Header
st.markdown(
    f"""
    <h1 style='font-family:"IBM Plex Mono",monospace; font-size:1.6rem;
               color:#e2e8f0; margin-bottom:4px;'>
        Volatility × Strike Heatmap
    </h1>
    <p style='color:#475569; font-size:0.85rem; margin-top:0;'>
        {option_type.capitalize()} option prices · Spot = ${S:.2f} · T = {T:.2f} yr · r = {r*100:.1f}%
    </p>
    """,
    unsafe_allow_html=True,
)

#Plotly heatmap
fig = go.Figure(
    data=go.Heatmap(
        z=prices,
        x=vol_labels,
        y=strike_labels,
        colorscale=color_scale,
        colorbar=dict(
            title=dict(text="Price ($)", font=dict(color="#94a3b8", family="IBM Plex Mono")),
            tickfont=dict(color="#94a3b8", family="IBM Plex Mono"),
            outlinecolor="#1e2330",
            outlinewidth=1,
        ),
        hoverongaps=False,
        hovertemplate=(
            "<b>Vol:</b> %{x}<br>"
            "<b>Strike:</b> %{y}<br>"
            "<b>Price:</b> $%{z:.4f}<extra></extra>"
        ),
    )
)

# ATM line annotation — use numeric index (categorical axis doesn't accept string y in add_hline)
atm_idx = int(np.argmin(np.abs(strikes - S)))

fig.add_shape(
    type="line",
    x0=0, x1=1, xref="paper",
    y0=atm_idx, y1=atm_idx, yref="y",
    line=dict(color="#facc15", width=1.5, dash="dash"),
)
fig.add_annotation(
    x=1.01, xref="paper",
    y=atm_idx, yref="y",
    text="ATM",
    showarrow=False,
    font=dict(color="#facc15", family="IBM Plex Mono", size=11),
    xanchor="left",
)

fig.update_layout(
    paper_bgcolor="#0d0f14",
    plot_bgcolor="#0d0f14",
    font=dict(family="IBM Plex Mono", color="#94a3b8"),
    xaxis=dict(
        title=dict(text="Implied Volatility", font=dict(color="#64748b", size=12)),
        tickfont=dict(color="#94a3b8"),
        gridcolor="#1e2330",
        side="top",
    ),
    yaxis=dict(
        title=dict(text="Strike Price", font=dict(color="#64748b", size=12)),
        tickfont=dict(color="#94a3b8"),
        gridcolor="#1e2330",
        autorange="reversed",
    ),
    margin=dict(t=80, l=90, r=30, b=40),
    height=620,
)

st.plotly_chart(fig, use_container_width=True)

#Stats below heatmap
st.markdown('<div class="section-header">Heatmap Statistics</div>', unsafe_allow_html=True)

c1, c2, c3, c4 = st.columns(4)
stat_cards = [
    ("Min Price",  f"${prices.min():.4f}",  "#f87171"),
    ("Max Price",  f"${prices.max():.4f}",  "#34d399"),
    ("Mean Price", f"${prices.mean():.4f}", "#93c5fd"),
    ("Price Range",f"${prices.max()-prices.min():.4f}", "#facc15"),
]
for col, (lbl, val, color) in zip([c1,c2,c3,c4], stat_cards):
    with col:
        st.markdown(f"""
            <div class="metric-card">
                <div class="metric-label">{lbl}</div>
                <div class="metric-value" style="font-size:1.4rem; color:{color};">{val}</div>
            </div>""", unsafe_allow_html=True)

#Raw data table
with st.expander("📋  View Raw Price Table"):
    df = pd.DataFrame(prices, index=strike_labels, columns=vol_labels)
    df.index.name   = "Strike \\ Vol"
    st.dataframe(
        df.style.background_gradient(cmap="viridis").format("${:.4f}"),
        use_container_width=True,
    )
