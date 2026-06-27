import pandas as pd
import plotly.express as px
import streamlit as st

from core.angelone import (
    init_session_state,
    pick_greek_row,
    refresh_market_snapshot,
    render_connection_sidebar,
    render_market_selector_sidebar,
)


init_session_state()
render_connection_sidebar()
render_market_selector_sidebar()

fetch_clicked = st.sidebar.button("Fetch Live Snapshot", use_container_width=True, key="ao_fetch_snapshot")
if fetch_clicked:
    try:
        refresh_market_snapshot()
        st.sidebar.success(f"Updated at {st.session_state['last_updated']}")
    except Exception as exc:
        st.sidebar.error(str(exc))

st.markdown(
    """
    <div class="hero-panel">
        <div class="hero-title">AngelOne Live Market Feed</div>
        <p class="hero-subtitle">
            REST-backed SmartAPI quote flow with option-greek enrichment from <code>docs/apiDocs.md</code>.
            Search a scrip, fetch the live snapshot, then sync that context into the pricer and heatmap.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="info-card">
        <strong>SmartAPI wiring used here</strong><br>
        <span style="color:#8ea3bc;">
            <code>searchScrip</code> resolves the symbol token, <code>market/v1/quote</code> loads FULL market data,
            and <code>marketData/v1/optionGreek</code> supplies IV, delta, gamma, theta, vega, and volume for the chosen expiry.
        </span>
    </div>
    """,
    unsafe_allow_html=True,
)

snapshot = st.session_state.get("ao_market_snapshot")
option_greeks = st.session_state.get("option_greeks") or []

if snapshot is None:
    st.info("Connect to AngelOne in the sidebar, resolve a symbol token, and fetch a live snapshot to begin.")
