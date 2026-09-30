"""
STAUNT — Production Real-Time Currency Converter Engine
Fetches legitimate live and verified exchange rates via open financial APIs:
1. Primary: Open Exchange Rates (ExchangeRate-API free public endpoint)
2. Fallback: Frankfurter API (European Central Bank reference rates)
Zero API key required; strictly uses official published rates with timestamping and responsible caching.
"""
import time
import re
import logging
import requests

logger = logging.getLogger("CurrencyEngine")

# Supported currency dictionary with symbols, names and aliases
CURRENCY_MAP = {
    "USD": {"name": "United States Dollar", "symbol": "$", "aliases": ["usd", "dollar", "dollars", "$", "us dollar", "us dollars", "buck", "bucks"]},
    "INR": {"name": "Indian Rupee", "symbol": "₹", "aliases": ["inr", "rupee", "rupees", "rs", "₹", "in rupee", "indian rupee", "indian rupees"]},
    "EUR": {"name": "Euro", "symbol": "€", "aliases": ["eur", "euro", "euros", "€"]},
    "GBP": {"name": "British Pound", "symbol": "£", "aliases": ["gbp", "pound", "pounds", "sterling", "£", "british pound", "british pounds"]},
    "JPY": {"name": "Japanese Yen", "symbol": "¥", "aliases": ["jpy", "yen", "¥", "japanese yen"]},
    "CAD": {"name": "Canadian Dollar", "symbol": "CA$", "aliases": ["cad", "c$", "canadian dollar", "canadian dollars"]},
    "AUD": {"name": "Australian Dollar", "symbol": "A$", "aliases": ["aud", "a$", "australian dollar", "australian dollars"]},
    "AED": {"name": "UAE Dirham", "symbol": "AED", "aliases": ["aed", "dirham", "dirhams", "uae dirham", "dhs"]},
    "CNY": {"name": "Chinese Yuan", "symbol": "¥", "aliases": ["cny", "yuan", "rmb", "chinese yuan", "renminbi"]},
    "CHF": {"name": "Swiss Franc", "symbol": "CHF", "aliases": ["chf", "franc", "francs", "swiss franc", "swiss francs"]},
    "SGD": {"name": "Singapore Dollar", "symbol": "SG$", "aliases": ["sgd", "singapore dollar", "singapore dollars"]},
    "NZD": {"name": "New Zealand Dollar", "symbol": "NZ$", "aliases": ["nzd", "new zealand dollar"]},
    "HKD": {"name": "Hong Kong Dollar", "symbol": "HK$", "aliases": ["hkd", "hong kong dollar"]},
    "KRW": {"name": "South Korean Won", "symbol": "₩", "aliases": ["krw", "won", "₩", "south korean won"]},
    "BRL": {"name": "Brazilian Real", "symbol": "R$", "aliases": ["brl", "real", "reais", "brazilian real"]},
    "ZAR": {"name": "South African Rand", "symbol": "R", "aliases": ["zar", "rand", "south african rand"]},
    "THB": {"name": "Thai Baht", "symbol": "฿", "aliases": ["thb", "baht", "฿", "thai baht"]},
    "RUB": {"name": "Russian Ruble", "symbol": "₽", "aliases": ["rub", "ruble", "rubles", "₽", "russian ruble"]},
    "SAR": {"name": "Saudi Riyal", "symbol": "SAR", "aliases": ["sar", "riyal", "riyals", "saudi riyal"]},
    "MYR": {"name": "Malaysian Ringgit", "symbol": "RM", "aliases": ["myr", "ringgit", "malaysian ringgit"]},
    "IDR": {"name": "Indonesian Rupiah", "symbol": "Rp", "aliases": ["idr", "rupiah", "indonesian rupiah"]},
    "TRY": {"name": "Turkish Lira", "symbol": "₺", "aliases": ["try", "lira", "₺", "turkish lira"]},
    "SEK": {"name": "Swedish Krona", "symbol": "kr", "aliases": ["sek", "krona", "kronor", "swedish krona"]},
    "NOK": {"name": "Norwegian Krone", "symbol": "kr", "aliases": ["nok", "krone", "kroner", "norwegian krone"]},
    "DKK": {"name": "Danish Krone", "symbol": "kr", "aliases": ["dkk", "danish krone"]},
    "PLN": {"name": "Polish Zloty", "symbol": "zł", "aliases": ["pln", "zloty", "zł", "polish zloty"]},
    "MXN": {"name": "Mexican Peso", "symbol": "MX$", "aliases": ["mxn", "peso", "pesos", "mexican peso"]},
    "ILS": {"name": "Israeli Shekel", "symbol": "₪", "aliases": ["ils", "shekel", "shekels", "₪", "israeli shekel"]},
}

