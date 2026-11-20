"""Export local setup charts for the site's recorded CL backtests.

Run from the tester root with .venv/bin/python web/tools/export_setup_charts.py.
Output stays alongside the ignored trade logs, outside the web project.
"""

import json
from math import isclose

import pandas as pd
from export_web import OUT as RESEARCH
from export_web import variant_label

from chart_indicators import SWING_STRATEGIES, add_swing_zigzags, indicators, project_indicators  # isort: skip
from cltester.config import LEDGER, PERIODS, RESULTS, TICK
from cltester.data import Bars, add_session, load_bars
from cltester.engine import Fills, backtest
from cltester.indicators import tf_candles
from cltester.strategy import load

WINDOWS = {"1m": (360, 180), "5m": (96, 50), "15m": (60, 30), "1h": (44, 18), "4h": (20, 16), "1d": (20, 8)}
SIGNAL_TF = {"cbr": "1m", "ghost_box": "5m", "ict_ea": "5m", "scribd_supertrend": "15m",
             "swing_point_failure": "1m", "swing_point_failure_reversal": "1m"}
RLM_RUN = "d70b216ba51e"
RLM_ENTRY = pd.Timestamp("2021-05-12 09:03:00Z")
DAY = pd.Timedelta(days=1)
MINUTE = pd.Timedelta(minutes=1)
DEV_START, DEV_END = (pd.Timestamp(day) for day in PERIODS["dev"])
MATCH_FIELDS = ("entry_ts", "exit_ts", "side", "qty", "entry", "exit", "reason", "ticks")


def unix(ts):
    return int(ts.timestamp())


def candle_index(cd, bar):
    return int(cd["first"].searchsorted(bar, side="right") - 1)


