import numpy as np
import pandas as pd
import pytest
from export_tupa_setups import payload, price_overlays

from cltester.data import add_session
from cltester.swings import build_candles
from studies.tupa_1.scan import Setup


@pytest.mark.parametrize(
    "method, time, confirmed",
    [("sweep", "07:30", "07:31"), ("swing-close", "08:00", "08:01"), ("retest", "08:01", "08:01")],
)
def test_confirmation_label_and_marker(method, time, confirmed):
    def stamp(clock):
        return pd.Timestamp(f"2024-03-05 {clock}", tz="UTC")

    ts = pd.date_range(stamp("04:00"), stamp("08:05"), freq="min").drop(stamp("07:59"))
    df = add_session(pd.DataFrame({
        "ts": ts, "open": 1.05, "high": 1.10, "low": 0.90, "close": 1.05, "raw_symbol": "CL", "volume": 1,
    }))
    frames = {tf: build_candles(df, tf, include_incomplete=True) for tf in ("1m", "15m", "1h", "4h")}
    end = ts.get_loc(stamp(time))
    setup = Setup(
        side=-1, c1=1, c2=2, c3=3, reference=0, reference_level=110, catalyst=5,
        catalyst_swing=stamp("04:45"), catalyst_swing_price=95, first_touch=75, second_touch=76,
        retest=end, confirmation=end, early_sweep=end if method == "sweep" else None,
        inside=method != "retest", crosses_roll=False,
    )
    chart = payload(df, frames, price_overlays(df, frames), ts.as_unit("s").asi8, np.arange(len(df) + 1),
                    setup, "1h", "15m", "4h")
    pattern = chart["pattern"]
    assert frames["1h"].avail[3] == ts.get_loc(stamp("08:00"))
    assert pattern["candle3Close"] == stamp("08:01").timestamp()
    assert pattern["confirmationMethod"] == method
    assert pattern["confirmed"] == stamp(confirmed).timestamp()
    assert pattern["confirmationBar"] == stamp(time).timestamp()
    assert pattern["catalystSwingPrice"] == 0.95
    for view in chart["views"]:
        assert [line["name"] for line in view["indicators"]] == ["EMA 10", "EMA 20", "EMA 50", "Session VWAP"]
        assert all(line["pane"] == "Price" and len(line["values"]) == len(view["candles"])
                   for line in view["indicators"])


def test_ema_uses_chart_candles_and_vwap_resets_at_cme_session_open():
    first = pd.date_range("2024-03-05 21:30", periods=30, freq="min", tz="UTC")
    second = pd.date_range("2024-03-05 23:00", periods=30, freq="min", tz="UTC")
    close = (7000 + np.arange(60)) / 100
    volume = 1 + np.arange(60)
    df = add_session(pd.DataFrame({
        "ts": first.append(second), "open": close, "high": close + 0.01,
        "low": close - 0.01, "close": close, "volume": volume,
    }))
    frames = {tf: build_candles(df, tf) for tf in ("1m", "15m")}
    overlays = price_overlays(df, frames)
    for tf, frame in frames.items():
        ema10, ema20, ema50, vwap = [line[2] for line in overlays[tf]]
        first_close, second_close = close[frame.last[:2]]
        for period, values in ((10, ema10), (20, ema20), (50, ema50)):
            assert values[0] == pytest.approx(first_close)
            assert values[1] == pytest.approx(first_close + 2 / (period + 1) * (second_close - first_close))
        after_open = np.flatnonzero(frame.first == 30)[0]
        end = frame.last[after_open]
        assert vwap[after_open] == pytest.approx(np.average(close[30:end + 1], weights=volume[30:end + 1]))