# Alias lookup mapping (lowercase alias -> ISO code)
ALIAS_TO_CODE = {}
for code, meta in CURRENCY_MAP.items():
    ALIAS_TO_CODE[code.lower()] = code
    for alias in meta["aliases"]:
        ALIAS_TO_CODE[alias.lower()] = code

# In-memory rates cache: base_currency -> { "timestamp": float, "time_str": str, "provider": str, "rates": {quote: rate} }
RATES_CACHE = {}
CACHE_TTL = 3600  # 1 hour TTL
HTTP_TIMEOUT = (2.5, 4.0)

# Pooled session
http_session = requests.Session()


def parse_currency_code(token):
    """Normalize a token, currency name or symbol to 3-letter ISO code."""
    if not token:
        return None
    cleaned = token.strip().lower()
    return ALIAS_TO_CODE.get(cleaned)


def parse_currency_query(raw_query):
    """
    Extracts (amount, from_code, to_code) from user search queries.
    Supports formats:
    - 100 USD to INR
    - 50 EUR in INR
    - 1000 INR = USD
    - USD to INR (defaults to 1 USD)
    - 250 GBP to INR
    - $100 to INR
    - €50 to INR
    - convert 100 USD to INR
    - how much is 100 USD in INR
    Returns tuple: (amount, from_code, to_code) or None if not a currency query.
    """
    if not raw_query:
        return None

    query = raw_query.strip()
    if len(query) > 100:
        return None

    # Strip conversational prefixes
    clean_q = re.sub(r"^(?:convert|how\s+much\s+is|what\s+is\s+the\s+exchange\s+rate\s+of|exchange\s+rate|rate\s+of)\s+", "", query, flags=re.I).strip()

    # Pattern 1: Symbol prefixed amount: e.g. "$100 to inr", "€50 in inr", "£250 to inr", "₹1000 to usd"
    sym_match = re.match(r"^([\$\€\£\₹\¥\₩\฿\₽])\s*([\d\.,]+)\s+(?:to|in|into|=)\s+([a-zA-Z\$\€\£\₹\¥\₩\฿\₽\s]+)$", clean_q, re.I)
    if sym_match:
        from_code = parse_currency_code(sym_match.group(1))
        amount_str = sym_match.group(2).replace(",", "")
        to_code = parse_currency_code(sym_match.group(3))
        if from_code and to_code:
            try:
                amount = float(amount_str)
                return amount, from_code, to_code
            except ValueError:
                pass

    # Pattern 2: "<amount> <from_curr> to/in/into/= <to_curr>" (e.g. "100 USD to INR", "50 euros in inr")
    std_match = re.match(r"^([\d\.,]+)\s*([a-zA-Z\$\€\£\₹\¥\₩\฿\₽\s]+?)\s+(?:to|in|into|=)\s+([a-zA-Z\$\€\£\₹\¥\₩\฿\₽\s]+)$", clean_q, re.I)
    if std_match:
        amount_str = std_match.group(1).replace(",", "")
        from_raw = std_match.group(2).strip()
        to_raw = std_match.group(3).strip()
        from_code = parse_currency_code(from_raw)
        to_code = parse_currency_code(to_raw)
        if from_code and to_code:
            try:
                amount = float(amount_str)
                return amount, from_code, to_code
            except ValueError:
                pass

    # Pattern 3: "<from_curr> to <to_curr>" with no explicit amount (e.g. "USD to INR", "EUR to USD")
    no_amt_match = re.match(r"^([a-zA-Z\$\€\£\₹\¥\₩\฿\₽\s]+?)\s+(?:to|in|into|=)\s+([a-zA-Z\$\€\£\₹\¥\₩\฿\₽\s]+)$", clean_q, re.I)
    if no_amt_match:
        from_code = parse_currency_code(no_amt_match.group(1).strip())
        to_code = parse_currency_code(no_amt_match.group(2).strip())
        if from_code and to_code:
            return 1.0, from_code, to_code

    return None


