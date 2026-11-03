"""Private, read-only chart worker for the Astro dev server. Nothing is written to public/.

Replay the exact exported configuration over its original history, capture the engine's
working brackets, and refuse charts whose fills do not match the saved trade CSV.
Requests and responses are newline-delimited JSON on stdin/stdout.
"""
from __future__ import annotations

import hashlib
import importlib
import json
import math
import sys
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tvtester import engine, ta
from tvtester.config import DEFAULT, TICK
from tvtester.data import Bars, load_bars

STRATEGIES = {"fair_price_reversal", "supertrend_kalman", "tupa_trade"}
CACHE = None


def seconds(time):
    return int(pd.Timestamp(time).timestamp())


def source_config(request):
    name, key = request["strategy"], request["key"]
    if name not in STRATEGIES or request["slippage"] != 0:
        raise ValueError("Unknown strategy or unsupported execution assumptions.")
    doc_path = ROOT / "web/src/data/strategies" / f"{name}.json"
    doc = json.loads(doc_path.read_text())
    if request["generated"] != doc["generated_utc"]:
        raise ValueError("Results changed. Reload this page.")
    module = importlib.import_module(f"strategies.{name}")
    if key.startswith("f1-"):
        variant = key[3:]
        row = doc["features"]["f1"]["variants"].get(variant)
        if row is None:
            raise ValueError("This session has no exported result.")
        params = {**module.VARIANTS[variant], **row["params"]}
        filters = []
        folder = ROOT / "results" / name / variant
    elif key.startswith("f2-"):
        run_id = key[3:]
        row = next((r for r in doc["features"]["f2"]["runs"] if r["run_id"] == run_id and r["periods_year"]), None)
        if row is None:
            raise ValueError("This candidate has no exported daily result.")
        params, filters = row["params"], row["filters"]
        folder = ROOT / "results" / name / "replay" / run_id
    else:
        raise ValueError("Unknown result series.")
    csv = folder / f"trades_slippage{request['slippage']}.csv"
    # The source ledger binds the replay's raw fills to the page's export.
    sources = {s["path"]: s["sha256"] for s in doc["sources"]}
    relative = str(csv.relative_to(ROOT))
    if relative not in sources or hashlib.sha256(csv.read_bytes()).hexdigest() != sources[relative]:
        raise ValueError("The saved trades changed since export. Run npm run export, then reload.")
    summary = row["scenarios"][str(request["slippage"])]
    return module, params, filters, csv, summary, doc


