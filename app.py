import streamlit as st

st.set_page_config(
    page_title="Black-Scholes Option Pricing",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Global styles ──────────────────────────────────────────────────────────────
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600&display=swap');

    :root {
        --bg-main: #08111f;
        --bg-panel: rgba(10, 21, 38, 0.82);
        --bg-panel-strong: rgba(14, 28, 48, 0.96);
        --border-color: rgba(110, 145, 189, 0.16);
        --text-main: #e6edf6;
        --text-muted: #8ea3bc;
        --accent-cyan: #55d6ff;
        --accent-green: #59e0a2;
        --accent-gold: #ffd166;
        --accent-red: #ff8d7c;
    }

    html, body, [class*="css"] {
        font-family: 'IBM Plex Sans', sans-serif;
    }
    h1, h2, h3 {
        font-family: 'IBM Plex Mono', monospace;
    }
    .stApp {
        color: var(--text-main);
        background:
            radial-gradient(circle at top left, rgba(85, 214, 255, 0.16), transparent 28%),
            radial-gradient(circle at top right, rgba(89, 224, 162, 0.13), transparent 24%),
            linear-gradient(180deg, #08111f 0%, #091522 46%, #071018 100%);
    }
    .main .block-container {
        padding-top: 1.8rem;
        padding-bottom: 2.5rem;
    }

    /* Sidebar */
    section[data-testid="stSidebar"] {
        background:
            linear-gradient(180deg, rgba(12, 25, 43, 0.98), rgba(9, 18, 34, 0.98));
        border-right: 1px solid var(--border-color);
        box-shadow: 14px 0 40px rgba(0, 0, 0, 0.18);
    }
    section[data-testid="stSidebar"] * { color: #d7e0eb; }
    section[data-testid="stSidebar"] .stSlider > label,
    section[data-testid="stSidebar"] .stNumberInput > label,
    section[data-testid="stSidebar"] .stTextInput > label,
    section[data-testid="stSidebar"] .stSelectbox > label,
    section[data-testid="stSidebar"] .stRadio > label {
        color: var(--text-muted);
        font-size: 0.78rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    /* Metric cards */
    .metric-card {
        background: linear-gradient(180deg, rgba(12, 24, 42, 0.92), rgba(8, 18, 34, 0.92));
        border: 1px solid var(--border-color);
        border-radius: 18px;
        padding: 22px 26px;
        text-align: center;
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.18);
        backdrop-filter: blur(10px);
    }
    .metric-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
    .metric-value { font-family: 'IBM Plex Mono', monospace; font-size: 2rem; font-weight: 600; }
    .call-color  { color: var(--accent-green); }
    .put-color   { color: var(--accent-red); }
    .greek-value { font-size: 1.3rem; color: #8dc9ff; }

    /* Section headers */
    .section-header {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.7rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #6f88a5;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 6px;
        margin: 28px 0 16px;
    }

    .hero-panel {
        background:
            linear-gradient(135deg, rgba(13, 28, 49, 0.95), rgba(9, 20, 36, 0.92));
        border: 1px solid rgba(119, 183, 255, 0.15);
        border-radius: 24px;
        padding: 22px 24px;
        box-shadow: 0 22px 60px rgba(0, 0, 0, 0.22);
        margin-bottom: 1rem;
    }
    .hero-title {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 1.65rem;
        color: var(--text-main);
        margin: 0 0 0.3rem;
    }
    .hero-subtitle {
        color: var(--text-muted);
        font-size: 0.92rem;
        margin: 0;
    }
    .info-card {
        background: rgba(8, 18, 33, 0.72);
        border: 1px solid var(--border-color);
        border-radius: 18px;
        padding: 16px 18px;
        margin-bottom: 1rem;
    }
    .streamlit-expanderHeader {
        border-radius: 14px;
    }
    .stButton > button,
    .stDownloadButton > button {
        border-radius: 999px;
        border: 1px solid rgba(130, 186, 255, 0.24);
        background: linear-gradient(135deg, rgba(84, 182, 255, 0.18), rgba(68, 235, 170, 0.14));
        color: var(--text-main);
        font-weight: 600;
        padding: 0.52rem 1rem;
        transition: all 140ms ease;
    }
    .stButton > button:hover,
    .stDownloadButton > button:hover {
        border-color: rgba(130, 186, 255, 0.4);
        transform: translateY(-1px);
    }
    .stTextInput input,
    .stNumberInput input,
    .stSelectbox div[data-baseweb="select"] > div,
    .stTextArea textarea {
        background: rgba(8, 18, 33, 0.84) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 14px !important;
        color: var(--text-main) !important;
    }
    .stDataFrame, .stTable {
        border: 1px solid var(--border-color);
        border-radius: 16px;
        overflow: hidden;
    }

    /* Hide default streamlit branding */
    #MainMenu, footer { visibility: hidden; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ── Page Navigation ────────────────────────────────────────────────────────────
pg = st.navigation(
    [
        st.Page("pages/00_market_feed.py", title="Live Market Feed", icon="📡"),
        st.Page("pages/01_pricer.py",      title="Option Pricer",    icon="📊"),
        st.Page("pages/02_heatmap.py",     title="Heatmap",          icon="🌡️"),
    ]
)
pg.run()
