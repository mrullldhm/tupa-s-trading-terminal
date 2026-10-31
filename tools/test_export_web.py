import importlib
import json
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent))
import export_web as ew  # noqa: E402

# Price-derived fields that would let a reader rebuild real prices (owner decision 2026-10-31: summaries only).
FORBIDDEN_KEYS = {
    "entry_price", "exit_price", "raw_symbol", "buy_hold_return", "buy_hold_return_pct", "profit_pct", "run_up_pct",
    "drawdown_pct", "avg_trade_pct", "largest_winning_trade_pct", "largest_losing_trade_pct",
}
ALLOWED_PCT_KEYS = {"max_equity_drawdown_pct", "max_equity_runup_pct", "net_profit_pct"}


@pytest.mark.parametrize("symbol", ["CLM0", "CLZ25", "CLF1"])
def test_cl_symbols_pass(symbol):
    ew.check_cl_only(pd.Series([symbol]), "t")


@pytest.mark.parametrize("symbol", ["MCLM0", "CLA0", "CLM0\n", "NQM0", ""])
def test_non_cl_symbols_fail(symbol):
    with pytest.raises(ew.ExportError, match="CL only"):
        ew.check_cl_only(pd.Series(["CLM0", symbol]), "t")


def trades(*rows):
    return pd.DataFrame(rows, columns=["exit_time", "cum_profit"])


def test_trade_list_matching_summary_passes():
    ew.check_trades_match_summary(trades(("2020-01-02", 10.0), ("2020-01-03", 25.5)),
                                  {"total_closed_trades": 2, "net_profit": 25.5}, "t")


def test_trade_count_mismatch_fails():
    with pytest.raises(ew.ExportError, match="1 trade rows"):
        ew.check_trades_match_summary(trades(("2020-01-02", 10.0)), {"total_closed_trades": 2, "net_profit": 10.0}, "t")


def test_trade_net_mismatch_fails():
    with pytest.raises(ew.ExportError, match="end at 10.00"):
        ew.check_trades_match_summary(trades(("2020-01-02", 10.0)), {"total_closed_trades": 1, "net_profit": 99.0}, "t")


def test_monthly_curve_takes_last_value_and_carries_empty_months():
    tf = trades(("2020-02-03 10:00:00+00:00", 5.0), ("2020-02-20 10:00:00+00:00", -3.0),
                ("2020-04-01 10:00:00+00:00", 7.0))
    assert ew.monthly_curve(tf, "2020-01-15", "2020-05-02") == [
        ["2020-01", 0.0], ["2020-02", -3.0], ["2020-03", -3.0], ["2020-04", 7.0], ["2020-05", 7.0]]


REPORT = """## Variant: asia
#### By year (extra, not a TV tab)

| Year | Trades | Net profit | % profitable | Profit factor |
|---|---|---|---|---|
| 2010 | 9 | -556.18 USD | 22.22% | 0.226 |
| 2011 | 3 | 1,130.60 USD | 50.00% | — |

## Variant: ny
#### By year (extra, not a TV tab)

| Year | Trades | Net profit | % profitable | Profit factor |
|---|---|---|---|---|
| 2010 | 1 | 5.00 USD | 100.00% | — |
"""


def test_by_year_reads_only_the_requested_variant():
    rows = ew.parse_by_year(REPORT, "asia")
    assert rows == [
        {"year": 2010, "trades": 9, "net_profit": -556.18, "percent_profitable": 22.22, "profit_factor": 0.226},
        {"year": 2011, "trades": 3, "net_profit": 1130.6, "percent_profitable": 50.0, "profit_factor": None}]


def test_monthly_curve_rejects_exits_outside_the_period():
    with pytest.raises(ew.ExportError, match="outside the test period"):
        ew.monthly_curve(trades(("2021-03-01 10:00:00+00:00", 5.0)), "2020-01-01", "2020-12-31")


def test_report_number_reads_unicode_minus_and_fails_clearly():
    assert ew.report_number("\u22121,130.60 USD") == -1130.6
    with pytest.raises(ew.ExportError, match="cannot read number"):
        ew.report_number("n/a")


def test_by_year_missing_variant_fails():
    with pytest.raises(ew.ExportError, match="london"):
        ew.parse_by_year(REPORT, "london")


def walk_keys(node):
    if isinstance(node, dict):
        for k, v in node.items():
            yield k
            yield from walk_keys(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk_keys(v)


@pytest.mark.skipif(not (ew.ROOT / "results" / "fair_price_reversal" / "ledger.jsonl").exists(),
                    reason="tester results not present")
def test_real_export_publishes_only_allowed_fields(tmp_path, monkeypatch):
    monkeypatch.setattr(ew, "OUT", tmp_path)
    data = json.loads(ew.Exporter("fair_price_reversal").run().read_text())
    keys = set(walk_keys(data))
    assert not keys & FORBIDDEN_KEYS
    assert {k for k in keys if k.endswith("_pct")} <= ALLOWED_PCT_KEYS
    grid_keys = set(importlib.import_module("strategies.fair_price_reversal").GRID)
    for variant in data["features"]["f1"]["variants"].values():
        assert set(variant["params"]) == grid_keys
    assert data["features"]["f3"] is None