def fetch_live_rates(base_currency):
    """
    Fetch rates for base_currency from primary or fallback open rate provider.
    Returns dict: {"rates": dict, "time_str": str, "provider": str} or None.
    """
    base = base_currency.upper()

    # 1. Primary Provider: Open ExchangeRate-API (Free public endpoint, 160+ currencies)
    try:
        url = f"https://open.er-api.com/v6/latest/{base}"
        resp = http_session.get(url, timeout=HTTP_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("result") == "success" and "rates" in data:
                return {
                    "rates": data["rates"],
                    "time_str": data.get("time_last_update_utc", time.strftime("%a, %d %b %Y %H:%M:%S UTC")),
                    "provider": "ExchangeRate-API"
                }
    except Exception as e:
        logger.warning(f"Primary currency API error ({base}): {type(e).__name__}")

    # 2. Secondary Fallback: European Central Bank (Frankfurter)
    try:
        url = f"https://api.frankfurter.app/latest?from={base}"
        resp = http_session.get(url, timeout=HTTP_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            rates = data.get("rates", {})
            # Include base as 1.0
            rates[base] = 1.0
            date_str = data.get("date", time.strftime("%Y-%m-%d"))
            return {
                "rates": rates,
                "time_str": f"{date_str} (ECB Reference)",
                "provider": "European Central Bank (Frankfurter)"
            }
    except Exception as e:
        logger.warning(f"Fallback currency API error ({base}): {type(e).__name__}")

    return None


def get_exchange_rate(from_code, to_code):
    """
    Get exchange rate between from_code and to_code with caching and stale fallback.
    Returns dict with rate, time_str, provider, is_cached, is_stale, or None.
    """
    from_code = from_code.upper()
    to_code = to_code.upper()

    if from_code == to_code:
        return {
            "rate": 1.0,
            "time_str": time.strftime("%a, %d %b %Y %H:%M:%S UTC"),
            "provider": "Identity (1:1)",
            "is_cached": False,
            "is_stale": False
        }

    now = time.time()
    cache_entry = RATES_CACHE.get(from_code)

    # 1. Fresh Cache hit
    if cache_entry and (now - cache_entry["timestamp"] < CACHE_TTL):
        rates = cache_entry["rates"]
        if to_code in rates:
            return {
                "rate": rates[to_code],
                "time_str": cache_entry["time_str"],
                "provider": cache_entry["provider"],
                "is_cached": True,
                "is_stale": False
            }

    # 2. Fetch fresh live rates
    live_data = fetch_live_rates(from_code)
    if live_data and to_code in live_data["rates"]:
        RATES_CACHE[from_code] = {
            "timestamp": now,
            "time_str": live_data["time_str"],
            "provider": live_data["provider"],
            "rates": live_data["rates"]
        }
        return {
            "rate": live_data["rates"][to_code],
            "time_str": live_data["time_str"],
            "provider": live_data["provider"],
            "is_cached": False,
            "is_stale": False
        }

    # 3. Triangular Cross-Rate via USD if direct base wasn't supported
    if from_code != "USD" and to_code != "USD":
        usd_entry = RATES_CACHE.get("USD")
        usd_live = usd_entry if (usd_entry and now - usd_entry["timestamp"] < CACHE_TTL) else fetch_live_rates("USD")
        if usd_live and "rates" in usd_live:
            rates = usd_live["rates"]
            if from_code in rates and to_code in rates and rates[from_code] > 0:
                rate = rates[to_code] / rates[from_code]
                return {
                    "rate": rate,
                    "time_str": usd_live["time_str"],
                    "provider": usd_live["provider"] + " (Cross-Rate)",
                    "is_cached": bool(usd_entry),
                    "is_stale": False
                }

    # 4. Stale cache fallback (network error / API down)
    if cache_entry and to_code in cache_entry["rates"]:
        logger.warning(f"Using stale currency rates for {from_code}->{to_code}")
        return {
            "rate": cache_entry["rates"][to_code],
            "time_str": cache_entry["time_str"],
            "provider": cache_entry["provider"],
            "is_cached": True,
            "is_stale": True
        }

    return None


def format_currency_value(val):
    """Format currency values cleanly."""
    if val >= 1000:
        return f"{val:,.2f}"
    elif val >= 1:
        return f"{val:,.2f}".rstrip("0").rstrip(".") if f"{val:.2f}".endswith(".00") else f"{val:,.2f}"
    else:
        # Smaller than 1: show up to 4 significant decimals
        return f"{val:.4f}".rstrip("0").rstrip(".")


def convert_currency_query(raw_query):
    """
    Main evaluation function for currency conversion search queries.
    Returns conversion dictionary if query is a currency conversion request, else None.
    """
    parsed = parse_currency_query(raw_query)
    if not parsed:
        return None

    amount, from_code, to_code = parsed
    rate_info = get_exchange_rate(from_code, to_code)
    if not rate_info:
        return {
            "type": "currency",
            "amount": amount,
            "from_code": from_code,
            "to_code": to_code,
            "error": f"Live exchange rates for {from_code} to {to_code} are temporarily unavailable.",
            "expression": f"{amount:g} {from_code} to {to_code}",
            "result": "Unavailable"
        }

    rate = rate_info["rate"]
    converted_raw = amount * rate
    inverse_rate = (1.0 / rate) if rate > 0 else 0.0

    from_meta = CURRENCY_MAP.get(from_code, {"name": from_code, "symbol": from_code})
    to_meta = CURRENCY_MAP.get(to_code, {"name": to_code, "symbol": to_code})

    formatted_amount = f"{amount:,.2f}".rstrip("0").rstrip(".") if float(amount).is_integer() else f"{amount:,.2f}"
    formatted_converted = format_currency_value(converted_raw)

    return {
        "type": "currency",
        "amount": amount,
        "from_code": from_code,
        "from_name": from_meta["name"],
        "from_symbol": from_meta["symbol"],
        "to_code": to_code,
        "to_name": to_meta["name"],
        "to_symbol": to_meta["symbol"],
        "rate": round(rate, 6),
        "inverse_rate": round(inverse_rate, 6),
        "converted_amount": round(converted_raw, 4),
        "formatted_expression": f"{formatted_amount} {from_meta['name']} =",
        "formatted_result": f"{formatted_converted} {to_meta['name']}",
        "compact_result": f"{to_meta['symbol']}{formatted_converted}",
        "rate_text": f"1 {from_code} = {rate:,.4f} {to_code}",
        "inverse_rate_text": f"1 {to_code} = {inverse_rate:,.4f} {from_code}",
        "timestamp": rate_info["time_str"],
        "provider": rate_info["provider"],
        "is_cached": rate_info["is_cached"],
        "is_stale": rate_info["is_stale"],
        "disclaimer": "Indicative exchange rate only. Commercial bank fees, card margins, and remittance charges may vary."
    }
