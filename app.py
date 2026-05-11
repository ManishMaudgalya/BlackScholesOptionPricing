import streamlit as st

st.set_page_config(
    page_title="Black-Scholes Pricer",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Global styles ──────────────────────────────────────────────────────────────
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600&display=swap');

    html, body, [class*="css"] {
        font-family: 'IBM Plex Sans', sans-serif;
    }
    h1, h2, h3 {
        font-family: 'IBM Plex Mono', monospace;
    }
    .stApp { background-color: #0d0f14; color: #e2e8f0; }

    /* Sidebar */
    section[data-testid="stSidebar"] {
        background-color: #13161e;
        border-right: 1px solid #1e2330;
    }
    section[data-testid="stSidebar"] * { color: #cbd5e1; }
    section[data-testid="stSidebar"] .stSlider > label,
    section[data-testid="stSidebar"] .stNumberInput > label { color: #94a3b8; font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; }

    /* Metric cards */
    .metric-card {
        background: #13161e;
        border: 1px solid #1e2330;
        border-radius: 10px;
        padding: 22px 26px;
        text-align: center;
    }
    .metric-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
    .metric-value { font-family: 'IBM Plex Mono', monospace; font-size: 2rem; font-weight: 600; }
    .call-color  { color: #34d399; }
    .put-color   { color: #f87171; }
    .greek-value { font-size: 1.3rem; color: #93c5fd; }

    /* Section headers */
    .section-header {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.7rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #475569;
        border-bottom: 1px solid #1e2330;
        padding-bottom: 6px;
        margin: 28px 0 16px;
    }

    /* Hide default streamlit branding */
    #MainMenu, footer { visibility: hidden; }
    </style>
    """,
    unsafe_allow_html=True,
)

pg = st.navigation(
    [
        st.Page("pages/01_pricer.py",  title="Option Pricer",  icon="📊"),
        st.Page("pages/02_heatmap.py", title="Heatmap",        icon="🌡️"),
    ]
)
pg.run()
