from __future__ import annotations

import re
import socket
import uuid
from datetime import date, datetime

import requests
import streamlit as st


ANGELONE_ROOT = "https://apiconnect.angelone.in"

LOGIN_ENDPOINT = "/rest/auth/angelbroking/user/v1/loginByPassword"
QUOTE_ENDPOINT = "/rest/secure/angelbroking/market/v1/quote/"
OPTION_GREEK_ENDPOINT = "/rest/secure/angelbroking/marketData/v1/optionGreek"
SEARCH_SCRIP_ENDPOINT = "/rest/secure/angelbroking/order/v1/searchScrip"

SECURITY_TYPE_EXCHANGES = {
    "Equity": ["NSE", "BSE"],
    "Index": ["NSE", "BSE"],
    "Derivative": ["NFO", "MCX", "CDS"],
}


def _detect_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def _detect_mac_address() -> str:
    raw = uuid.getnode()
    octets = [f"{(raw >> shift) & 0xFF:02x}" for shift in range(40, -1, -8)]
    return ":".join(octets)


def _to_float(value, default: float | None = None) -> float | None:
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_expiry_date(value: str | None) -> date | None:
    if not value:
        return None

    text = str(value).strip()
    for pattern in ("%d%b%Y", "%d%b%y", "%d-%b-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, pattern).date()
        except ValueError:
            continue
    return None


def to_expiry_code(value: str | None) -> str:
    parsed = parse_expiry_date(value)
    if parsed:
        return parsed.strftime("%d%b%Y").upper()
    return str(value or "").strip().upper()


def years_to_expiry(value: str | None) -> float | None:
    parsed = parse_expiry_date(value)
    if not parsed:
        return None

    days = max((parsed - date.today()).days, 1)
    return days / 365.0


def normalize_underlying_name(symbol: str | None, fallback: str | None = None) -> str:
    if symbol:
        base = re.split(r"[-_]", symbol.strip())[0]
        if base:
            return base.upper()
    return str(fallback or "").strip().upper()


def _response_payload(response: requests.Response) -> dict:
    response.raise_for_status()
    payload = response.json()

    success = payload.get("status")
    if success is None:
        success = payload.get("success")

    if success is True:
        return payload

    message = payload.get("message") or payload.get("errorcode") or payload.get("errorCode") or "AngelOne request failed."
    if payload.get("data") and isinstance(payload["data"], dict):
        unfetched = payload["data"].get("unfetched") or []
        if unfetched and isinstance(unfetched[0], dict):
            message = unfetched[0].get("message") or message
    raise RuntimeError(message)


def _headers(api_key: str, auth_token: str | None, client_local_ip: str, client_public_ip: str, mac_address: str) -> dict[str, str]:
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": client_local_ip,
        "X-ClientPublicIP": client_public_ip,
        "X-MACAddress": mac_address,
        "X-PrivateKey": api_key,
    }
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    return headers


def _request(path: str, api_key: str, auth_token: str | None, payload: dict | None = None) -> dict:
    response = requests.post(
        f"{ANGELONE_ROOT}{path}",
        json=payload or {},
        headers=_headers(
            api_key=api_key,
            auth_token=auth_token,
            client_local_ip=st.session_state["ao_client_local_ip"],
            client_public_ip=st.session_state["ao_client_public_ip"],
            mac_address=st.session_state["ao_mac_address"],
        ),
        timeout=20,
    )
    return _response_payload(response)


