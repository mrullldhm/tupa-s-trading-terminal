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


# Versions screened in a study outside the ledger (only the leads were re-run through the CLI). "Best of N" must
# count them all: strategy -> versions tried on dev.
SCREENED = {"cbr": 1728, "rlm": 13882}  # rlm: 13,824 grid + 58 session windows
CBR_WINDOWS = {"asia_utc": "Asia 01:00-02:00 UTC", "globex": "18:00-19:00 Chicago", "london": "09:00-10:00 London",
               "ny": "09:00-10:00 Chicago", "rth": "09:30-10:30 Chicago", "eia": "Wed 10:30-11:30 Chicago"}
CBR_CONTEXT = {"fh": "first-hour sweep", "reb": "no sweep", "reb30": "30m sweep"}
CBR_BIAS = {"none": "no bias", "body": "hour-candle bias", "engulf": "engulfing bias", "struct": "1h swing bias"}
CBR_TARGET = {"mid": "target 50% of the move", "r1.5": "1.5R target", "r2": "2R target"}

LEVEL_FAMILIES = {"pd": "previous day", "pw": "previous week", "sw4h": "4h swings", "sw1d": "daily swings",
                  "all": "all four level sets", "sw": "4h + daily swings", "nopd": "all but previous day"}
PD_SWING = {"P1": "P1 higher-TF trend", "P2a": "P2-a HL break", "P2b": "P2-b LH reclaim",
            "P3a": "P3-a manipulation candle", "P3b": "P3-b manipulation + reclaim"}


def variant_label(strategy: str, p: dict) -> str:
    """Short human label for one parameter combination (only the parameters that vary in the trial budget)."""
    label = _base_label(strategy, p)
    if p.get("fills"):
        label += " · strict fills"
    return label


def _base_label(strategy: str, p: dict) -> str:
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
    if strategy == "purple_levels":
        return f"{p['tf']} · {LEVEL_FAMILIES[p['levels']]}"
    if strategy == "pd_swing":
        return f"{p['tf']}/{p['ctx']} · {PD_SWING[p['variant']]}"
    if strategy == "swing_point_manipulation":
        swings = "outside-candle high ignored" if p["outside"] == "skip" else "strict swings"
        wait = " · waits one 15m candle" if p["confirm"] else ""
        tp = "" if p["tp"] == "swing" else f" · target {p['tp']} ticks"
        return f"stop ≤{p['risk']} ticks · {swings}{wait}{tp}"
    if strategy == "juda_swing_point":
        stop = "manipulation" if p["stop"] == "manip" else "confirmation"
        cancel = "lower high/low cancel" if p["cancel"] == "lhll" else "target-touch cancel"
        return f"{stop} low stop · {cancel} · {p['tp']}-tick target"
    if strategy == "ghost_box":
        entry = "limit at the wall" if p["entry"] == "wall" else "limit at the close"
        target = "box middle" if p["target"] == "mid" else "opposite wall"
        return f"{entry} · target {target}"
    if strategy == "cbr":
        tries = "1 try a day" if p["attempts"] == 1 else "2 tries a day"
        return (f"{CBR_WINDOWS[p['window']]} · {CBR_CONTEXT[p['context']]} · {CBR_BIAS[p['bias']]} · "
                f"{CBR_TARGET[p['target']]} · {tries}")
    if strategy == "rlm":
        return rlm_label(p)
    if strategy == "purple_levels_rth":
        return f"{p['tf']} · {LEVEL_FAMILIES[p['levels']]} · 08:30–13:30 Chicago"
    return ", ".join(f"{k}={v}" for k, v in p.items())


RLM_ENTRY = {"close": "limit at the close", "band": "limit at the level"}
RLM_STOP = {"wick": "stop past the wick", "band": "stop past the level"}
RLM_SESSION = {"all": "all hours", "rth": "08:30-13:30 Chicago"}
RLM_CLOCK = {"ct": "Chicago", "myt": "Malaysia", "ldn": "London"}
RLM_EXIT = {"r1": "1R target", "r2": "2R target", "r3": "3R target", "be3": "3R target, break-even after 1R"}


def rlm_label(p: dict) -> str:
    weight = "timeframe-weighted swings" if p["weight"] == "tf" else "equal-weight swings"
    session = RLM_SESSION.get(p["session"])
    if session is None:  # "<clock>:<a>-<b>": candles opening in hours a..b on that clock
        clock, _, span = p["session"].partition(":")
        a, b = span.split("-")
        session = f"candles opening {a}:00-{b}:00 {RLM_CLOCK[clock]}"
    return (f"{p['sig_tf']} candles · {weight} · level score ≥{p['score']} · {RLM_ENTRY[p['entry']]} · "
            f"{RLM_STOP[p['stop']]} · {RLM_EXIT[p['exit']]} · {session}")


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
                # Tiny runs have no ratio (0 trades) or no finished Combine attempt: show 0, which fails the check.
                "profit_factor": clean(float(r["profit_factor"])) or 0.0,
                "win_rate": clean(float(r["win_rate"])) or 0.0,
                "max_drawdown": clean(float(r["max_drawdown"])) or 0.0,
                "pass_rate": clean(float(r["pass_rate"])) or 0.0,
                "seq_passes": int(r["seq_passes"]),
                "seq_fails": int(r["seq_fails"]),
                "cost_per_pass": clean(float(r["seq_cost_per_pass_usd"])),
                "years_positive": pos,
                "years_total": len(years),
                "best_of": max(tried[(r["strategy"], r["period"])],
                               SCREENED.get(r["strategy"], 0) if r["period"] == "dev" else 0),
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
