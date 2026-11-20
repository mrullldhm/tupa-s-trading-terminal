"""Export the full all-hours Reaction Level Matrix dev run for local chart inspection."""

import json

import numpy as np
import pandas as pd
from export_setup_charts import MINUTE, WINDOWS, expanded_context, unix, variant_label

from cltester.config import LEDGER, RESULTS, TICK
from cltester.data import Bars, load_period
from cltester.engine import Fills, backtest
from cltester.indicators import tf_candles
from cltester.strategy import load

RUN = "2851bcbfb212"
OUT = RESULTS / "rlm" / "web-all-hours"
CHECK_COLUMNS = ("signal_bar", "entry_bar", "exit_bar", "entry_ts", "exit_ts", "side", "qty",
                 "entry", "exit", "reason", "ticks", "fee", "net")


def write_json(path, data):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(data, allow_nan=False, separators=(",", ":")) + "\n")
    temp.replace(path)


def candles_in_view(df, seconds, frame, tf, trade, setup_start, contract_start, contract_end):
    before, after = WINDOWS[tf]
    if tf == "1m":
        context = expanded_context(trade.exit_bar - setup_start)
        start = max(contract_start, setup_start - max(before, context))
        end = min(contract_end, trade.exit_bar + max(after * 2, context))
        rows = slice(start, end + 1)
        prices_and_volume = [df[key].to_numpy()[rows].tolist() for key in ("open", "high", "low", "close", "volume")]
        return list(zip(seconds[rows].tolist(), *prices_and_volume, (seconds[rows] + 60).tolist(), strict=True))

    starts = frame["first"].to_numpy()
    lo, signal, exit_, hi = np.searchsorted(starts, [contract_start, setup_start, trade.exit_bar, contract_end],
                                           side="right") - 1
    context = expanded_context(exit_ - signal)
    visible = frame.iloc[max(0, lo, signal - max(before, context)):min(hi, exit_ + max(after * 2, context)) + 1]
    volume = df["volume"].to_numpy()
    candles = []
    for row in visible.itertuples(index=False):
        first, last = max(row.first, contract_start), min(row.last, contract_end)
        if first != row.first or last != row.last:
            # Show the part of a roll candle that traded on this contract.
            raw = df.iloc[first:last + 1]
            o, h, low, close = raw.open.iat[0], raw.high.max(), raw.low.min(), raw.close.iat[-1]
        else:
            o, h, low, close = row.open, row.high, row.low, row.close
        candles.append([int(seconds[first]), round(o, 2), round(h, 2), round(low, 2), round(close, 2),
                        int(volume[first:last + 1].sum()), int(seconds[last]) + 60])
    if not candles or not candles[0][0] <= unix(trade.entry_ts) <= unix(trade.exit_ts) < candles[-1][6]:
        raise ValueError(f"{tf} candles do not cover logged trade {trade.signal_bar}")
    return candles


def main():
    ledger = pd.read_csv(LEDGER)
    run = ledger[(ledger.strategy == "rlm") & (ledger.period == "dev") & (ledger["hash"] == RUN)].iloc[-1]
    params = json.loads(run.params)
    label = variant_label("rlm", params)
    recorded = pd.read_csv(RESULTS / "rlm" / f"dev_{RUN}.csv", parse_dates=["entry_ts", "exit_ts"])
    df = load_period("dev")
    strategy = load("rlm")
    signals = strategy.signals(df, params)
    orders = strategy.orders(df, params).set_index("bar")
    actual = backtest(Bars.from_frame(df), signals, Fills(), strategy.manage)
    pd.testing.assert_frame_equal(actual[list(CHECK_COLUMNS)], recorded[list(CHECK_COLUMNS)],
                                  check_dtype=False, rtol=0, atol=0.000001)
    print(f"Verified {len(recorded)} trades against saved run {RUN}", flush=True)

    frames = {tf: tf_candles(df, tf) for tf in WINDOWS if tf != "1m"}
    seconds = df.ts.array.as_unit("s").asi8
    contracts = df.raw_symbol.to_numpy()
    boundaries = np.r_[0, np.flatnonzero(contracts[1:] != contracts[:-1]) + 1, len(df)]
    OUT.mkdir(parents=True, exist_ok=True)
    index = {"wins": [], "losses": [], "flat": 0}
    for trade in reversed(list(recorded.itertuples(index=False))):
        if trade.net == 0:
            index["flat"] += 1
            continue
        contract = boundaries.searchsorted(trade.entry_bar, side="right")
        start, end = int(boundaries[contract - 1]), int(boundaries[contract] - 1)
        if not start <= trade.signal_bar <= trade.entry_bar <= trade.exit_bar <= end:
            raise ValueError(f"Recorded trade {trade.signal_bar} crosses a contract roll")
        order = orders.loc[trade.signal_bar]
        signal = signals.loc[trade.signal_bar]
        setup_start = int(frames["1h"].first.iat[int(order.c)])
        signal_time = unix(df.ts.iat[trade.signal_bar] + MINUTE)
        chart = {
            "schema": 2, "symbol": str(contracts[trade.entry_bar]), "version": label, "signalTf": "1h",
            "views": [
                {"tf": tf, "candles": candles_in_view(df, seconds, frames.get(tf), tf, trade, setup_start, start, end),
                 "indicators": []}
                for tf in WINDOWS
            ],
            "trade": {
                "side": trade.side, "qty": trade.qty,
                "signalOpen": unix(frames["1h"].ts.iat[int(order.c)]), "signalTime": signal_time,
                "fillTime": unix(trade.entry_ts), "exitTime": unix(trade.exit_ts),
                "limit": float(signal.limit), "entry": trade.entry, "stop": float(signal.stop),
                "target": float(signal.target), "exit": trade.exit, "managedStop": False,
                "riskTicks": abs(round((trade.entry - signal.stop) / TICK)),
                "net": trade.net, "reason": trade.reason,
            },
            "reaction": {
                "bandLow": float(order.lo * TICK), "bandHigh": float(order.hi * TICK),
                "wick": float((order.l if trade.side > 0 else order.h) * TICK),
                "score": float(order.score), "minScore": params["score"], "touches": int(order.touches),
                "closeStrength": float((order.cl - order.l if trade.side > 0 else order.h - order.cl)
                                       / (order.h - order.l)),
                "minCloseStrength": params["clv"],
            },
        }
        write_json(OUT / f"{trade.signal_bar}.json", chart)
        bucket = "wins" if trade.net > 0 else "losses"
        index[bucket].append({"id": trade.signal_bar, "at": signal_time})
    for items in (index["wins"], index["losses"]):
        items.sort(key=lambda trade: (trade["at"], trade["id"]), reverse=True)
    write_json(OUT / "index.json", index)
    print(f"Exported {len(index['wins'])} winning and {len(index['losses'])} losing charts", flush=True)


if __name__ == "__main__":
    main()
