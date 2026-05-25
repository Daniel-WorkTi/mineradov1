#!/usr/bin/env python3
"""
CLI JSON para Google Trends (pytrends).
Uso: python3 services/google_trends_cli.py --keyword "drone" --geo PT [--compare keyword2]

Saída: uma linha JSON em stdout (normalizado para o Node).
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any


def _safe_float(x: Any) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def _series_to_points(series) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if series is None or len(series) == 0:
        return out
    for idx, val in series.items():
        ts = idx.isoformat() if hasattr(idx, "isoformat") else str(idx)
        out.append({"date": ts, "value": _safe_float(val)})
    return out[-52:]  # últimos ~52 pontos para payload menor


def run_trends(keyword: str, geo: str, timeframe: str, compare: str | None) -> dict[str, Any]:
    try:
        from pytrends.request import TrendReq
    except ImportError:
        return {
            "ok": False,
            "source": "pytrends",
            "error": "pytrends_not_installed",
            "hint": "pip install -r services/requirements-mining.txt",
            "keyword": keyword,
            "geo": geo,
        }

    kw_list = [keyword] + ([compare] if compare else [])
    pytrends = TrendReq(hl="pt-PT", tz=0)
    pytrends.build_payload(kw_list, cat=0, timeframe=timeframe, geo=geo or "", gprop="")

    iot = pytrends.interest_over_time()
    interest_points: list[dict[str, Any]] = []
    interest_avg = 0.0
    interest_latest = 0.0

    if iot is not None and len(iot) > 0 and keyword in iot.columns:
        s = iot[keyword]
        interest_points = _series_to_points(s)
        vals = [_safe_float(v) for v in s.tolist()]
        interest_avg = sum(vals) / len(vals) if vals else 0.0
        interest_latest = vals[-1] if vals else 0.0

    related_top: list[dict[str, Any]] = []
    related_rising: list[dict[str, Any]] = []
    try:
        rel = pytrends.related_queries()
        if rel and keyword in rel and rel[keyword]:
            top = rel[keyword].get("top")
            rising = rel[keyword].get("rising")
            if top is not None and len(top) > 0:
                for _, row in top.head(10).iterrows():
                    related_top.append(
                        {"query": str(row.get("query", "")), "value": _safe_float(row.get("value", 0))}
                    )
            if rising is not None and len(rising) > 0:
                for _, row in rising.head(10).iterrows():
                    related_rising.append(
                        {"query": str(row.get("query", "")), "value": _safe_float(row.get("value", 0))}
                    )
    except Exception as e:  # noqa: BLE001
        related_top = []
        related_rising = [{"note": "related_queries_failed", "error": str(e)[:120]}]

    momentum = 0.0
    if len(interest_points) >= 4:
        early = sum(p["value"] for p in interest_points[:4]) / 4
        late = sum(p["value"] for p in interest_points[-4:]) / 4
        momentum = late - early

    return {
        "ok": True,
        "source": "pytrends",
        "keyword": keyword,
        "compare": compare,
        "geo": geo,
        "timeframe": timeframe,
        "interestOverTime": interest_points,
        "interestAvg": round(interest_avg, 2),
        "interestLatest": round(interest_latest, 2),
        "momentum": round(momentum, 2),
        "relatedQueriesTop": related_top,
        "relatedQueriesRising": related_rising,
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--keyword", required=True)
    p.add_argument("--geo", default="PT")
    p.add_argument("--timeframe", default="today 3-m")
    p.add_argument("--compare", default=None)
    args = p.parse_args()
    data = run_trends(args.keyword.strip(), args.geo.strip(), args.timeframe.strip(), args.compare)
    sys.stdout.write(json.dumps(data, ensure_ascii=False))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
