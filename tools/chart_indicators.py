"""Project strategy indicator values onto the historical chart's candle closes."""

import numpy as np
import pandas as pd

from cltester.config import TICK
from cltester.data import to_ticks
from cltester.indicators import (
    atr_rma,
    atr_sma,
    ema,
    on_1m,
    rsi_sma,
    rsi_wilder,
    session_vwap,
    sma,
    supertrend,
    tf_candles,
    vortex,
    wma,
)
from cltester.strategy import load
from cltester.swings import HIGH, LOW, build_candles, detect, swing_state
from strategies.ghost_box import BOX_END, ghost_days
from strategies.purple_pa import previous_day_levels

COLORS = ("#76a9ff", "#e7af68", "#ba9cf2", "#58c9ce", "#ed90b9", "#97cd87")
SWING_STRATEGIES = {"ict_ea", "cbr", "swing_point_failure", "swing_point_failure_reversal", "swing_point_manipulation"}


def indicators(sid, df, tf, p, signal_bar):
    """Return (name, pane, minute values, stepped) in the strategy's own settings."""
    day = df.trading_day.iat[signal_bar]
    if sid in ("purple_pa", "pd_swing"):
        days, index = np.unique(df.trading_day, return_inverse=True)
        ok, high, low = previous_day_levels(df, days)
        return [(name, "Price", np.where(ok[index], values[index] * TICK, np.nan), True)
                for name, values in (("Previous day high", high), ("Previous day low", low))]
    if sid in ("purple_levels", "purple_levels_rth"):
        cd = tf_candles(df, tf)
        days, index = np.unique(cd.day, return_inverse=True)
        starts = np.flatnonzero(np.r_[True, index[1:] != index[:-1]])
        levels = load("purple_levels").day_levels(df, cd, days, index, starts, p["levels"])
        return [(f"Fixed level {i}", "Price", np.where(df.trading_day == day, value * TICK, np.nan), True)
                for i, value in enumerate(levels[np.searchsorted(days, day.to_datetime64())], start=1)]
    if sid == "ghost_box":
        box = ghost_days(df).set_index("day").loc[day]
        ready = (df.trading_day == day) & (df.sess_minute >= BOX_END)
        return [(name, "Price", np.where(ready, value * TICK, np.nan), True)
                for name, value in (("Overnight high", box.top), ("Overnight low", box.bot))]
    if sid == "ict_ea":
        sw = swing_state(df, "1h")
        return [("Swing midpoint", "Price", (sw["1h_sh"] + sw["1h_sl"]).to_numpy() / 2, True)]
    if sid not in ("swapnil_hm", "xtley_gap", "scribd_supertrend", "juda_swing_point"):
        return []

    cd = tf_candles(df, tf)
    h, low, c = (cd[key] for key in ("high", "low", "close"))
    if sid == "swapnil_hm":
        r9 = rsi_wilder(c, 9)
        values = [
            ("SMA 20", "Price", sma(c, 20)),
            ("Session VWAP", "Price", session_vwap(df)[cd["last"].to_numpy()]),
            ("RSI 14", "RSI", rsi_wilder(c, 14)),
            ("RSI 9 EMA 3", "RSI", ema(r9, 3)),
            ("RSI 9 WMA 21", "RSI", wma(r9, 21)),
        ]
    elif sid == "xtley_gap":
        slow = ema(c, 360)
        gap = slow * p["gap_pct"] / 100
        values = [
            ("EMA 20", "Price", ema(c, 20)), ("EMA 360", "Price", slow),
            ("EMA gap upper", "Price", slow + gap), ("EMA gap lower", "Price", slow - gap),
            ("RSI 20 SMA", "RSI", rsi_sma(c, 20)),
            ("ATR 10 SMA", "ATR", atr_sma(h, low, c, 10)), ("ATR 20 SMA", "ATR", atr_sma(h, low, c, 20)),
        ]
    elif sid == "scribd_supertrend":
        _, trend = supertrend(h, low, c, p["st_len"], p["st_mult"])
        v_plus, v_minus = vortex(h, low, c, p["vi_len"])
        values = [
            ("Supertrend", "Price", trend), ("EMA 8", "Price", ema(c, 8)), ("EMA 21", "Price", ema(c, 21)),
            ("Vortex +", "Vortex", v_plus), ("Vortex −", "Vortex", v_minus),
            (f"ATR {p['atr_len']}", "ATR", atr_rma(h, low, c, p["atr_len"])),
        ]
    else:
        values = [(f"EMA {n}", "Price", ema(c, n)) for n in (10, 20, 50)]
    avail = cd["avail"].to_numpy()
    return [(name, pane, on_1m(vals, avail, len(df)), False) for name, pane, vals in values]


def project_indicators(lines, candle_ends, stepped):
    return [
        {"name": name, "pane": pane, "color": COLORS[i % len(COLORS)], "stepped": stepped or step,
         "values": [round(float(n), 5) if np.isfinite(n) else None for n in values[candle_ends]]}
        for i, (name, pane, values, step) in enumerate(lines)
    ]


def add_swing_zigzags(sid, df, p, signal_bar, views):
    if sid not in SWING_STRATEGIES:
        return
    period = p.get("swing_tf", "1h")
    candles = build_candles(df, period)
    raw = {HIGH: to_ticks(df.high), LOW: to_ticks(df.low)}
    ends = [pd.Timestamp(view["candles"][-1][6], unit="s", tz="UTC") for view in views]
    last_raw = df.ts.searchsorted(ends, side="left") - 1
    cutoffs = np.r_[last_raw, signal_bar]
    confirmations = np.searchsorted(candles.avail[1:], cutoffs, side="right") - 1
    states = dict.fromkeys(cutoffs, ())
    cutoffs_by_confirmation = {}
    for cutoff, confirmation in zip(cutoffs, confirmations, strict=True):
        cutoffs_by_confirmation.setdefault(confirmation, []).append(cutoff)

    def record(k, stack):
        for cutoff in cutoffs_by_confirmation.get(k, ()):
            states[cutoff] = tuple(stack)

    def record_touch(k, minute, stack):
        for cutoff in cutoffs_by_confirmation.get(k - 1, ()):
            if cutoff >= minute:
                states[cutoff] = tuple(stack)

    detect(candles, observer=record, on_touch=record_touch)

    def visible_pivots(cutoff, lo, hi):
        pivots = []
        for point in states[cutoff]:
            first, last = candles.first[point.candle], candles.last[point.candle]
            if df.ts.iat[last].timestamp() < lo:
                continue
            # Use the original traded minute of each extreme, including outside bars that contain two pivots.
            hit = first + np.flatnonzero(raw[point.kind][first:last + 1] == point.price)[0]
            time = int(df.ts.iat[hit].timestamp())
            if lo <= time < hi:
                pivots.append([time, round(point.price * TICK, 2)])
        return pivots

    for view, cutoff in zip(views, last_raw, strict=True):
        lo, hi = view["candles"][0][0], view["candles"][-1][6]
        view["swing"] = {"name": f"{period} swing zigzag at signal", "color": "#ba9cf2",
                         "points": visible_pivots(signal_bar, lo, hi)}
        view["retrospectiveSwing"] = {"name": "Retrospective zigzag", "color": "#7db9ce",
                                      "points": visible_pivots(cutoff, lo, hi)}
