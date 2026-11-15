"""Build one worked example trade per strategy for the site: made-up candles -> web/src/data/demos.json.

Real Databento prices may not be published, so every example runs on SYNTHETIC 1-minute bars (a seeded random
walk). The candles are fake; everything else is real: the strategy's own signals(), its manage() and the engine
from cltester produce the trade, and the indicator lines come from cltester.indicators with the same settings as
the strategy's best version on the site. Nothing here reads data/ or results/ trades.

Run from the repo root:
    .venv/bin/python web/tools/export_demos.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from cltester.config import TICK, TICK_VALUE  # noqa: E402
from cltester.data import Bars, add_session  # noqa: E402
from cltester.engine import Fills, backtest  # noqa: E402
from cltester.indicators import (  # noqa: E402
    atr_rma,
    atr_sma,
    ema,
    rsi_sma,
    rsi_wilder,
    session_vwap,
    sma,
    supertrend,
    tf_candles,
    vortex,
    wma,
)
from cltester.strategy import load  # noqa: E402
from cltester.swings import swing_state  # noqa: E402

RESEARCH = ROOT / "web" / "src" / "data" / "research.json"
OUT = ROOT / "web" / "src" / "data" / "demos.json"
GATES_KEYS = ("trades", "profit_factor", "years_positive", "pass_rate", "cost_per_pass")
SEEDS = range(30)
DAYS = 24
MAX_WINDOW = 64  # candles shown
LEAD = 34  # candles before the signal


# --------------------------------------------------------------------------- synthetic bars

def synth_bars(seed: int, days: int = DAYS) -> pd.DataFrame:
    """Made-up CL-like 1m bars, Mon-Fri sessions 17:00-16:00 CT, January 2031 (no DST change). Not market data."""
    rng = np.random.default_rng(seed)
    sessions = pd.bdate_range("2031-01-06", periods=days)
    ts_list = []
    for d in sessions:
        start = pd.Timestamp(d) - pd.Timedelta(hours=7)  # 17:00 CT the evening before
        ts_list.append(pd.date_range(start, periods=23 * 60, freq="min"))
    ct = pd.DatetimeIndex(np.concatenate([t.values for t in ts_list])).tz_localize("America/Chicago")
    n = len(ct)
    minute = ct.hour * 60 + ct.minute
    rth = (minute >= 8 * 60) & (minute < 13 * 60 + 30)
    open_burst = (minute >= 8 * 60) & (minute < 8 * 60 + 40)
    intraday = np.where(open_burst, 2.3, np.where(rth, 1.5, 0.65))
    base = 0.00042
    day_vol = np.repeat(np.exp(rng.normal(0, 0.25, days)), 23 * 60)
    # trend regimes: drift held for a random number of minutes
    drift = np.empty(n)
    k = 0
    while k < n:
        span = int(rng.integers(120, 900))
        drift[k:k + span] = rng.normal(0, 0.05) * base
        k += span
    sub = 6
    steps = rng.standard_t(5, size=(n, sub)) / math.sqrt(5 / 3) * (base * intraday * day_vol)[:, None] / math.sqrt(sub)
    steps += drift[:, None] / sub
    # gentle pull back toward $72 so the made-up price stays in a CL-like range
    lp = np.empty((n, sub))
    x = 0.0
    for i in range(n):
        x -= 0.0004 * x
        lp[i] = x + np.cumsum(steps[i])
        x = lp[i, -1]
    path = 72.0 * np.exp(lp)
    close = path[:, -1]
    open_ = np.r_[72.0, close[:-1]]
    high = np.maximum(path.max(1), open_)
    low = np.minimum(path.min(1), open_)
    r = lambda x: np.round(x / TICK) * TICK  # noqa: E731
    o, h, l, c = r(open_), r(high), r(low), r(close)
    h, l = np.maximum.reduce([h, o, c]), np.minimum.reduce([l, o, c])
    vol = np.maximum(1, (rng.lognormal(3.2, 0.6, n) * intraday)).astype(np.int64)
    return pd.DataFrame({"ts": ct.tz_convert("UTC"), "raw_symbol": "SYNTH", "open": o, "high": h, "low": l,
                         "close": c, "volume": vol, "vendor": "synthetic"})


# --------------------------------------------------------------------------- running the real code

def best_params(research: dict, sid: str) -> tuple[dict, str]:
    """Same ranking as web/src/lib/data.ts: most dev checks passed, then highest profit factor."""
    g = research["gates"]

    def passed(v):
        yp = v["years_positive"] / v["years_total"]
        cpp = v["cost_per_pass"]
        return sum([v["trades"] >= g["trades"], v["profit_factor"] >= g["profit_factor"],
                    yp >= g["years_positive"], v["pass_rate"] >= g["pass_rate"],
                    cpp is not None and cpp <= g["cost_per_pass"]])

    vs = [v for v in research["variants"] if v["strategy"] == sid]
    v = sorted(vs, key=lambda v: (-passed(v), -v["profit_factor"]))[0]
    return v["params"], v["label"]


def run(sid: str, params: dict, df: pd.DataFrame):
    strat = load(sid)
    p = {**strat.PARAMS, **params}
    stops: dict[int, list[tuple[int, float]]] = {}
    manage = None
    if strat.manage is not None:
        def manage(ctx):
            s, close = strat.manage(ctx)
            stops.setdefault(ctx.i, []).append((ctx.m, ctx.side * s * TICK))
            return s, close
    sig = strat.signals(df, p)
    trades = strat.day_rules(backtest(Bars.from_frame(df), sig, Fills(), manage, overlap=strat.OVERLAP), p)
    return strat, p, sig, trades, stops


# --------------------------------------------------------------------------- helpers

def clean(x):
    if isinstance(x, (np.floating, float)):
        return None if not np.isfinite(x) else round(float(x), 4)
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.bool_,)):
        return bool(x)
    if isinstance(x, dict):
        return {k: clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple, np.ndarray)):
        return [clean(v) for v in x]
    return x


def candle_of(cd: pd.DataFrame, bar: int) -> int:
    return int(np.searchsorted(cd["first"].to_numpy(), bar, side="right") - 1)


def series(values, a: int, b: int, dp: int = 2):
    v = np.asarray(values, dtype=float)[a:b]
    return [None if not np.isfinite(x) else round(float(x), dp) for x in v]


class Demo:
    """Collects one example: window of candles, indicator lines, panes, marks and facts for the step text."""

    def __init__(self, sid, label, params, df, cd, tf, trade, stop_path, sig_row):
        self.sid, self.label, self.params, self.tf = sid, label, params, tf
        self.df, self.cd, self.t = df, cd, trade
        self.k_sig = int(np.flatnonzero(cd["avail"].to_numpy() == trade.signal_bar)[-1])
        self.k_in = candle_of(cd, trade.entry_bar)
        self.k_out = candle_of(cd, trade.exit_bar)
        self.a = max(0, self.k_sig - LEAD)
        self.b = min(len(cd), self.k_out + 6)
        if self.b - self.a > MAX_WINDOW:
            self.a = self.b - MAX_WINDOW
        self.overlays, self.panes, self.marks, self.facts = [], [], [], {}
        self.stop_path = stop_path
        self.sig_row = sig_row

    def w(self, k: int) -> int:
        """Absolute candle index -> window index."""
        return int(k - self.a)

    def line(self, key, name, values, color, dash=False, step=False, dp=2):
        self.overlays.append({"key": key, "name": name, "color": color, "dash": dash, "step": step,
                              "values": series(values, self.a, self.b, dp)})

    def pane(self, key, title, lines, guides=(), lo=None, hi=None):
        self.panes.append({"key": key, "title": title, "lo": lo, "hi": hi, "guides": list(guides),
                           "lines": [{**ln, "values": series(ln["values"], self.a, self.b, ln.get("dp", 2))}
                                     for ln in lines]})

    def mark(self, **m):
        for k in ("i", "from", "to", "i0", "i1"):
            if k in m and m[k] is not None:
                m[k] = self.w(m[k])
        self.marks.append(m)

    def out(self) -> dict:
        cd, a, b, t = self.cd, self.a, self.b, self.t
        ct = pd.DatetimeIndex(cd["ts"]).tz_convert("America/Chicago")
        day = cd["day"].to_numpy()
        candles = []
        vol = self.df["volume"].to_numpy()
        for k in range(a, b):
            v = int(vol[cd["first"].iat[k]:cd["last"].iat[k] + 1].sum())
            candles.append({"o": round(cd["open"].iat[k], 2), "h": round(cd["high"].iat[k], 2),
                            "l": round(cd["low"].iat[k], 2), "c": round(cd["close"].iat[k], 2),
                            "t": ct[k].strftime("%H:%M"), "d": ct[k].strftime("%a"),
                            "nd": bool(k > a and day[k] != day[k - 1]), "v": v})
        side = int(t.side)
        stop0, target = float(self.sig_row["stop"]), self.sig_row.get("target")
        target = None if target is None or not np.isfinite(target) else float(target)
        path = []
        if self.stop_path:
            # Stop changes at the 1m bar where they took effect, as a position in candles: window index of the
            # candle plus the fraction of its minutes already gone. Never one value per candle: that would backdate
            # an intrabar change to the candle's open and show the trade surviving below its active stop.
            first, last = cd["first"].to_numpy(), cd["last"].to_numpy()

            def pos(m: int) -> float:
                k = candle_of(cd, m)
                return round(self.w(k) + (m - first[k]) / (last[k] - first[k] + 1), 4)

            path = [[pos(int(t.entry_bar)), round(stop0, 2)]]
            for m, s in self.stop_path:
                if round(s, 2) != path[-1][1]:
                    path.append([pos(m), round(s, 2)])
            path.append([pos(int(t.exit_bar)) + round(1 / (last[self.k_out] - first[self.k_out] + 1), 4), None])
        qty = int(t.qty)
        trade = {
            "side": side, "qty": qty, "signal": self.w(self.k_sig), "entry_i": self.w(self.k_in),
            "exit_i": self.w(self.k_out), "limit": round(float(self.sig_row["limit"]), 2), "entry": float(t.entry),
            "exit": float(t.exit), "stop": round(stop0, 2), "target": None if target is None else round(target, 2),
            "reason": t.reason, "ticks": int(t.ticks), "net": round(float(t.net), 2), "fee": round(float(t.fee), 2),
            "part_exit": None if not np.isfinite(t.part_exit) else float(t.part_exit),
            "part_qty": int(self.sig_row.get("part_qty", 0) or 0),
            "part_target": clean(self.sig_row.get("part_target")),
            "stop_path": path,
            "risk_ticks": int(round(abs(float(self.sig_row["limit"]) - stop0) / TICK)),
            "expire_min": clean(self.sig_row.get("expire_min")),
        }
        return clean({"id": self.sid, "variant": self.label, "tf": self.tf, "params": self.params,
                      "candles": candles, "overlays": self.overlays, "panes": self.panes, "marks": self.marks,
                      "trade": trade, "facts": self.facts, "tick_value": TICK_VALUE})


# --------------------------------------------------------------------------- per strategy

BLUE, RUST, JADE, OCHRE, ROSE, LAV = "#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"


def purple_pa(d: Demo, p: dict):
    from strategies.purple_pa import previous_day_levels  # type: ignore
    cd, df, t = d.cd, d.df, d.t
    h, l = cd["high"].to_numpy(), cd["low"].to_numpy()
    days, day_id = np.unique(cd["day"].to_numpy(), return_inverse=True)
    _, dh, dl = previous_day_levels(df, days)
    q, sd = d.k_sig, int(t.side)
    di = day_id[q]
    lev = (dl[di] if sd == 1 else dh[di]) * TICK
    stop = float(d.sig_row["stop"])
    touch = None
    for k in range(q - 1, max(q - p["confirm"] - 1, -1), -1):
        hit = l[k] <= lev + 1e-9 if sd == 1 else h[k] >= lev - 1e-9
        if not hit or day_id[k] != di:
            continue
        ext = (l[k:q + 1].min() - TICK) if sd == 1 else (h[k:q + 1].max() + TICK)
        if abs(ext - stop) < 1e-6:
            touch = k
    assert touch is not None, "purple_pa: could not find the touch candle"
    day_start = int(np.flatnonzero(day_id == di)[0])
    d.mark(kind="hline", layer="setup", price=round(lev, 2), **{"from": max(day_start, d.a), "to": d.b - 1},
           label="Yesterday's low" if sd == 1 else "Yesterday's high", tone="level")
    other = (dh[di] if sd == 1 else dl[di]) * TICK
    d.mark(kind="hline", layer="setup", price=round(other, 2), **{"from": max(day_start, d.a), "to": d.b - 1},
           label="Yesterday's high" if sd == 1 else "Yesterday's low", tone="level", faint=True)
    d.mark(kind="candle", layer="touch", i=touch, label="Touch")
    lo, hi = (h[q - 2], l[q]) if sd == 1 else (h[q], l[q - 2])
    d.mark(kind="zone", layer="signal", i0=q - 2, i1=q, lo=round(lo, 2), hi=round(hi, 2), label="Gap", tone="sky")
    d.facts.update(level=round(lev, 2), level_name="low" if sd == 1 else "high", touch=d.w(touch),
                   gap_from=d.w(q - 2), gap_to=d.w(q), gap_lo=round(lo, 2), gap_hi=round(hi, 2),
                   candles_after=q - touch, day_start=d.w(max(day_start, d.a)), rr=p["rr"],
                   expire_candles=p["expire_candles"])


def swapnil_hm(d: Demo, p: dict):
    cd, df = d.cd, d.df
    c = cd["close"]
    r9 = rsi_wilder(c, 9)
    fast, slow = ema(r9, 3).to_numpy(), wma(r9, 21).to_numpy()
    rsi = rsi_wilder(c, 14).to_numpy()
    basis = sma(c, 20).to_numpy()
    vw = session_vwap(df)[cd["last"].to_numpy()]
    d.line("basis", "20-candle average", basis, BLUE)
    d.line("vwap", "VWAP (today)", vw, OCHRE, step=True)
    d.pane("rsi", "RSI 14", [{"key": "rsi", "name": "RSI 14", "color": LAV, "values": rsi}],
           guides=[{"v": p["rsi_buy"], "label": str(p["rsi_buy"])}, {"v": p["rsi_sell"], "label": str(p["rsi_sell"])}],
           lo=0, hi=100)
    d.pane("hm", "RSI 9: fast vs slow line", [
        {"key": "fast", "name": "Fast line (3)", "color": JADE, "values": fast},
        {"key": "slow", "name": "Slow line (21)", "color": ROSE, "values": slow}], lo=0, hi=100)
    k = d.k_sig
    d.mark(kind="candle", layer="signal", i=k, label="Signal")
    d.facts.update(close=round(c.iat[k], 2), basis=round(basis[k], 2), vwap=round(vw[k], 2), rsi=round(rsi[k], 1),
                   fast=round(fast[k], 1), slow=round(slow[k], 1), rsi_buy=p["rsi_buy"], rsi_sell=p["rsi_sell"])


def xtley_gap(d: Demo, p: dict):
    cd = d.cd
    c = cd["close"]
    e360, e20 = ema(c, 360).to_numpy(), ema(c, 20).to_numpy()
    a10 = atr_sma(cd["high"], cd["low"], c, 10).to_numpy()
    a20 = atr_sma(cd["high"], cd["low"], c, 20).to_numpy()
    rsi = rsi_sma(c, 20).to_numpy()
    gap = e360 * p["gap_pct"] / 100
    d.line("e360", "EMA 360 (long average)", e360, BLUE)
    d.line("band", f"{p['gap_pct']}% away from EMA 360", e360 - gap if d.t.side == 1 else e360 + gap, BLUE, dash=True)
    d.line("e20", "EMA 20", e20, OCHRE)
    d.pane("rsi", "RSI 20", [{"key": "rsi", "name": "RSI 20", "color": LAV, "values": rsi}],
           guides=[{"v": 70, "label": "70"}, {"v": 30, "label": "30"}], lo=0, hi=100)
    d.pane("atr", "Calm check: ATR 10 vs ATR 20", [
        {"key": "a10", "name": "ATR 10 (short)", "color": JADE, "values": a10, "dp": 3},
        {"key": "a20", "name": "ATR 20 (long)", "color": ROSE, "values": a20, "dp": 3}])
    k = d.k_sig
    d.mark(kind="candle", layer="signal", i=k, label="Signal")
    d.facts.update(close=round(c.iat[k], 2), e360=round(e360[k], 2), e20=round(e20[k], 2),
                   dist_pct=round(abs(c.iat[k] - e360[k]) / e360[k] * 100, 2), gap_pct=p["gap_pct"],
                   rsi=round(rsi[k], 1), rsi_prev=round(rsi[k - 1], 1), a10=round(a10[k], 3), a20=round(a20[k], 3),
                   offset=p["offset"], sl_atr=p["sl_atr"], rr=p["rr"], trail=bool(p["trail"]),
                   trail_atr=p["trail_atr"])


def swapnil_momentum(d: Demo, p: dict):
    cd = d.cd
    k = d.k_sig
    lim = float(d.sig_row["limit"])
    risk = abs(lim - float(d.sig_row["stop"]))
    d.mark(kind="candle", layer="signal", i=k - 1, label="1")
    d.mark(kind="candle", layer="signal", i=k, label="2")
    tgt = float(d.sig_row["target"])
    d.facts.update(risk=round(risk, 2), risk_pct=round(risk / lim * 100, 2), y=round(abs(tgt - lim) / risk),
                   x_pct=p["x_pct"], first=d.w(k - 1), bucket_a=p["bucket_a"], bucket_b=p["bucket_b"],
                   sig_high=round(cd["high"].iat[k], 2), sig_low=round(cd["low"].iat[k], 2))


def scribd_supertrend(d: Demo, p: dict):
    cd = d.cd
    h, l, c = cd["high"], cd["low"], cd["close"]
    dirn, st = supertrend(h, l, c, p["st_len"], p["st_mult"])
    e8, e21 = ema(c, 8).to_numpy(), ema(c, 21).to_numpy()
    vp, vm = (x.to_numpy() for x in vortex(h, l, c, p["vi_len"]))
    atr = atr_rma(h, l, c, p["atr_len"]).to_numpy()
    up = np.where(dirn == 1, st, np.nan)
    dn = np.where(dirn == -1, st, np.nan)
    d.line("st_up", "Supertrend (up)", up, JADE, step=True)
    d.line("st_dn", "Supertrend (down)", dn, ROSE, step=True)
    d.line("e8", "EMA 8", e8, OCHRE)
    d.line("e21", "EMA 21", e21, BLUE)
    d.pane("vi", f"Vortex {p['vi_len']}", [
        {"key": "vp", "name": "VI+ (buyers)", "color": JADE, "values": vp, "dp": 3},
        {"key": "vm", "name": "VI- (sellers)", "color": ROSE, "values": vm, "dp": 3}],
        guides=[{"v": 1.1, "label": "1.1"}, {"v": 0.9, "label": "0.9"}])
    k = d.k_sig
    d.mark(kind="candle", layer="signal", i=k, label="Signal")
    pt = float(d.sig_row["limit"]) / 4500.0
    d.facts.update(dir=int(dirn[k]), st=round(st[k], 2), e8=round(e8[k], 2), e21=round(e21[k], 2),
                   vp=round(vp[k], 3), vm=round(vm[k], 3), atr=round(atr[k], 2), pt=round(pt, 4),
                   stop_pts=p["stop_pts"], trail_pts=p["trail_pts"], target_pts=p["target_pts"],
                   exit=p["exit"], trail_usd=round(p["trail_pts"] * pt, 2), target_usd=round(p["target_pts"] * pt, 2))


def ict_ea(d: Demo, p: dict):
    """Recompute the score parts at the signal candle with the strategy's own helpers, then assert they match."""
    from cltester.indicators import on_1m
    from strategies.ict_ea import BEAR, BULL, NONE, S_BOS, S_CHOCH, S_CISD, S_NONE, _newest, daily_bias  # type: ignore
    df, cd = d.df, d.cd
    n = len(df)
    av = cd["avail"].to_numpy()
    o, h, l, c = (cd[k].to_numpy() for k in ("open", "high", "low", "close"))
    sw = swing_state(df, "1h", prev=True)
    sh1, sh2, sl1, sl2 = (sw[f"1h_{k}"].to_numpy()[av] for k in ("sh", "sh2", "sl", "sl2"))
    h1 = tf_candles(df, "1h")
    h1a = h1["avail"].to_numpy()
    hc, ho, hh, hl = (on_1m(h1[k], h1a, n)[av] for k in ("close", "open", "high", "low"))
    bull_g = np.r_[False, False, h[:-2] < l[2:]]
    bear_g = np.r_[False, False, h[2:] < l[:-2]]
    fq = _newest(bull_g | bear_g, 0, 18)
    rng_, body = h - l, np.abs(c - o)
    nxt_big = np.r_[(body[1:] / np.where(rng_[1:] > 0, rng_[1:], np.inf) > 0.6) & (rng_[1:] > rng_[:-1]), False]
    ob_bull = (c < o) & np.r_[c[1:] > o[1:], False] & nxt_big
    ob_bear = (c > o) & np.r_[c[1:] < o[1:], False] & nxt_big
    oq = _newest(ob_bull | ob_bear, 1, 28)
    hi50 = pd.Series(h).rolling(50, min_periods=1).max().to_numpy()
    lo50 = pd.Series(l).rolling(50, min_periods=1).min().to_numpy()
    day = pd.factorize(cd["day"].to_numpy())[0]
    bias = daily_bias(day, o, h, l, 10 * p["pt_frac"])
    trend, last_sig = NONE, S_NONE
    K = d.k_sig
    for t in range(K + 1):
        if not (np.isnan(sh1[t]) or np.isnan(sh2[t]) or np.isnan(sl1[t]) or np.isnan(sl2[t]) or np.isnan(hc[t])):
            if sh1[t] > sh2[t] and sl1[t] > sl2[t]:
                trend = BULL
            elif sh1[t] < sh2[t] and sl1[t] < sl2[t]:
                trend = BEAR
            if trend == BULL and hc[t] > sh1[t]:
                last_sig = S_BOS
            elif trend == BEAR and hc[t] < sl1[t]:
                last_sig = S_BOS
            if trend == BULL and hc[t] < sl1[t]:
                last_sig, trend = S_CHOCH, BEAR
            elif trend == BEAR and hc[t] > sh1[t]:
                last_sig, trend = S_CHOCH, BULL
            if last_sig == S_CHOCH:
                r = hh[t] - hl[t]
                if r > 0 and abs(hc[t] - ho[t]) / r > 0.6:
                    last_sig = S_CISD
    t, sd = K, int(d.t.side)
    swh, swl = sh1[t], sl1[t]
    pda_src = "1h swings"
    if np.isnan(swh) or np.isnan(swl) or swh <= swl:
        swh, swl, pda_src = hi50[t], lo50[t], "last 50 candles"
    eq = (swh + swl) / 2
    q, k = fq[t], oq[t]
    want = BULL if sd == 1 else BEAR
    other = "the other way"
    t_pts = int(trend == want)
    b_pts = int(last_sig in (S_CISD, S_BOS) and trend == want)
    z_pts = int(c[t] < eq if sd == 1 else c[t] > eq)
    f_pts = int(q >= 0 and bool(bull_g[q] if sd == 1 else (bear_g[q] and not bull_g[q])))
    o_pts = int(k >= 0 and bool(ob_bull[k] if sd == 1 else ob_bear[k]))
    b2 = 2 * int(bias[t] == want)
    tw = {BULL: "up: higher highs and higher lows", BEAR: "down: lower highs and lower lows",
          NONE: "no clear trend"}[trend]
    parts = [
        {"key": "trend", "label": "Trend (1h swings)", "pts": t_pts, "note": f"trend is {tw}"},
        {"key": "break", "label": "Break of structure", "pts": b_pts,
         "note": "none yet" if last_sig == S_NONE else ("price closed past the last swing" if b_pts
                                                         else "only counts with the trend; it points " + other)},
        {"key": "zone", "label": "Discount zone" if sd == 1 else "Premium zone", "pts": z_pts,
         "note": f"close {'below' if c[t] < eq else 'above'} the middle of the {pda_src}"},
        {"key": "fvg", "label": "Fair value gap", "pts": f_pts,
         "note": "recent gap in this direction" if f_pts else
         ("recent gap points " + other if q >= 0 else "no recent gap")},
        {"key": "ob", "label": "Order block", "pts": o_pts,
         "note": "recent order block in this direction" if o_pts else
         ("recent order block points " + other if k >= 0 else "no recent order block")},
        {"key": "bias", "label": "Daily bias (counts double)", "pts": b2,
         "note": "day made its low first, then rose" if bias[t] == BULL else "day made its high first, then fell"},
    ]
    score = sum(x["pts"] for x in parts)
    assert score >= p["min_conf"], f"ict_ea demo score {score} below {p['min_conf']}: recompute drifted from source"
    win = d.a
    if np.isfinite(sh1[t]) and np.isfinite(sl1[t]):
        d.mark(kind="hline", layer="setup", price=round(sh1[t], 2), **{"from": win, "to": d.b - 1},
               label="Last 1h swing high", tone="level")
        d.mark(kind="hline", layer="setup", price=round(sl1[t], 2), **{"from": win, "to": d.b - 1},
               label="Last 1h swing low", tone="level")
    d.mark(kind="hline", layer="setup", price=round(eq, 2), **{"from": win, "to": d.b - 1},
           label="Middle", tone="level", faint=True)
    if q >= 0 and q - 2 >= d.a and parts[3]["pts"]:
        lo, hi = (h[q - 2], l[q]) if bull_g[q] else (h[q], l[q - 2])
        d.mark(kind="zone", layer="signal", i0=q - 2, i1=q, lo=round(lo, 2), hi=round(hi, 2), label="FVG", tone="sky")
    if k >= 0 and k >= d.a and parts[4]["pts"]:
        d.mark(kind="zone", layer="signal", i0=k, i1=k + 1, lo=round(l[k], 2), hi=round(h[k], 2), label="OB",
               tone="lav")
    d.mark(kind="candle", layer="signal", i=K, label="Signal")
    d.facts.update(parts=parts, score=score, min_conf=p["min_conf"], rr=p["rr"], qty=int(d.sig_row["qty"]),
                   risk_usd=p["risk_usd"], be_r=p["be_r"], timeout_min=p["timeout_min"])