def init_session_state() -> None:
    defaults = {
        "api_connected": False,
        "ao_session": None,
        "ao_api_key": "",
        "ao_client_code": "",
        "ao_password": "",
        "ao_totp": "",
        "ao_client_local_ip": _detect_local_ip(),
        "ao_client_public_ip": _detect_local_ip(),
        "ao_mac_address": _detect_mac_address(),
        "ao_security_type": "Equity",
        "ao_exchange": "NSE",
        "ao_search_query": "SBIN",
        "ao_search_results": [],
        "ao_search_result_index": 0,
        "ao_tradingsymbol": "SBIN-EQ",
        "ao_symboltoken": "3045",
        "ao_underlying_name": "SBIN",
        "ao_expirydate": "",
        "ao_market_snapshot": None,
        "live_data": None,
        "last_updated": None,
        "option_greeks": [],
        "use_live_spot": False,
        "synced_spot": None,
        "synced_volatility": None,
        "synced_time_to_expiry": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def disconnect() -> None:
    for key in ["ao_session", "ao_market_snapshot", "live_data"]:
        st.session_state[key] = None
    st.session_state["api_connected"] = False
    st.session_state["last_updated"] = None
    st.session_state["option_greeks"] = []
    st.session_state["synced_spot"] = None
    st.session_state["synced_volatility"] = None
    st.session_state["synced_time_to_expiry"] = None
    st.session_state["use_live_spot"] = False


def authenticate() -> dict:
    api_key = st.session_state["ao_api_key"].strip()
    client_code = st.session_state["ao_client_code"].strip()
    password = st.session_state["ao_password"].strip()
    totp = st.session_state["ao_totp"].strip()

    if not all([api_key, client_code, password, totp]):
        raise RuntimeError("API key, client code, password, and TOTP are all required.")

    payload = {
        "clientcode": client_code,
        "password": password,
        "totp": totp,
    }
    data = _request(LOGIN_ENDPOINT, api_key=api_key, auth_token=None, payload=payload)
    session = {
        "api_key": api_key,
        "client_code": client_code,
        "jwt_token": data["data"]["jwtToken"],
        "refresh_token": data["data"].get("refreshToken"),
        "feed_token": data["data"].get("feedToken"),
        "logged_in_at": datetime.now().isoformat(timespec="seconds"),
    }
    st.session_state["ao_session"] = session
    st.session_state["api_connected"] = True
    return session


def render_connection_sidebar() -> None:
    st.sidebar.markdown("## AngelOne Session")
    st.sidebar.caption("SmartAPI sessions reset daily. Credentials stay in this browser session only.")

    expanded = not st.session_state["api_connected"]
    with st.sidebar.expander("Credentials", expanded=expanded):
        st.text_input("API Key", key="ao_api_key", type="password")
        st.text_input("Client Code", key="ao_client_code")
        st.text_input("Password / PIN", key="ao_password", type="password")
        st.text_input("TOTP / 2FA Code", key="ao_totp", type="password")

        with st.expander("Advanced SmartAPI Headers", expanded=False):
            st.text_input("Client Local IP", key="ao_client_local_ip")
            st.text_input("Client Public IP", key="ao_client_public_ip")
            st.text_input("MAC Address", key="ao_mac_address")

        connect = st.button("Connect", use_container_width=True, key="ao_connect")
        if connect:
            try:
                session = authenticate()
                st.success("Connected to AngelOne.")
                st.caption(f"JWT session created at {session['logged_in_at']}")
            except Exception as exc:
                disconnect()
                st.error(str(exc))

    if st.session_state["api_connected"] and st.session_state.get("ao_session"):
        session = st.session_state["ao_session"]
        st.sidebar.success(f"Connected as `{session['client_code']}`")
        if st.sidebar.button("Disconnect", use_container_width=True, key="ao_disconnect"):
            disconnect()
            st.rerun()


def render_market_selector_sidebar() -> None:
    st.sidebar.markdown("---")
    st.sidebar.markdown("## Market Focus")

    security_type = st.sidebar.radio(
        "Security Type",
        list(SECURITY_TYPE_EXCHANGES.keys()),
        horizontal=True,
        key="ao_security_type",
    )

    exchanges = SECURITY_TYPE_EXCHANGES[security_type]
    if st.session_state["ao_exchange"] not in exchanges:
        st.session_state["ao_exchange"] = exchanges[0]

    st.sidebar.selectbox("Exchange", exchanges, key="ao_exchange")
    st.sidebar.text_input("Search Scrip", key="ao_search_query", help="Uses AngelOne searchScrip API to resolve the token.")

    if st.sidebar.button("Find Instrument", use_container_width=True, key="ao_find_instrument"):
        try:
            results = search_scrip(
                api_key=st.session_state["ao_api_key"],
                auth_token=(st.session_state.get("ao_session") or {}).get("jwt_token"),
                exchange=st.session_state["ao_exchange"],
                query=st.session_state["ao_search_query"],
            )
            st.session_state["ao_search_results"] = results
            st.session_state["ao_search_result_index"] = 0
            if results:
                best = results[0]
                st.session_state["ao_tradingsymbol"] = best["tradingsymbol"]
                st.session_state["ao_symboltoken"] = best["symboltoken"]
                st.session_state["ao_underlying_name"] = normalize_underlying_name(best["tradingsymbol"], st.session_state["ao_search_query"])
            else:
                st.sidebar.warning("No instruments returned for that query.")
        except Exception as exc:
            st.sidebar.error(str(exc))

    results = st.session_state.get("ao_search_results") or []
    if results:
        labels = [f"{item['tradingsymbol']} · token {item['symboltoken']}" for item in results]
        selected = st.sidebar.selectbox("Matched Instruments", range(len(labels)), format_func=lambda idx: labels[idx], key="ao_search_result_index")
        current = results[selected]
        st.session_state["ao_tradingsymbol"] = current["tradingsymbol"]
        st.session_state["ao_symboltoken"] = current["symboltoken"]
        if not st.session_state["ao_underlying_name"]:
            st.session_state["ao_underlying_name"] = normalize_underlying_name(current["tradingsymbol"], st.session_state["ao_search_query"])

    st.sidebar.text_input("Trading Symbol", key="ao_tradingsymbol")
    st.sidebar.text_input("Symbol Token", key="ao_symboltoken")
    st.sidebar.text_input("Underlying for Greeks", key="ao_underlying_name", help="For optionGreek, pass the underlying stock or index name, e.g. TCS or NIFTY.")
    st.sidebar.text_input("Expiry for Greeks", key="ao_expirydate", help="Examples: 25JAN2024 or 2026-06-26")


def search_scrip(api_key: str, auth_token: str | None, exchange: str, query: str) -> list[dict]:
    if not auth_token:
        raise RuntimeError("Connect to AngelOne before searching instruments.")
    payload = {"exchange": exchange, "searchscrip": query}
    data = _request(SEARCH_SCRIP_ENDPOINT, api_key=api_key, auth_token=auth_token, payload=payload)
    return data.get("data") or []


def fetch_market_quote(api_key: str, auth_token: str, exchange: str, symboltoken: str, mode: str = "FULL") -> dict:
    payload = {"mode": mode, "exchangeTokens": {exchange: [symboltoken]}}
    data = _request(QUOTE_ENDPOINT, api_key=api_key, auth_token=auth_token, payload=payload)
    fetched = (data.get("data") or {}).get("fetched") or []
    if not fetched:
        unfetched = (data.get("data") or {}).get("unfetched") or []
        if unfetched:
            raise RuntimeError(unfetched[0].get("message", "No market data returned."))
        raise RuntimeError("No market data returned.")
    return fetched[0]


def fetch_option_greeks(api_key: str, auth_token: str, underlying: str, expirydate: str) -> list[dict]:
    payload = {"name": underlying, "expirydate": to_expiry_code(expirydate)}
    data = _request(OPTION_GREEK_ENDPOINT, api_key=api_key, auth_token=auth_token, payload=payload)
    rows = data.get("data") or []
    normalized = []
    for row in rows:
        iv_percent = _to_float(row.get("impliedVolatility"), 0.0) or 0.0
        normalized.append(
            {
                "name": row.get("name", underlying),
                "expiry": row.get("expiry", to_expiry_code(expirydate)),
                "strike_price": _to_float(row.get("strikePrice")),
                "option_type": str(row.get("optionType", "")).upper(),
                "delta": _to_float(row.get("delta"), 0.0) or 0.0,
                "gamma": _to_float(row.get("gamma"), 0.0) or 0.0,
                "theta": _to_float(row.get("theta"), 0.0) or 0.0,
                "vega": _to_float(row.get("vega"), 0.0) or 0.0,
                "iv_percent": iv_percent,
                "iv_decimal": iv_percent / 100,
                "trade_volume": _to_float(row.get("tradeVolume"), 0.0) or 0.0,
            }
        )
    return [row for row in normalized if row["strike_price"] is not None]


def pick_greek_row(option_greeks: list[dict], strike: float | None = None, option_type: str | None = None, spot: float | None = None) -> dict | None:
    rows = option_greeks
    if option_type:
        rows = [row for row in rows if row["option_type"] == option_type.upper()]
    if not rows:
        return None

    if strike is not None:
        return min(rows, key=lambda row: abs(row["strike_price"] - strike))
    if spot is not None:
        return min(rows, key=lambda row: abs(row["strike_price"] - spot))
    return rows[0]


def normalize_market_snapshot(exchange: str, tradingsymbol: str, symboltoken: str, payload: dict) -> dict:
    ltp = _to_float(payload.get("ltp"), 0.0) or 0.0
    close = _to_float(payload.get("close"), 0.0) or 0.0
    net_change = _to_float(payload.get("netChange"))
    if net_change is None:
        net_change = ltp - close if close else 0.0
    percent_change = _to_float(payload.get("percentChange"))
    if percent_change is None:
        percent_change = ((net_change / close) * 100) if close else 0.0

    return {
        "exchange": payload.get("exchange", exchange),
        "trading_symbol": payload.get("tradingSymbol", tradingsymbol),
        "symbol_token": str(payload.get("symbolToken", symboltoken)),
        "ltp": ltp,
        "open": _to_float(payload.get("open"), 0.0) or 0.0,
        "high": _to_float(payload.get("high"), 0.0) or 0.0,
        "low": _to_float(payload.get("low"), 0.0) or 0.0,
        "close": close,
        "last_trade_qty": _to_float(payload.get("lastTradeQty"), 0.0) or 0.0,
        "exchange_feed_time": payload.get("exchFeedTime"),
        "exchange_trade_time": payload.get("exchTradeTime"),
        "net_change": net_change,
        "percent_change": percent_change,
        "avg_price": _to_float(payload.get("avgPrice"), 0.0) or 0.0,
        "trade_volume": _to_float(payload.get("tradeVolume"), 0.0) or 0.0,
        "open_interest": _to_float(payload.get("opnInterest"), 0.0) or 0.0,
        "lower_circuit": _to_float(payload.get("lowerCircuit"), 0.0) or 0.0,
        "upper_circuit": _to_float(payload.get("upperCircuit"), 0.0) or 0.0,
        "total_buy_quantity": _to_float(payload.get("totBuyQuan"), 0.0) or 0.0,
        "total_sell_quantity": _to_float(payload.get("totSellQuan"), 0.0) or 0.0,
        "week_52_low": _to_float(payload.get("52WeekLow"), 0.0) or 0.0,
        "week_52_high": _to_float(payload.get("52WeekHigh"), 0.0) or 0.0,
        "depth": payload.get("depth") or {},
    }


def refresh_market_snapshot() -> tuple[dict, list[dict]]:
    session = st.session_state.get("ao_session")
    if not session:
        raise RuntimeError("Connect to AngelOne first.")

    exchange = st.session_state["ao_exchange"].strip()
    tradingsymbol = st.session_state["ao_tradingsymbol"].strip()
    symboltoken = st.session_state["ao_symboltoken"].strip()

    if not all([exchange, tradingsymbol, symboltoken]):
        raise RuntimeError("Exchange, trading symbol, and symbol token are required.")

    quote_payload = fetch_market_quote(
        api_key=session["api_key"],
        auth_token=session["jwt_token"],
        exchange=exchange,
        symboltoken=symboltoken,
        mode="FULL",
    )
    snapshot = normalize_market_snapshot(exchange, tradingsymbol, symboltoken, quote_payload)

    option_greeks: list[dict] = []
    expiry_text = st.session_state.get("ao_expirydate", "").strip()
    underlying = normalize_underlying_name(st.session_state.get("ao_underlying_name"), tradingsymbol)
    if expiry_text and underlying and exchange in {"NSE", "BSE", "NFO"}:
        option_greeks = fetch_option_greeks(
            api_key=session["api_key"],
            auth_token=session["jwt_token"],
            underlying=underlying,
            expirydate=expiry_text,
        )

    atm_row = pick_greek_row(option_greeks, spot=snapshot["ltp"]) if option_greeks else None
    snapshot["underlying"] = underlying
    snapshot["expiry_code"] = to_expiry_code(expiry_text) if expiry_text else ""
    snapshot["atm_option"] = atm_row

    st.session_state["ao_market_snapshot"] = snapshot
    st.session_state["live_data"] = snapshot
    st.session_state["option_greeks"] = option_greeks
    st.session_state["synced_spot"] = snapshot["ltp"]
    st.session_state["synced_volatility"] = atm_row["iv_decimal"] if atm_row else None
    st.session_state["synced_time_to_expiry"] = years_to_expiry(expiry_text)
    st.session_state["last_updated"] = datetime.now().strftime("%H:%M:%S")

    return snapshot, option_greeks
