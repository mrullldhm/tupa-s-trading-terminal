"""Exporter tests. From the repo root: .venv/bin/python -m pytest web/tools/test_export_web.py"""

import json

import pytest

import export_web as ex


def test_variant_labels_name_only_the_parameters_that_vary():
    assert ex.variant_label("xtley_gap", {"tf": "15m", "trail": True}) == "15m · trailing stop"
    assert ex.variant_label("purple_pa", {"tf": "5m"}) == "5m candles"
    assert ex.variant_label("scribd_supertrend", {"exit": "fixed"}) == "fixed 15-point target"
    assert ex.variant_label("ict_ea", {"min_conf": 3}) == "source settings"
    assert ex.variant_label("ict_ea", {"min_conf": 7}) == "all components (score 7)"
    spf = {"swing_tf": "1h", "risk": 15, "rr": 1, "tie": "5m"}
    assert ex.variant_label("swing_point_failure", spf) == "1h swings · stop ≤15 / target 15 ticks · tie 5m"
    rev = {"risk": 25, "rr": 2, "sl_tf": "pullback"}
    want = "stop ≤25 / target 50 ticks · stop from setup's 1m/5m chart swings"
    assert ex.variant_label("swing_point_failure_reversal", rev) == want
    assert ex.variant_label("swing_point_failure_reversal", {**rev, "sl_tf": "15m"}).endswith("from 15m chart swings")
    spm = {"risk": 15, "outside": "strict", "confirm": 1, "tp": "swing", "swing_tf": "1h", "entry_tf": "15m"}
    assert ex.variant_label("swing_point_manipulation", spm) == "stop ≤15 ticks · strict swings · waits one 15m candle"
    assert ex.variant_label("swing_point_manipulation", {**spm, "outside": "skip", "confirm": 0}) == (
        "stop ≤15 ticks · outside-candle high ignored")
    assert ex.variant_label("swing_point_manipulation", {**spm, "tp": 60}).endswith("waits one 15m candle · target 60 ticks")


def test_status_line_is_parsed(tmp_path, monkeypatch):
    (tmp_path / "x").mkdir()
    (tmp_path / "x" / "README.md").write_text("# x\n\nStatus: dropped (2026-11-13: loses before fees)\n")
    monkeypatch.setattr(ex, "DOCS", tmp_path)
    assert ex.status_line("x") == {"state": "dropped", "date": "2026-11-13", "reason": "loses before fees"}


def test_missing_status_line_fails_loudly(tmp_path, monkeypatch):
    (tmp_path / "x").mkdir()
    (tmp_path / "x" / "README.md").write_text("# x\n")
    monkeypatch.setattr(ex, "DOCS", tmp_path)
    with pytest.raises(SystemExit):
        ex.status_line("x")


def test_export_has_no_prices_or_trade_rows():
    data = json.loads(ex.OUT.read_text())
    allowed = {
        "strategy", "label", "hash", "period", "run_utc", "params", "trades", "net", "profit_factor", "win_rate",
        "max_drawdown", "pass_rate", "seq_passes", "seq_fails", "cost_per_pass", "years_positive", "years_total",
        "best_of", "years", "equity", "exits",
    }
    for v in data["variants"]:
        assert set(v) == allowed
        assert all(set(p) == {"month", "net"} for p in v["equity"])
        assert all(set(y) == {"year", "net"} for y in v["years"])


def test_rlm_label_names_the_session_clock():
    p = {"sig_tf": "1h", "weight": "flat", "score": 50, "entry": "close", "stop": "band", "exit": "r1",
         "session": "ct:02-10"}
    assert ex.variant_label("rlm", p).endswith("1R target · candles opening 02:00-10:00 Chicago")
    assert ex.variant_label("rlm", {**p, "session": "all"}).endswith("· all hours")