def swing_point_failure(d: Demo, p: dict):
    """Marks come from the strategy's own setups() record for this trade (same code that made the signal)."""
    s = load("swing_point_failure").setups(d.df, p)
    rec = s[(s["end"] == d.t.signal_bar) & (s["why"] == "trigger")].iloc[-1]
    side = int(rec["side"])
    touch, hl = int(rec["touch"]), float(rec["hl"])
    bars = d.df["low" if side == -1 else "high"].to_numpy()
    hl_bar = int(np.flatnonzero(np.isclose(bars[touch:d.t.signal_bar], hl))[-1]) + touch
    k_touch, k_hl = candle_of(d.cd, touch), candle_of(d.cd, hl_bar)
    swing = "low" if side == -1 else "high"
    d.mark(kind="hline", layer="setup", price=round(float(rec["level"]), 2), **{"from": max(d.a, k_touch - 12),
           "to": d.b - 1}, label=f"{p['swing_tf']} swing {swing}", tone="level")
    d.mark(kind="hline", layer="setup", price=round(float(rec["inval"]), 2), **{"from": k_touch, "to": d.k_sig},
           label=f"Previous {p['swing_tf']} {'high' if side == -1 else 'low'}", tone="level", faint=True)
    d.mark(kind="candle", layer="touch", i=k_touch, label="Touch")
    d.mark(kind="candle", layer="touch", i=k_hl, label="HL" if side == -1 else "LH")
    d.mark(kind="hline", layer="touch", price=round(hl, 2), **{"from": k_hl, "to": d.k_sig},
           label="Higher low" if side == -1 else "Lower high", tone="sky")
    d.mark(kind="candle", layer="signal", i=d.k_sig, label="Trigger")
    close = float(d.cd["close"].iat[d.k_sig])
    stop = float(rec["stop"])
    d.facts.update(swing_tf=p["swing_tf"], tf=rec["tf"], level=round(float(rec["level"]), 2),
                   inval=round(float(rec["inval"]), 2), hl=round(hl, 2), close=round(close, 2), stop=round(stop, 2),
                   range_ticks=int(round(abs(stop - close) / TICK)), risk=int(p["risk"]),
                   target_ticks=int(p["risk"] * p["rr"]), touch=d.w(k_touch), hl_i=d.w(k_hl), tie=p["tie"])


