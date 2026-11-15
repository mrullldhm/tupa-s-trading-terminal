"""Export tester results to the site: ../results + ../docs -> web/src/data/research.json.

Copies numbers; never re-runs a backtest. Allowlist: ledger stats, strategy status lines, and per-variant
sums of net P&L by month and by year (no prices, no per-trade rows). Run from the repo root:
    .venv/bin/python web/tools/export_web.py
"""

from __future__ import annotations

import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from cltester.config import COMBINE_50K, FEE_ROUND_TURN, LEDGER, PERIODS, RESULTS  # noqa: E402
from cltester.strategy import load  # noqa: E402

OUT = ROOT / "web" / "src" / "data" / "research.json"
DOCS = ROOT / "docs" / "strategies"

# Dev gates from docs/PROTOCOL.md. Kept here so the site shows the same bar the tester uses.
GATES = {"trades": 200, "profit_factor": 1.25, "years_positive": 0.70, "pass_rate": 0.50, "cost_per_pass": 500.0}


def variant_label(strategy: str, p: dict) -> str:
    """Short human label for one parameter combination (only the parameters that vary in the trial budget)."""
    if strategy == "xtley_gap":
        return f"{p['tf']} · {'trailing stop' if p['trail'] else 'fixed stop'}"
    if strategy in ("swapnil_momentum", "swapnil_hm", "purple_pa"):
        return f"{p['tf']} candles"
    if strategy == "scribd_supertrend":
        return "trailing exit" if p["exit"] == "trail" else "fixed 15-point target"
    if strategy == "ict_ea":
        return "all components (score 7)" if p["min_conf"] >= 7 else "source settings"
    if strategy == "swing_point_failure":
        target = int(p["risk"] * p["rr"])
        return f"{p['swing_tf']} swings · stop ≤{p['risk']} / target {target} ticks · tie {p['tie']}"
    if strategy == "swing_point_failure_reversal":
        target = int(p["risk"] * p["rr"])
        sl = "setup's 1m/5m chart" if p["sl_tf"] == "pullback" else f"{p['sl_tf']} chart"
        return f"stop ≤{p['risk']} / target {target} ticks · stop from {sl} swings"
    if strategy == "swing_point_manipulation":
        swings = "outside-candle high ignored" if p["outside"] == "skip" else "strict swings"
        wait = " · waits one 15m candle" if p["confirm"] else ""
        tp = "" if p["tp"] == "swing" else f" · target {p['tp']} ticks"
        return f"stop ≤{p['risk']} ticks · {swings}{wait}{tp}"
    return ", ".join(f"{k}={v}" for k, v in p.items())


def status_line(strategy: str) -> dict:
    text = (DOCS / strategy / "README.md").read_text()
    m = re.search(r"^Status:\s*(\w+)\s*(?:\((.*)\))?", text, re.M)
    if not m:
        raise SystemExit(f"{strategy}: no Status line")
    state, why = m.group(1), m.group(2) or ""
    date, _, reason = why.partition(":")
    return {"state": state, "date": date.strip(), "reason": reason.strip()}


def clean(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def aggregates(strategy: str, run_hash: str, period: str) -> dict:
    trades = pd.read_csv(RESULTS / strategy / f"{period}_{run_hash}.csv", usecols=["trading_day", "net", "reason"])
    day = pd.to_datetime(trades["trading_day"])
    by_year = trades.groupby(day.dt.year)["net"].sum()
    by_month = trades.groupby(day.dt.to_period("M"))["net"].sum()
    return {
        "years": [{"year": int(y), "net": round(float(v), 2)} for y, v in by_year.items()],
        "equity": [{"month": str(m), "net": round(float(v), 2)} for m, v in by_month.items()],
        "exits": {str(k): int(v) for k, v in trades["reason"].value_counts().items()},
    }


def main() -> None:
    ledger = pd.read_csv(LEDGER)
    # Rows from before a parameter was added get its default, so the same version is one version on the site.
    defaults = {name: load(name).PARAMS for name in ledger["strategy"].unique()}
    ledger["params"] = [json.dumps({**defaults[n], **json.loads(q)}, sort_keys=True)
                        for n, q in zip(ledger["strategy"], ledger["params"], strict=True)]
    ledger["key"] = ledger["strategy"] + "|" + ledger["period"] + "|" + ledger["params"]
    tried = ledger.groupby(["strategy", "period"])["params"].nunique().to_dict()

    variants = []
    for _, r in ledger.groupby("key").tail(1).iterrows():
        params = json.loads(r["params"])
        agg = aggregates(r["strategy"], r["hash"], r["period"])
        years = agg["years"]
        pos = sum(1 for y in years if y["net"] > 0)
        variants.append(
            {
                "strategy": r["strategy"],
                "label": variant_label(r["strategy"], params),
                "hash": r["hash"],
                "period": r["period"],
                "run_utc": r["utc"],
                "params": params,
                "trades": int(r["trades"]),
                "net": clean(float(r["net"])),
                "profit_factor": clean(float(r["profit_factor"])),
                "win_rate": clean(float(r["win_rate"])),
                "max_drawdown": clean(float(r["max_drawdown"])),
                "pass_rate": clean(float(r["pass_rate"])),
                "seq_passes": int(r["seq_passes"]),
                "seq_fails": int(r["seq_fails"]),
                "cost_per_pass": clean(float(r["seq_cost_per_pass_usd"])),
                "years_positive": pos,
                "years_total": len(years),
                "best_of": tried[(r["strategy"], r["period"])],
                **agg,
            }
        )

    strategies = sorted({v["strategy"] for v in variants})
    out = {
        "exported_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ledger_rows": len(ledger),
        "first_run_utc": ledger["utc"].min(),
        "last_run_utc": ledger["utc"].max(),
        "periods": {k: {"start": a, "end": b} for k, (a, b) in PERIODS.items() if k != "all"},
        "gates": GATES,
        "combine": {
            "name": COMBINE_50K.name,
            "start_balance": COMBINE_50K.start_balance,
            "profit_target": COMBINE_50K.profit_target,
            "max_loss": COMBINE_50K.max_loss,
            "consistency": COMBINE_50K.consistency,
            "max_contracts": COMBINE_50K.max_contracts,
            "monthly_fee": COMBINE_50K.monthly_fee,
            "reset_fee": COMBINE_50K.reset_fee,
            "fee_round_turn": FEE_ROUND_TURN,
        },
        "strategies": [{"id": s, "status": status_line(s)} for s in strategies],
        "variants": variants,
    }
    OUT.write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(strategies)} strategies, {len(variants)} variants, {len(ledger)} runs")


if __name__ == "__main__":
    main()
