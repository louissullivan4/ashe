from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import httpx
import os
import sqlite3
import json
import random

STOCK_API_KEY = os.getenv("STOCK_API_KEY")
if not STOCK_API_KEY:
    raise RuntimeError("Please set the STOCK_API_KEY environment variable")

STOCK_BASE_URL = "https://www.alphavantage.co/query"


DB_PATH = os.getenv("CACHE_DB", "cache.db")
db_dir = os.path.dirname(DB_PATH)
if db_dir and not os.path.exists(db_dir):
    os.makedirs(db_dir, exist_ok=True)

_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_cursor = _conn.cursor()
_cursor.execute("""
CREATE TABLE IF NOT EXISTS time_series_cache (
    symbol TEXT,
    function TEXT,
    fetched_at TEXT,
    data TEXT,
    PRIMARY KEY(symbol, function)
)
""")
_conn.commit()

def get_cached(symbol: str, function: str) -> Optional[Dict[str, Any]]:
    _cursor.execute(
        "SELECT fetched_at, data FROM time_series_cache WHERE symbol=? AND function=?",
        (symbol, function)
    )
    row = _cursor.fetchone()
    if not row:
        return None
    fetched_at = datetime.fromisoformat(row[0])
    if datetime.now() - fetched_at > timedelta(hours=24):
        return None
    return json.loads(row[1])

def set_cached(symbol: str, function: str, data: Dict[str, Any]) -> None:
    now = datetime.now().isoformat()
    payload = json.dumps(data)
    _cursor.execute("""
        INSERT INTO time_series_cache(symbol,function,fetched_at,data)
        VALUES(?,?,?,?)
        ON CONFLICT(symbol,function) DO UPDATE SET
          fetched_at=excluded.fetched_at,
          data=excluded.data
    """, (symbol, function, now, payload))
    _conn.commit()


stock_router = APIRouter(
    prefix="/stock",
    tags=["stock"]
)

class TimeSeriesPoint(BaseModel):
    date: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

class FutureResponse(BaseModel):
    symbol: str
    years: int
    basis: str
    contribution_per_period: float
    periods_per_year: int
    annual_return_used: float = Field(..., description="Annual rate used, in decimal")
    total_contributions: float
    projected_value: Optional[float] = Field(
        None, description="Lump-sum future value when output='total'"
    )
    annual_balances: Optional[Dict[int, float]] = Field(
        None, description="Year-by-year balances when output='annual'"
    )

def parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")