def swing_point_failure_window(df: pd.DataFrame, params: dict) -> set[int]:
    """Signal bars whose touch, higher low and trigger all fit in the shown window, locked on 1m (the display)."""
    s = load("swing_point_failure").setups(df, {**load("swing_point_failure").PARAMS, **params})
    ok = s[(s["why"] == "trigger") & (s["tf"] == "1m") & (s["end"] - s["touch"] <= LEAD - 6)]
    return set(ok["end"].astype(int))


def _reversal_records(df: pd.DataFrame, p: dict) -> pd.DataFrame:
    """Reversal setups joined to their source signal (the sell or buy whose stop got touched)."""
    rev = load("swing_point_failure_reversal").setups(df, p)
    spf = load("swing_point_failure").setups(df, p)
    spf = spf[spf["limit"].notna()][["end", "side", "stop", "tf"]].rename(
        columns={"end": "src", "side": "src_side", "stop": "src_stop", "tf": "src_tf"})
    return rev.merge(spf, on="src", how="left")


def swing_point_failure_reversal(d: Demo, p: dict):
    """Marks come from the strategy's own setups() record for this trade (same code that made the signal)."""
    s = _reversal_records(d.df, p)
    rec = s[(s["end"] == d.t.signal_bar) & (s["why"] == "trigger")].iloc[-1]
    side = int(rec["side"])
    src, touch = int(rec["src"]), int(rec["touch"])
    ts = pd.DatetimeIndex(d.df["ts"]).as_unit("ns").asi8
    ref_bar = int(np.searchsorted(ts, int(rec["ref_ts"])))
    k_src, k_touch, k_ref = candle_of(d.cd, src), candle_of(d.cd, touch), candle_of(d.cd, ref_bar)
    h, stop = float(rec["src_stop"]), float(rec["stop"])
    hb = int(np.flatnonzero(np.isclose(d.df["high" if side == 1 else "low"].to_numpy()[:src + 1], h))[-1])
    ref_is_h = candle_of(d.cd, hb) == k_ref
    d.mark(kind="candle", layer="setup", i=k_src, label="Sell" if side == 1 else "Buy")
    d.mark(kind="hline", layer="setup", price=round(h, 2), **{"from": k_src, "to": d.k_sig},
           label="Its stop", tone="level")
    d.mark(kind="candle", layer="touch", i=k_ref, label="Stop high" if ref_is_h and side == 1 else
           "Stop low" if ref_is_h else ("Swing high" if side == 1 else "Swing low"))
    d.mark(kind="hline", layer="touch", price=round(stop, 2), **{"from": k_ref, "to": d.k_sig},
           label="Lowest low since" if side == 1 else "Highest high since", tone="sky")
    d.mark(kind="candle", layer="signal", i=d.k_sig, label="Trigger")
    close = float(d.cd["close"].iat[d.k_sig])
    d.facts.update(h=round(h, 2), src_i=d.w(k_src), touch=d.w(k_touch), ref_i=d.w(k_ref), ref_is_h=bool(ref_is_h),
                   stop=round(stop, 2), close=round(close, 2), range_ticks=int(round(abs(close - stop) / TICK)),
                   risk=int(p["risk"]), target_ticks=int(p["risk"] * p["rr"]), sl_tf=p["sl_tf"],
                   tf=rec["src_tf"])


