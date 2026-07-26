from __future__ import annotations

from pathlib import Path
from datetime import date, timedelta

import polars as pl


def main() -> None:
    output_dir = Path(__file__).resolve().parents[1] / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / "synthetic_sales_1m.parquet"

    n = 1_000_000
    regions = ["North", "South", "East", "West"]
    markets = ["Enterprise", "SMB", "Consumer"]
    categories = ["Software", "Hardware", "Services", "Training"]
    start_date = date(2024, 1, 1)

    df = pl.DataFrame({
        "order_id": pl.arange(1, n + 1, eager=True),
        "region": [regions[i % len(regions)] for i in range(n)],
        "market": [markets[i % len(markets)] for i in range(n)],
        "category": [categories[i % len(categories)] for i in range(n)],
        "revenue": [(i % 5000) + 100 for i in range(n)],
        "profit": [((i % 5000) + 100) * 0.22 for i in range(n)],
        "sales": [(i % 300) + 1 for i in range(n)],
        "order_date": [start_date + timedelta(days=i % 731) for i in range(n)],
    })

    df.write_parquet(output)
    print(output)


if __name__ == "__main__":
    main()