async def fetch_time_series(symbol: str, function: str, outputsize: str) -> Dict[str, Dict[str, str]]:
    cached = get_cached(symbol, function)
    if cached:
        return cached

    params = {
        "function": function,
        "symbol": symbol,
        "apikey": STOCK_API_KEY,
        "outputsize": outputsize
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(STOCK_BASE_URL, params=params)
        data = resp.json()
    if resp.status_code != 200 or "Error Message" in data:
        raise HTTPException(status_code=502, detail=data.get("Error Message", "Failed to fetch data"))

    ts_key = next((k for k in data if "Time Series" in k), None)
    if ts_key is None:
        raise HTTPException(status_code=500, detail="Time series data missing in API response")

    series = data[ts_key]
    set_cached(symbol, function, series)
    return series

def filter_series(
    series: Dict[str, Dict[str, str]],
    start_date: Optional[datetime],
    end_date: Optional[datetime]
) -> List[TimeSeriesPoint]:
    points: List[TimeSeriesPoint] = []
    for date_str, vals in series.items():
        dt = parse_date(date_str)
        if start_date and dt < start_date:
            continue
        if end_date and dt > end_date:
            continue
        points.append(TimeSeriesPoint(
            date=dt,
            open=float(vals["1. open"]),
            high=float(vals["2. high"]),
            low=float(vals["3. low"]),
            close=float(vals["4. close"]),
            volume=int(vals["5. volume"])
        ))
    points.sort(key=lambda p: p.date)
    return points

@stock_router.get(
    "/history",
    response_model=List[TimeSeriesPoint],
    summary="Fetch OHLCV history for a given symbol (cached 24h)"
)
async def get_stock_history(
    interval: str = Query(
        "monthly",
        regex="^(daily|weekly|monthly)$",
        description="One of daily, weekly or monthly (defaults to monthly)"
    ),
    symbol: str = Query(..., description="Ticker symbol, e.g. VUAA.DE"),
    outputsize: str = Query(
        "full",
        regex="^(compact|full)$",
        description="compact (last 100) or full (all history), defaults to full"
    ),
    start_date: Optional[datetime] = Query(
        None,
        description="Start date filter, format YYYY-MM-DD; defaults to earliest data"
    ),
    end_date: Optional[datetime] = Query(
        None,
        description="End date filter, format YYYY-MM-DD; defaults to latest data"
    )
):
    func_map = {
        "daily": "TIME_SERIES_DAILY",
        "weekly": "TIME_SERIES_WEEKLY",
        "monthly": "TIME_SERIES_MONTHLY"
    }
    series = await fetch_time_series(symbol, func_map.get(interval, "TIME_SERIES_MONTHLY"), outputsize)
    return filter_series(series, start_date, end_date)

@stock_router.get(
    "/future",
    response_model=FutureResponse,
    summary="Project future value of regular contributions (uses cached history)"
)
async def project_future_value(
    symbol: str = Query(..., description="Ticker symbol, e.g. VUAA.DE"),
    years: int = Query(5, gt=0, description="Number of years to project"),
    amount: float = Query(100.0, gt=0, description="Amount invested each interval"),
    basis: str = Query(
        "monthly",
        regex="^(weekly|monthly)$",
        description="Contribution frequency; weekly or monthly"
    ),
    annual_return: Optional[float] = Query(
        None,
        description="Override historical annual return (decimal, e.g. 0.07)"
    ),
    output: str = Query(
        "total",
        regex="^(total|annual)$",
        description="`total` for end-value summary, `annual` for per-year breakdown"
    )
) -> FutureResponse:
    raw = await fetch_time_series(symbol, "TIME_SERIES_MONTHLY", "full")
    series = filter_series(raw, None, None)
    if len(series) < 2:
        raise HTTPException(502, "Not enough data to compute growth rate")

    first, last = series[0], series[-1]
    total_years_hist = (last.date - first.date).days / 365.0
    hist_cagr = (last.close / first.close) ** (1 / total_years_hist) - 1.0

    r = annual_return if annual_return is not None else hist_cagr
    n = 52 if basis == "weekly" else 12
    periodic_r = (1 + r) ** (1 / n) - 1
    N = years * n

    fv_total = amount * N if periodic_r == 0 else amount * (((1 + periodic_r) ** N - 1) / periodic_r)
    fv_total = round(fv_total, 2)
    invested = round(amount * N, 2)

    if output == "annual":
        breakdown: Dict[int, float] = {}
        for y in range(1, years + 1):
            Ny = y * n
            fv_y = amount * Ny if periodic_r == 0 else amount * (((1 + periodic_r) ** Ny - 1) / periodic_r)
            breakdown[y] = round(fv_y, 2)
        return FutureResponse(
            symbol=symbol,
            years=years,
            basis=basis,
            contribution_per_period=amount,
            periods_per_year=n,
            annual_return_used=round(r, 4),
            total_contributions=invested,
            annual_balances=breakdown
        )

    return FutureResponse(
        symbol=symbol,
        years=years,
        basis=basis,
        contribution_per_period=amount,
        periods_per_year=n,
        annual_return_used=round(r, 4),
        total_contributions=invested,
        projected_value=fv_total
    )


def insert_fake_data(
    symbol: str,
    function: str,
    periods: int = 24,
    interval: str = "monthly"
) -> None:
    """
    Generate fake time-series data and insert into the cache.
    - `symbol`: your ticker, e.g. "VUAA.DE"
    - `function`: e.g. "TIME_SERIES_MONTHLY", "TIME_SERIES_WEEKLY", or "TIME_SERIES_DAILY"
    - `periods`: how many points back from today (default 24)
    - `interval`: "monthly", "weekly", or "daily"
    """
    now = datetime.now()
    series: Dict[str, Dict[str, str]] = {}

    for i in range(periods):
        if interval == "monthly":
            dt = now - timedelta(days=30 * i)
        elif interval == "weekly":
            dt = now - timedelta(weeks=i)
        else:  # daily
            dt = now - timedelta(days=i)

        date_str = dt.strftime("%Y-%m-%d")
        base = 100 + i * 0.5
        open_p = base + random.uniform(-1, 1)
        high = open_p + random.uniform(0, 2)
        low = max(0, open_p - random.uniform(0, 2))
        close = low + random.uniform(0, high - low)
        volume = random.randint(1000, 10000)

        series[date_str] = {
            "1. open": f"{open_p:.2f}",
            "2. high": f"{high:.2f}",
            "3. low":  f"{low:.2f}",
            "4. close":f"{close:.2f}",
            "5. volume": str(volume)
        }

    set_cached(symbol, function, series)
    print(f"Inserted {periods} fake points for {symbol} / {function}")
    
@stock_router.get(
    "/refresh",
    summary="Force-refresh the time-series cache for a symbol + interval",
    description="Deletes the cached entry and re-fetches from Alpha Vantage immediately.",
    include_in_schema=False
)
async def refresh_cache(
    symbol: str = Query(..., description="Ticker symbol, e.g. VUAA.DE"),
    interval: str = Query(
        "monthly",
        regex="^(daily|weekly|monthly)$",
        description="Which series to refresh: daily, weekly or monthly"
    ),
    outputsize: str = Query(
        "full",
        regex="^(compact|full)$",
        description="Use 'compact' or 'full' when re-fetching"
    )
):
    func_map = {
        "daily": "TIME_SERIES_DAILY",
        "weekly": "TIME_SERIES_WEEKLY",
        "monthly": "TIME_SERIES_MONTHLY"
    }
    func = func_map.get(interval)
    _cursor.execute(
        "DELETE FROM time_series_cache WHERE symbol=? AND function=?",
        (symbol, func)
    )
    _conn.commit()
    series = await fetch_time_series(symbol, func, outputsize)
    return {
        "message": "Cache refreshed",
        "symbol": symbol,
        "interval": interval,
        "points_cached": len(series)
    }