def swing_point_failure_reversal_window(df: pd.DataFrame, params: dict) -> set[int]:
    """Signal bars whose source signal, touch and trigger fit in the shown window, on 1m (the display)."""
    s = _reversal_records(df, {**load("swing_point_failure_reversal").PARAMS, **params})
    ok = s[(s["why"] == "trigger") & (s["src_tf"] == "1m") & (s["end"] - s["src"] <= LEAD - 6)]
    return set(ok["end"].astype(int))


def swing_point_manipulation(d: Demo, p: dict):
    """Marks come from the strategy's own setups() record for this trade (same code that made the signal)."""
    from cltester.swings import build_candles
    s = load("swing_point_manipulation").setups(d.df, p)
    rec = s[(s["end"] == d.t.signal_bar) & (s["why"] == "trigger")].iloc[-1]
    side, k = int(rec["side"]), int(rec["c3"])
    h1 = build_candles(d.df, "1h")
    c1, c2 = k - 2, k - 1
    hi2, lo2 = h1.h[c2] * TICK, h1.l[c2] * TICK
    first_of = lambda c: candle_of(d.cd, int(h1.first[c]))  # noqa: E731
    last_of = lambda c: candle_of(d.cd, int(h1.last[c]))  # noqa: E731
    st = swing_state(d.df, "1h", prev=True, newest=True).iloc[int(h1.avail[c2])]
    swing = "low" if side == 1 else "high"
    ts = pd.DatetimeIndex(d.df["ts"])
    base_bar = int(ts.searchsorted(st[f"1h_s{swing[0]}_ts"]))
    k_base = candle_of(d.cd, base_bar)
    tp, base = float(rec["target"]), float(st[f"1h_s{swing[0]}"])
    k_lo, k_hi = candle_of(d.cd, int(rec["lo_touch"])), candle_of(d.cd, int(rec["hi_touch"]))
    k_break = k_hi
    d.mark(kind="hline", layer="setup", price=round(tp, 2), **{"from": d.a, "to": d.b - 1},
           label=f"1h swing {'high' if side == 1 else 'low'} (target)", tone="level")
    if k_base >= d.a:
        d.mark(kind="candle", layer="setup", i=k_base, label=f"1h swing {swing}")
    for c, name in ((c1, "1"), (c2, "2")):
        d.mark(kind="zone", layer="setup", i0=first_of(c), i1=last_of(c), lo=round(h1.l[c] * TICK, 2),
               hi=round(h1.h[c] * TICK, 2), label=f"Candle {name}", tone="level")
    d.mark(kind="hline", layer="touch", price=round(lo2 if side == 1 else hi2, 2),
           **{"from": first_of(c2), "to": d.k_sig}, label=f"Candle 2 {'low' if side == 1 else 'high'}", tone="sky")
    d.mark(kind="hline", layer="touch", price=round(hi2 if side == 1 else lo2, 2),
           **{"from": first_of(c2), "to": d.k_sig}, label=f"Candle 2 {'high' if side == 1 else 'low'}", tone="sky")
    d.mark(kind="candle", layer="touch", i=k_lo, label="Sweep")
    d.mark(kind="candle", layer="signal", i=k_break, label="Break")
    if p["confirm"]:
        d.mark(kind="candle", layer="signal", i=d.k_sig, label="Holds")
    close = float(d.cd["close"].iat[k_break])
    stop = float(rec["stop"])
    d.facts.update(tp=round(tp, 2), base=round(base, 2), base_i=d.w(max(k_base, d.a)), c1_i=d.w(first_of(c1)),
                   c2_i=d.w(first_of(c2)), c3_i=d.w(first_of(k)), hi1=round(h1.h[c1] * TICK, 2),
                   lo1=round(h1.l[c1] * TICK, 2), hi2=round(hi2, 2), lo2=round(lo2, 2), sweep_i=d.w(k_lo),
                   break_i=d.w(k_break), close=round(close, 2), stop=round(stop, 2),
                   range_ticks=int(round(abs(close - stop) / TICK)), risk=int(p["risk"]),
                   confirm=bool(p["confirm"]), outside=p["outside"])


