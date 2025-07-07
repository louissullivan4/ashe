from contextlib import asynccontextmanager
import yaml
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse

from stock import stock_router, insert_fake_data

@asynccontextmanager
async def lifespan(app: FastAPI):
    schema = get_openapi(
        title="Ashe API",
        version="0.0.1",
        description="Investment tracker tool called Ashe",
        routes=app.routes,
    )
    with open("openapi.yaml", "w") as f:
        yaml.dump(schema, f, sort_keys=False)
    yield

app = FastAPI(
    title="Ashe API",
    description="Investment tracker tool called Ashe",
    version="0.0.1",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stock_router)

@app.get("/", include_in_schema=False)
def root():
    return "Hi"

@app.get(
    "/stock/seed-fake",
    summary="Seed the time-series cache with fake data",
    description="Generate and cache fake OHLCV data for testing purposes.",
    include_in_schema=False
)
def seed_fake_data(
    symbol: str = Query(..., description="Ticker symbol, e.g. VUAA.DE"),
    function: str = Query(
        "TIME_SERIES_MONTHLY",
        regex="^TIME_SERIES_(DAILY|WEEKLY|MONTHLY)$",
        description="Alpha Vantage function name: TIME_SERIES_DAILY, TIME_SERIES_WEEKLY, or TIME_SERIES_MONTHLY"
    ),
    periods: int = Query(24, gt=0, description="Number of data points to generate"),
    interval: str = Query(
        "monthly",
        regex="^(daily|weekly|monthly)$",
        description="Interval for date spacing of fake data"
    )
):
    insert_fake_data(symbol, function, periods=periods, interval=interval)
    return {
        "message": f"Inserted {periods} fake points for {symbol} / {function}"
    }