def expanded_context(trade_span):
    padding = max(5, (trade_span + 7) // 8)
    return trade_span + 3 * padding + 1


def version_rank(v, gates):
    years = v["years_positive"] / max(v["years_total"], 1)
    score = sum((v["trades"] >= gates["trades"], v["profit_factor"] >= gates["profit_factor"],
                 years >= gates["years_positive"], v["pass_rate"] >= gates["pass_rate"],
                 v["cost_per_pass"] is not None and v["cost_per_pass"] <= gates["cost_per_pass"]))
    return score, v["profit_factor"]


def chart_view(df, cd, setup_bar, exit_bar, tf, window, lines, signal_tf):
    signal, exit_ = max(0, candle_index(cd, setup_bar)), candle_index(cd, exit_bar)
    before, after = window
    context = expanded_context(exit_ - signal)
    before, after = max(before, context), max(after * 2, context)
    volume = df["volume"].to_numpy()
    visible = cd.iloc[max(0, signal - before):exit_ + after + 1]
    candles = [
        [unix(c.ts), round(c.open, 2), round(c.high, 2), round(c.low, 2), round(c.close, 2),
         int(volume[c.first:c.last + 1].sum()), unix(df.ts.iat[c.last] + MINUTE)]
        for c in visible.itertuples(index=False)
    ]
    return {"tf": tf, "candles": candles,
            "indicators": project_indicators(lines, visible["last"].to_numpy(), tf != signal_tf)}


def optional_price(price):
    return None if pd.isna(price) else round(float(price), 2)


def build_chart(sid, version, df, trade, strat, params, order, moved):
    tf = params.get("sig_tf") or params.get("tf") or params.get("entry_tf") or SIGNAL_TF[sid]
    windows = dict(WINDOWS)
    if tf == "30m":
        windows["30m"] = (50, 25)
    if sid in SWING_STRATEGIES:
        windows["1m"] = (720, 180)
    rolls = df.raw_symbol.ne(df.raw_symbol.shift()).cumsum()
    contract = df.index[rolls == rolls.iat[trade.entry_bar]]
    if not (contract[0] <= trade.signal_bar <= trade.exit_bar <= contract[-1]):
        raise ValueError(f"{sid}: saved trade crosses a contract roll")
    lines = indicators(sid, df, tf, params, trade.signal_bar)
    react = strat.orders(df, params).set_index("bar").loc[trade.signal_bar] if sid == "rlm" else None

    def contract_candles(period):
        cd = tf_candles(df, period)
        cd = cd[(cd["first"] >= contract[0]) & (cd["last"] <= contract[-1])]
        if cd.empty or cd["first"].iat[0] > trade.signal_bar or cd["last"].iat[-1] < trade.exit_bar:
            raise ValueError(f"{sid}: {period} chart does not cover the whole trade")
        return cd

    native = contract_candles(tf)
    setup_bar = (int(df.ts.searchsorted(react.c_open)) if react is not None
                 else int(native["first"].iat[candle_index(native, trade.signal_bar)]))
    signal_open = df.ts.iat[setup_bar]
    views = [chart_view(df, native if period == tf else contract_candles(period), setup_bar, trade.exit_bar,
                        period, window, lines, tf) for period, window in windows.items()]
    add_swing_zigzags(sid, df, params, trade.signal_bar, views)

    signal_time = df.ts.iat[trade.signal_bar] + MINUTE
    payload = {
        "schema": 2,
        "symbol": str(df.raw_symbol.iat[trade.entry_bar]),
        "version": version["label"], "signalTf": tf, "views": views,
        "trade": {
            "side": int(trade.side), "qty": int(trade.qty),
            "signalOpen": unix(signal_open), "signalTime": unix(signal_time),
            "fillTime": unix(trade.entry_ts), "exitTime": unix(trade.exit_ts),
            "limit": optional_price(order.limit), "entry": float(trade.entry), "stop": optional_price(order.stop),
            "target": optional_price(order.get("target")), "exit": float(trade.exit),
            "managedStop": moved, "riskTicks": abs(round((trade.entry - order.stop) / TICK)),
            "net": float(trade.net), "reason": trade.reason,
        },
    }
    if trade.part_qty:
        payload["trade"]["partial"] = {
            "time": unix(df.ts.iat[trade.part_bar]), "price": float(trade.part_exit), "qty": int(trade.part_qty),
        }
    if react is not None:
        payload["reaction"] = {
            "bandLow": float(react.lo * TICK), "bandHigh": float(react.hi * TICK),
            "wick": float((react.l if trade.side > 0 else react.h) * TICK),
            "score": float(react.score), "minScore": params["score"], "touches": int(react.touches),
            "closeStrength": float((react.cl - react.l if trade.side > 0 else react.h - react.cl)
                                   / (react.h - react.l)),
            "minCloseStrength": params["clv"],
        }
    return payload


def match_trade(sid, version, candidates, warm_days):
    start = max(candidates.entry_ts.min().tz_localize(None).normalize() - DAY * warm_days, DEV_START - DAY)
    end = min(candidates.exit_ts.max().tz_localize(None).normalize() + DAY * 15, DEV_END)
    df = add_session(load_bars(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")))
    df = df[df.trading_day.between(DEV_START, DEV_END, inclusive="left")].reset_index(drop=True)
    strat = load(sid)
    params = {**strat.PARAMS, **version["params"]}
    signals = strat.signals(df, params)
    bars = Bars.from_frame(df)
    through = int(params.get("fills", "through0").removeprefix("through"))
    for recorded in candidates.itertuples():
        j = df.ts.searchsorted(recorded.entry_ts)
        if j >= len(df) or df.ts.iat[j] != recorded.entry_ts:
            continue
        i = j - (recorded.entry_bar - recorded.signal_bar)
        rows = signals.loc[signals.index == i]
        if rows.empty:
            continue
        for k in range(len(rows)):
            stop_changed = False

            def manage(ctx):
                nonlocal stop_changed
                stop, close = strat.manage(ctx)
                stop_changed |= stop != ctx.S
                return stop, close

            chosen = rows.iloc[[k]]
            replay = backtest(bars, chosen, Fills(through=through), manage if strat.manage else None)
            if len(replay) != 1:
                continue
            trade = replay.iloc[0]
            if any(getattr(trade, field) != getattr(recorded, field) for field in MATCH_FIELDS):
                continue
            if not (isclose(trade.fee, recorded.fee) and isclose(trade.net, recorded.net)):
                continue
            if trade.part_qty != getattr(recorded, "part_qty", trade.part_qty):
                continue
            if trade.part_qty and trade.part_exit != recorded.part_exit:
                continue
            return build_chart(sid, version, df, trade, strat, params, chosen.iloc[0], stop_changed)
    return None


def export_chart(sid, version):
    path = RESULTS / sid / f"dev_{version['hash']}.csv"
    trades = pd.read_csv(path, parse_dates=["entry_ts", "exit_ts"]).sort_values("entry_ts", ascending=False)
    if sid == "rlm":
        batches = [trades[trades.entry_ts == RLM_ENTRY]]
    else:
        # Spread attempts across the run. Prefer a distinct signal, fill and exit for an inspectable example.
        duration = trades.exit_bar - trades.entry_bar
        ordered = trades[(duration >= 3) & (trades.exit_bar - trades.signal_bar <= 360)]
        batches = list(ordered.groupby(ordered.entry_ts.dt.strftime("%Y-%m"), sort=False))[:8]
        batches = [batch for _, batch in batches]
        batches.append(trades.head(24))
    for warm_days in (90, 180):
        for batch in batches:
            if not batch.empty and (chart := match_trade(sid, version, batch.head(36), warm_days)) is not None:
                out = RESULTS / sid / "web-chart.json"
                tmp = out.with_suffix(".tmp")
                tmp.write_text(json.dumps(chart, allow_nan=False) + "\n")
                tmp.replace(out)
                print(f"{sid}: verified against {version['hash']} and wrote {out.name}", flush=True)
                return
    raise ValueError(f"{sid}: no saved trade reproduced for {version['hash']}")


def main():
    research = json.loads(RESEARCH.read_text())
    ledger = pd.read_csv(LEDGER)
    pinned = ledger[(ledger.strategy == "rlm") & (ledger.period == "dev") & (ledger["hash"] == RLM_RUN)]
    if pinned.empty:
        raise ValueError(f"Pinned RLM run {RLM_RUN} is missing from the ledger")
    params = json.loads(pinned.iloc[-1].params)
    rlm_version = {"hash": RLM_RUN, "params": params, "label": variant_label("rlm", params)}
    for strategy in research["strategies"]:
        sid = strategy["id"]
        versions = [v for v in research["variants"] if v["strategy"] == sid and v["period"] == "dev" and v["trades"]]
        version = rlm_version if sid == "rlm" else max(versions, key=lambda v: version_rank(v, research["gates"]))
        export_chart(sid, version)


if __name__ == "__main__":
    main()