def swing_point_manipulation_window(df: pd.DataFrame, params: dict) -> set[int]:
    """Signal bars whose candle 1 starts at most LEAD - 6 display (15m) candles before the signal."""
    from cltester.swings import build_candles
    s = load("swing_point_manipulation").setups(df, {**load("swing_point_manipulation").PARAMS, **params})
    s = s[s["why"] == "trigger"]
    first = build_candles(df, "1h").first
    ok = [int(e) for e, k in zip(s["end"], s["c3"], strict=True) if e - first[int(k) - 2] <= (LEAD - 6) * 15]
    return set(ok)


WINDOWS = {"swing_point_failure": swing_point_failure_window,
           "swing_point_failure_reversal": swing_point_failure_reversal_window,
           "swing_point_manipulation": swing_point_manipulation_window}


BUILDERS = {"purple_pa": purple_pa, "swapnil_hm": swapnil_hm, "xtley_gap": xtley_gap,
            "swapnil_momentum": swapnil_momentum, "scribd_supertrend": scribd_supertrend, "ict_ea": ict_ea,
            "swing_point_failure": swing_point_failure, "swing_point_failure_reversal": swing_point_failure_reversal,
            "swing_point_manipulation": swing_point_manipulation}
DISPLAY_TF = {"scribd_supertrend": "15m", "ict_ea": "5m", "swing_point_failure": "1m",
              "swing_point_failure_reversal": "1m", "swing_point_manipulation": "15m"}