else:
    change_color = "#59e0a2" if snapshot["net_change"] >= 0 else "#ff8d7c"
    change_symbol = "▲" if snapshot["net_change"] >= 0 else "▼"

    cols = st.columns(4)
    cards = [
        ("Last Traded Price", f"₹{snapshot['ltp']:.2f}", "#55d6ff"),
        ("Net Change", f"{change_symbol} {snapshot['net_change']:.2f}", change_color),
        ("Volume", f"{snapshot['trade_volume']:,.0f}", "#ffd166"),
        ("Open Interest", f"{snapshot['open_interest']:,.0f}", "#8dc9ff"),
    ]
    for col, (label, value, color) in zip(cols, cards):
        with col:
            st.markdown(
                f"""
                <div class="metric-card">
                    <div class="metric-label">{label}</div>
                    <div class="metric-value" style="font-size:1.45rem; color:{color};">{value}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    summary_cols = st.columns(5)
    summaries = [
        ("Symbol", snapshot["trading_symbol"]),
        ("Exchange", snapshot["exchange"]),
        ("Open / High", f"₹{snapshot['open']:.2f} / ₹{snapshot['high']:.2f}"),
        ("Low / Close", f"₹{snapshot['low']:.2f} / ₹{snapshot['close']:.2f}"),
        ("% Change", f"{snapshot['percent_change']:.2f}%"),
    ]
    for col, (label, value) in zip(summary_cols, summaries):
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

    st.markdown('<div class="section-header">Market Depth & Exchange Times</div>', unsafe_allow_html=True)
    depth_col, meta_col = st.columns([1.2, 1])

    with depth_col:
        buy_depth = (snapshot.get("depth") or {}).get("buy") or []
        sell_depth = (snapshot.get("depth") or {}).get("sell") or []
        depth_rows = []
        for idx in range(max(len(buy_depth), len(sell_depth), 1)):
            buy = buy_depth[idx] if idx < len(buy_depth) else {}
            sell = sell_depth[idx] if idx < len(sell_depth) else {}
            depth_rows.append(
                {
                    "Buy Px": buy.get("price"),
                    "Buy Qty": buy.get("quantity"),
                    "Buy Orders": buy.get("orders"),
                    "Sell Px": sell.get("price"),
                    "Sell Qty": sell.get("quantity"),
                    "Sell Orders": sell.get("orders"),
                }
            )
        st.dataframe(pd.DataFrame(depth_rows), use_container_width=True, hide_index=True)

    with meta_col:
        meta_cards = [
            ("Avg Price", f"₹{snapshot['avg_price']:.2f}"),
            ("Feed Time", snapshot.get("exchange_feed_time") or "—"),
            ("Trade Time", snapshot.get("exchange_trade_time") or "—"),
            ("52W Range", f"₹{snapshot['week_52_low']:.2f} → ₹{snapshot['week_52_high']:.2f}"),
            ("Circuit Band", f"₹{snapshot['lower_circuit']:.2f} → ₹{snapshot['upper_circuit']:.2f}"),
        ]
        for label, value in meta_cards:
            st.markdown(
                f"""
                <div class="metric-card" style="margin-bottom:12px;">
                    <div class="metric-label">{label}</div>
                    <div class="metric-value" style="font-size:1rem; color:#dce6f2;">{value}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.markdown('<div class="section-header">Option Greeks Snapshot</div>', unsafe_allow_html=True)
    if option_greeks:
        selected_side = st.radio("Contract Side", ["CE", "PE"], horizontal=True, key="ao_greek_side")
        greek_metric = st.selectbox(
            "Chart Metric",
            ["iv_percent", "delta", "gamma", "theta", "vega", "trade_volume"],
            format_func=lambda key: {
                "iv_percent": "Implied Volatility (%)",
                "delta": "Delta",
                "gamma": "Gamma",
                "theta": "Theta",
                "vega": "Vega",
                "trade_volume": "Trade Volume",
            }[key],
        )

        greek_df = pd.DataFrame(option_greeks).sort_values(["option_type", "strike_price"]).reset_index(drop=True)
        filtered = greek_df[greek_df["option_type"] == selected_side].copy()

        atm_row = pick_greek_row(option_greeks, option_type=selected_side, spot=snapshot["ltp"])
        metric_cols = st.columns(5)
        metric_rows = [
            ("Underlying", snapshot["underlying"]),
            ("Expiry", snapshot.get("expiry_code") or "—"),
            ("ATM Strike", f"{atm_row['strike_price']:.2f}" if atm_row else "—"),
            ("ATM IV", f"{atm_row['iv_percent']:.2f}%" if atm_row else "—"),
            ("Updated", st.session_state.get("last_updated") or "—"),
        ]
        for col, (label, value) in zip(metric_cols, metric_rows):
            with col:
                st.markdown(
                    f"""
                    <div class="metric-card">
                        <div class="metric-label">{label}</div>
                        <div class="metric-value" style="font-size:1rem; color:#dce6f2;">{value}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

        if filtered.empty:
            st.warning(f"No `{selected_side}` rows were returned for this expiry.")
        else:
            chart = px.line(
                filtered,
                x="strike_price",
                y=greek_metric,
                markers=True,
                template="plotly_dark",
                color_discrete_sequence=["#55d6ff"],
            )
            chart.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(8,18,33,0.7)",
                margin=dict(t=18, l=20, r=20, b=20),
                xaxis_title="Strike Price",
                yaxis_title=greek_metric.replace("_", " ").title(),
            )
            st.plotly_chart(chart, use_container_width=True)

        greek_df["iv_percent"] = greek_df["iv_percent"].map(lambda value: f"{value:.2f}%")
        greek_df["trade_volume"] = greek_df["trade_volume"].map(lambda value: f"{value:,.0f}")
        st.dataframe(
            greek_df.rename(
                columns={
                    "strike_price": "Strike",
                    "option_type": "Type",
                    "delta": "Delta",
                    "gamma": "Gamma",
                    "theta": "Theta",
                    "vega": "Vega",
                    "iv_percent": "IV %",
                    "trade_volume": "Volume",
                }
            )[["Strike", "Type", "Delta", "Gamma", "Theta", "Vega", "IV %", "Volume"]],
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.info("No option greek rows are loaded yet. Enter an NSE underlying and expiry in the sidebar to enrich the quote.")

    st.markdown('<div class="section-header">Sync Into Pricing Tools</div>', unsafe_allow_html=True)
    if st.button("Use This Market Context in Pricer & Heatmap", use_container_width=True):
        st.session_state["use_live_spot"] = True
        st.success("Live quote, ATM IV, and expiry context are now available to the pricer and heatmap.")