def replay(request):
    global CACHE
    module, params, filters, csv, summary, doc = source_config(request)
    stamp = (request["strategy"], request["key"], request["slippage"], request["generated"],
             tuple((p.name, p.stat().st_mtime_ns, p.stat().st_size) for p in sorted((ROOT / "data/cl1").glob("year=*.parquet"))),
             tuple((str(p), p.stat().st_mtime_ns) for folder in ("strategies", "tvtester")
                   for p in sorted((ROOT / folder).glob("*.py"))))
    if CACHE is None or CACHE[0] != stamp:
        CACHE = None  # release the previous prepared history before allocating another
        start = pd.Timestamp(summary["period_start"])
        end = pd.Timestamp(summary["period_end"]) + pd.Timedelta(minutes=1)
        frame = load_bars(str(start), str(end))
        bars = Bars.from_frame(frame)
        del frame
        strategy = module.STRATEGY(filters=filters, **params)
        paths = {}

        class TraceEngine(engine.Engine):
            def _resolve_one(self, order):
                super()._resolve_one(order)
                if self.pos is None:
                    return
                path = paths.setdefault(self.pos.entry_bar, [])
                levels = (order.stop, order.limit)
                if not path or path[-1][1:] != levels:
                    path.append((self.i, *levels))

        with patch.object(engine, "Engine", TraceEngine):
            result = engine.run(strategy, bars, DEFAULT.with_slippage(request["slippage"]))
        saved = pd.read_csv(csv)
        if len(result.trades) != len(saved):
            raise ValueError("Replay trade count differs from the saved result. Refresh the tester outputs before charting.")
        for trade, row in zip(result.trades, saved.itertuples(), strict=True):
            if (seconds(bars.ts[trade.entry_bar]) != seconds(row.entry_time)
                    or seconds(bars.ts[trade.exit_bar]) != seconds(row.exit_time)
                    or abs(trade.entry_price * TICK - row.entry_price) > 1e-7
                    or abs(trade.exit_price * TICK - row.exit_price) > 1e-7
                    or ("Long" if trade.direction == 1 else "Short") != row.type
                    or trade.exit_reason != row.exit_reason
                    or abs(trade.profit - row.profit) > 0.005):
                raise ValueError("Replay fills differ from the saved trades. No estimated chart will be shown.")
        CACHE = (stamp, bars, strategy, result, paths)
    _, bars, strategy, result, paths = CACHE
    day = pd.Timestamp(request["day"], tz="Asia/Kuala_Lumpur")
    selected = [t for t in result.trades if day <= bars.ts[t.exit_bar] < day + pd.Timedelta(days=1)]
    payload = {"strategy": request["strategy"], "key": request["key"], "day": request["day"],
               "slippage": request["slippage"], "generated_utc": doc["generated_utc"], "timezone": "Asia/Kuala_Lumpur",
               "params": strategy.params, "filters": filters, "candles": [], "lines": [], "trades": [],
               "notes": ["Every replayed fill was checked against the saved trade CSV (side, timestamps, prices, net profit and exit reason).",
                         "Stop and target paths show working order levels, effective from the next bar after an amendment. Stops may fill beyond their level because of gaps.",
                         "Orders and fills are simulated by the tester from one-minute OHLC bars; intraminute tick-by-tick execution is not available."]}
    if not selected:
        return payload
    lo = max(0, min(min(t.signal_bar, t.entry_bar) for t in selected) - 90)
    hi = min(len(bars), max(t.exit_bar for t in selected) + 31)
    # Include the full setup session, including FPR's anchor, even for later entries.
    if hasattr(strategy, "s"):
        anchor = strategy.s.open_minute - 1
        # Search back to the local session's anchor before the earliest signal.
        sig = min(t.signal_bar for t in selected)
        prev = bars.ts[max(0, sig - 1500):sig + 1].tz_convert(strategy.s.tz)
        found = np.flatnonzero((prev.hour * 60 + prev.minute) == anchor)
        if len(found):
            lo = min(lo, max(0, sig - 1500) + int(found[-1]))
    indices = np.arange(lo, hi)
    times = [seconds(t) for t in bars.ts[lo:hi]]
    payload["candles"] = [{"time": time, "open": round(bars.o[i] * TICK, 2), "high": round(bars.h[i] * TICK, 2),
                           "low": round(bars.l[i] * TICK, 2), "close": round(bars.c[i] * TICK, 2)}
                          for i, time in zip(indices, times, strict=True)]

    def add_line(label, values, color="#f9f9f9", pane=0, ticks=True):
        points = []
        for time, value in zip(times, values, strict=True):
            valid = value is not None and math.isfinite(float(value)) and float(value) > -(2 ** 61)
            points.append({"time": time, "value": float(value) * (TICK if ticks else 1) if valid else None})
        payload["lines"].append({"label": label, "color": color, "pane": pane, "points": points})

    for number, trade in enumerate(selected, 1):
        payload["trades"].append({"side": "Long" if trade.direction == 1 else "Short",
                                  "entry_time": seconds(bars.ts[trade.entry_bar]), "exit_time": seconds(bars.ts[trade.exit_bar]),
                                  "entry_price": round(trade.entry_price * TICK, 2), "exit_price": round(trade.exit_price * TICK, 2),
                                  "profit": round(trade.profit, 2), "exit_reason": trade.exit_reason})
        path = paths.get(trade.entry_bar, [])
        stop, target = [], []
        at = 0
        for i in indices:
            while at + 1 < len(path) and path[at + 1][0] <= i:
                at += 1
            active = bool(path) and trade.entry_bar <= i <= trade.exit_bar
            stop.append(path[at][1] if active else None)
            target.append(path[at][2] if active else None)
        add_line(f"Stop {number}", stop, "#e7a39d")
        add_line(f"Target {number}", target, "#8fd4c1")
        add_line(f"Entry {number}", [trade.entry_price if trade.entry_bar <= i <= trade.exit_bar else None for i in indices])

    if request["strategy"] == "fair_price_reversal":
        # Anchor is raw body OHLC; swing levels are shown when confirmed, not backdated to the pivot.
        mod = strategy.mod
        _, local_day = importlib.import_module("tvtester.sessions").local_clock(bars.ts, strategy.s.tz)
        upper, lower, top, bottom = [], [], None, None
        current_day = None
        for i in range(max(0, lo - 1500), hi):
            if local_day[i] != current_day:
                current_day, top, bottom = local_day[i], None, None
            if mod[i] == strategy.s.anchor_minute:
                top, bottom = max(bars.o[i], bars.c[i]), min(bars.o[i], bars.c[i])
            if i >= lo:
                upper.append(top); lower.append(bottom)
        add_line("Anchor body high", upper, "#b8b8bd")
        add_line("Anchor body low", lower, "#85858c")
        for high, label, values in ((True, "Confirmed swing high", bars.h), (False, "Confirmed swing low", bars.l)):
            pivots = ta.buffer_pivots(values, strategy.params["swing"], high)
            last = None; out = []
            for i in range(hi):
                if math.isfinite(pivots[i]): last = pivots[i]
                if i >= lo: out.append(last)
            add_line(label, out, "#b8b8bd" if high else "#85858c")
        atr = ta.shift(ta.atr(bars.h, bars.l, bars.c, strategy.params["atr_len"]), 1)
        add_line("ATR (previous bar, dollars)", atr[lo:hi], "#b8b8bd", 1)
    elif request["strategy"] == "supertrend_kalman":
        m = module.m15(bars)
        st, _ = ta.supertrend(m["h"], m["l"], m["c"], strategy.params["st_factor"], strategy.params["atr_len"])
        kalman, _ = ta.kalman_trend(m["c"] * TICK, strategy.params["kalman_q"])
        j = strategy.prev[lo:hi]
        for label, values, color, ticks in (("M15 Supertrend", st, "#b8b8bd", True),
                                             ("M15 ATR trail", strategy.ind["tr_stop"], "#8fd4c1", True),
                                             ("M15 Kalman", kalman, "#f9f9f9", False),
                                             ("M15 swing high", strategy.ind["sw_hi"], "#85858c", True),
                                             ("M15 swing low", strategy.ind["sw_lo"], "#85858c", True)):
            add_line(label, [values[k] if k >= 0 else None for k in j], color, ticks=ticks)
        for pane, (label, key) in enumerate((("Kalman slope", "k_slope"), ("ATR14 (dollars)", "atr14"),
                                             ("ATR100 (dollars)", "atr100"), ("RVI", "rvi"), ("Efficiency ratio", "er")), 1):
            add_line(label, [strategy.ind[key][k] if k >= 0 else None for k in j], "#b8b8bd", pane,
                     ticks=key in ("atr14", "atr100"))
        payload["notes"].append("M15 indicators use the last completed bucket, aligned to the one-minute decision bar. No developing M15 values are shown.")
    else:
        from tvtester.swings import NONE
        m = strategy.m1
        j = m.at[lo:hi]
        add_line("Confirmed 1m swing high", [m.cur_h[k] if k >= 0 and m.cur_h[k] != NONE else None for k in j], "#b8b8bd")
        add_line("Confirmed 1m swing low", [m.cur_l[k] if k >= 0 and m.cur_l[k] != NONE else None for k in j], "#85858c")
        add_line("Entry bias (+1 long / -1 short)", strategy.bias[lo:hi], "#8fd4c1", 1, ticks=False)
        for pane, (tf, (state, at)) in enumerate(module.tf_states(bars).items(), 2):
            add_line(f"{tf} trend (+1 up / -1 down)", [state.trend[at[i]] if at[i] >= 0 else None for i in indices], "#b8b8bd", pane, ticks=False)
    rule = getattr(strategy, "rule", None)
    payload["notes"].append(f"Breakeven: {rule.be if rule else 'none'}. Extra trailing rule: {rule.trail if rule else 'none'}. Native strategy exit: {strategy.params.get('exit', 'fixed bracket')}.")
    return payload


if __name__ == "__main__":
    for line in sys.stdin:
        try:
            result = replay(json.loads(line))
            print(json.dumps({"data": result}, allow_nan=False), flush=True)
        except Exception as error:
            print(json.dumps({"error": str(error)}), flush=True)