PREFER = {  # which example reads clearest: exit reasons in order of preference, plus a check
    "purple_pa": ["target", "stop"],
    "swapnil_hm": ["target", "flatten", "stop"],
    "xtley_gap": ["target", "stop", "flatten"],
    "swapnil_momentum": ["target", "stop"],
    "scribd_supertrend": ["target", "stop", "flatten"],
    "ict_ea": ["target", "stop", "manage"],
    "swing_point_failure": ["target", "stop"],
    "swing_point_failure_reversal": ["target", "stop"],
    "swing_point_manipulation": ["target", "stop"],
}


def pick(sid: str, cd: pd.DataFrame, trades: pd.DataFrame, stops: dict, warm: int, allowed: set[int] | None = None):
    best, best_score = None, -1e9
    first = cd["first"].to_numpy()
    for t in trades.itertuples():
        k_sig = int(np.searchsorted(cd["avail"].to_numpy(), t.signal_bar))
        k_in = int(np.searchsorted(first, t.entry_bar, side="right") - 1)
        k_out = int(np.searchsorted(first, t.exit_bar, side="right") - 1)
        if k_sig < warm or k_out >= len(cd) - 6 or k_out - k_sig > MAX_WINDOW - LEAD - 6:
            continue
        pref = PREFER[sid]
        if t.reason not in pref or (allowed is not None and t.signal_bar not in allowed):
            continue
        s = 10 * (len(pref) - pref.index(t.reason))
        s += 4 * (k_out > k_in) + 3 * (k_in > k_sig)
        dur = k_out - k_in
        s -= abs(dur - 10) * 0.25
        moved = len({round(v, 2) for _, v in stops.get(t.signal_bar, [])}) > 1
        s += 3 * (t.net > 0)
        if sid in ("xtley_gap", "scribd_supertrend"):
            s += 12 * (moved and t.net > 0)
        if sid == "swapnil_hm":
            s += 3 * moved
        if sid == "ict_ea":
            s += 8 * np.isfinite(t.part_exit) + 3 * (t.qty > 1)
        if s > best_score:
            best, best_score = t, s
    return best, best_score


