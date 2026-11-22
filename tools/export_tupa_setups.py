"""Build local-only Tupa 1 chart payloads directly from the CL setup census."""

import json

import numpy as np
from chart_indicators import project_indicators

from cltester.config import RESULTS, TICK
from cltester.data import add_session, load_bars
from cltester.indicators import ema, session_vwap
from cltester.swings import HIGH, LOW, build_candles, provisional_swings, swing_state
from studies.tupa_1.scan import scan

OUT = RESULTS / "tupa_1" / "web-setups-sweep"
PAIRS = (("4h", "1h", "1d"), ("1h", "15m", "4h"))
SNAPSHOT_END = "2026-11-17 10:33"  # UTC, exclusive
VIEWS = ("1m", "5m", "15m", "30m", "1h", "4h", "1d")


def write_json(name, data):
    path = OUT / name
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(data, allow_nan=False, separators=(",", ":")) + "\n")
    temp.replace(path)


def price_overlays(df, frames):
    vwap = session_vwap(df)
    overlays = {}
    for tf, frame in frames.items():
        closes = frame.c * TICK
        overlays[tf] = [
            (f"EMA {period}", "Price", ema(closes, period).to_numpy(), False)
            for period in (10, 20, 50)
        ]
        overlays[tf].append(("Session VWAP", "Price", vwap[frame.last], False))
    return overlays


def payload(df, frames, overlays, secs, volume_sum, setup, large_tf, small_tf, ref_tf):
    large, small, ref = (frames[tf] for tf in (large_tf, small_tf, ref_tf))
    first = int(large.first[setup.c1])
    c3_end = int(large.avail[setup.c3])
    end = setup.confirmation
    method = "sweep" if setup.early_sweep is not None else "swing-close" if setup.inside else "retest"
    confirmation_bar = int(secs[end])
    confirmation = confirmation_bar + (60 if method in ("sweep", "swing-close") else 0)
    views = []
    for tf, frame in frames.items():
        lo, hi = np.searchsorted(frame.first, [first, end], side="right") - 1
        if hi >= len(frame) or frame.last[hi] < end or (tf == "1m" and hi - lo > 2400):
            continue
        padding = max(24, (hi - lo) // 4)
        rows = slice(max(0, lo - padding), hi + 2 * padding + 1)
        starts, ends = frame.first[rows], frame.last[rows]
        views.append({
            "tf": tf, "indicators": project_indicators(overlays[tf], rows, stepped=False),
            "candles": list(zip(
                secs[starts].tolist(), (frame.o[rows] / 100).tolist(), (frame.h[rows] / 100).tolist(),
                (frame.l[rows] / 100).tolist(), (frame.c[rows] / 100).tolist(),
                (volume_sum[ends + 1] - volume_sum[starts]).tolist(), (secs[ends] + 60).tolist(), strict=True,
            )),
        })
    k = setup.catalyst
    prices = small.h if setup.side == 1 else small.l
    return {
        "symbol": str(df.raw_symbol.iat[small.first[k]]), "version": "Tupa 1", "signalTf": large_tf,
        "views": views,
        "pattern": {
            "side": setup.side, "candle1": int(secs[first]), "candle2": int(secs[large.first[setup.c2]]),
            "candle3": int(secs[large.first[setup.c3]]),
            "candle3Close": int(secs[c3_end]) + 60 if c3_end < len(df) else None,
            "confirmed": confirmation, "confirmationBar": confirmation_bar, "confirmationMethod": method,
            "confirmationPrice": float(df.close.iat[end]) if method == "sweep" else None,
            "earlySweep": int(secs[setup.early_sweep]) if setup.early_sweep is not None else None,
            "candle1Close": large.c[setup.c1].item() / 100, "catalystTf": small_tf,
            "catalyst": int(secs[small.first[k]]), "catalystEnd": int(secs[small.last[k]]) + 60,
            "catalystSwing": int(setup.catalyst_swing.timestamp()),
            "catalystSwingPrice": setup.catalyst_swing_price / 100,
            "firstTouch": int(secs[setup.first_touch]), "secondTouch": int(secs[setup.second_touch]),
            "retest": int(secs[setup.retest]), "level": prices[k].item() / 100,
            "referenceTf": ref_tf, "reference": int(secs[ref.first[setup.reference]]),
            "referenceLevel": setup.reference_level / 100, "crossesRoll": bool(setup.crosses_roll),
        },
    }


def main():
    df = add_session(load_bars(end=SNAPSHOT_END))
    secs = df.ts.array.as_unit("s").asi8
    volume_sum = np.r_[0, np.cumsum(df.volume.to_numpy(), dtype=np.int64)]
    frames = {tf: build_candles(df, tf, include_incomplete=True) for tf in VIEWS}
    overlays = price_overlays(df, frames)
    states = {}
    for tf in ("15m", "1h", "4h"):
        state = swing_state(df, tf, newest=True)
        states[tf] = {
            "sh": state[f"{tf}_sh_ts"].array,
            "sl": state[f"{tf}_sl_ts"].array,
            "newest": state[f"{tf}_newest"].to_numpy(),
        }
    OUT.mkdir(parents=True, exist_ok=True)
    groups = {}
    for large, small, ref in PAIRS:
        pair = f"{large}-{small}"
        groups[f"{pair}-inside"], groups[f"{pair}-after"] = [], []
        provisional = provisional_swings(frames[large])
        for swing_kind in (HIGH, LOW):
            setups = scan(df, frames[small], frames[large], frames[ref],
                          states[small], states[large], provisional, swing_kind)
            for setup in setups:
                chart = payload(df, frames, overlays, secs, volume_sum, setup, large, small, ref)
                stamp = chart["pattern"]["catalyst"]
                key = f"{pair}-{stamp}-{swing_kind}"
                stage = "inside" if setup.inside else "after"
                groups[f"{pair}-{stage}"].append({
                    "key": key, "at": stamp, "side": setup.side, "method": chart["pattern"]["confirmationMethod"],
                })
                write_json(f"{key}.json", chart)
        print(f"{pair} · {len(groups[f'{pair}-inside'])} inside · {len(groups[f'{pair}-after'])} after", flush=True)
    for items in groups.values():
        items.sort(key=lambda item: (item["at"], item["side"]))
    write_json("index.json", {"groups": groups, "first": int(secs[0]), "last": int(secs[-1])})


if __name__ == "__main__":
    main()