WARM = {"xtley_gap": 380, "swapnil_hm": 40, "scribd_supertrend": 40, "ict_ea": 30, "purple_pa": 0,
        "swapnil_momentum": 40, "swing_point_failure": 300, "swing_point_failure_reversal": 300,
        "swing_point_manipulation": 40}


def main() -> None:
    research = json.loads(RESEARCH.read_text())
    out = {"note": "Made-up candles from a seeded random walk; not market data. Signals, fills and exits come "
                   "from the real strategy code and engine.", "demos": {}}
    for sid, build in BUILDERS.items():
        params, label = best_params(research, sid)
        tf = DISPLAY_TF.get(sid, params.get("tf"))
        days = 34 if sid in ("xtley_gap", "swapnil_hm") else DAYS
        found = None
        for seed in SEEDS:
            df = add_session(synth_bars(seed, days))
            strat, p, sig, trades, stops = run(sid, params, df)
            if trades.empty:
                continue
            cd = tf_candles(df, tf)
            cd = cd[cd["avail"].to_numpy() < len(df)].reset_index(drop=True)
            allowed = WINDOWS[sid](df, params) if sid in WINDOWS else None
            t, score = pick(sid, cd, trades, stops, WARM[sid], allowed)
            if t is not None and (found is None or score > found[0]):
                found = (score, seed, df, cd, t, stops, sig, p)
            if found and found[0] >= 42:
                break
        if found is None:
            raise SystemExit(f"{sid}: no usable example trade in {len(SEEDS)} seeds")
        score, seed, df, cd, t, stops, sig, p = found
        row = sig.loc[t.signal_bar]
        if isinstance(row, pd.DataFrame):
            row = row.iloc[-1]
        d = Demo(sid, label, params, df, cd, tf, t, stops.get(t.signal_bar, []), row.to_dict())
        build(d, p)
        doc = d.out()
        doc["seed"] = seed
        out["demos"][sid] = doc
        print(f"{sid:18s} seed {seed:2d}  {t.reason:8s} net {t.net:+8.2f}  candles {d.b - d.a}")
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
