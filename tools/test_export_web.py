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


@pytest.mark.parametrize("reasons", [
    {"limit": 1, "entry_price": 75},
    {"limit": {"entry_price": 75}},
    {"stop": 1.5}, {"close": True}, {"roll": "1"}, [],
])
def test_exit_reasons_rejects_injected_keys_and_invalid_counts(reasons):
    with pytest.raises(ew.ExportError, match="exit_reasons"):
        ew.check_publication({"scenarios": [{"exit_reasons": reasons}]})


@pytest.mark.parametrize("params", [
    {"entry_price": 75}, {"raw_symbol": "CLZ6"}, {"profit_pct": 2},
    {"window": {"exit_price": 75}}, {"window": [30]}, {1: 30}, [],
])
def test_params_rejects_injected_keys_and_non_scalar_values(params):
    with pytest.raises(ew.ExportError, match="params"):
        ew.check_publication({"runs": [{"params": params}]})


@pytest.mark.parametrize("key", sorted(FORBIDDEN_KEYS) + ["unexpected_pct"])
def test_publication_rejects_forbidden_keys_at_any_depth(key):
    with pytest.raises(ew.ExportError, match="forbidden publication key"):
        ew.check_publication({"outer": [{"inner": {key: 1}}]})


@pytest.mark.parametrize("value", ["MCL", "NYMEX:MCL1!", "text with MCLZ6 inside", "mcl"])
def test_publication_rejects_mcl_strings(value):
    with pytest.raises(ew.ExportError, match="MCL"):
        ew.check_publication({"outer": [[value]]})


@pytest.mark.parametrize("filters", [
    {}, [["risk_ticks", "min"]], [["risk_ticks", "min", 32, 1]],
    [["entry_price", "min", 75]], [["profit_pct", "min", 2]],
    [["risk_ticks", "unknown", 32]], [["risk_ticks", "min", "32"]],
    [["risk_ticks", "min", True]], [["risk_ticks", "min", float("inf")]],
    [[{"raw_symbol": "CLZ6"}, "min", 32]], [["risk1", "min", 32]],
])
def test_filters_rejects_invalid_entries(filters):
    with pytest.raises(ew.ExportError, match="filter"):
        ew.check_publication({"filters": filters})


@pytest.mark.parametrize("field,value", [
    ("interval", {"entry_price": 75}), ("interval", [None, {"end": "2024-01-01"}]),
    ("interval", [None]), ("winner", {"window": 30}), ("note", 1),
    ("lineage", [{"text": "a note"}]), ("period_start", None),
])
def test_publication_rejects_invalid_interval_and_text_types(field, value):
    with pytest.raises(ew.ExportError):
        ew.check_publication({field: value})


def test_valid_nested_publication_preserves_shapes():
    data = {
        "exit_reasons": {"limit": 1, "stop": 2, "close": 0, "roll": 1},
        "params": {"window": 30, "session": "ny", "enabled": True, "optional": None},
        "filters": [[feature, "min", 0.3] for feature in (
            "anchor_body_atr", "risk_ticks", "minutes_from_open", "range_ratio", "risk_atr",
            "atr_ratio", "er", "hours_since_open", "rvi_side")],
        "interval": [None, "2024-01-01"], "note": "CL only",
        "stats": {key: 1.2 for key in ALLOWED_PCT_KEYS},
    }
    before = json.dumps(data)
    ew.check_publication(data)
    assert json.dumps(data) == before


@pytest.mark.parametrize("injection", [
    {"exit_reasons": {"limit": {"entry_price": 75}}},
    {"params": {"entry_price": 75}},
    {"nested": [{"profit_pct": 1}]},
    {"note": "MCLZ6"},
])
def test_final_check_rejects_before_writing(tmp_path, monkeypatch, injection):
    monkeypatch.setattr(ew, "OUT", tmp_path / "publication")
    monkeypatch.setattr(ew, "PUBLIC_OUT", tmp_path / "public")
    monkeypatch.setattr(ew.Exporter, "feature1", lambda self: injection)
    monkeypatch.setattr(ew.Exporter, "feature2", lambda self: None)
    with pytest.raises(ew.ExportError):
        ew.Exporter("fair_price_reversal").run()
    assert not ew.OUT.exists()


@pytest.mark.skipif(not (ew.ROOT / "results" / "fair_price_reversal" / "ledger.jsonl").exists(),
                    reason="tester results not present")
def test_real_export_publishes_only_allowed_fields(tmp_path, monkeypatch):
    monkeypatch.setattr(ew, "OUT", tmp_path)
    monkeypatch.setattr(ew, "PUBLIC_OUT", tmp_path / "public")
    data = json.loads(ew.Exporter("fair_price_reversal").run().read_text())
    keys = set(walk_keys(data))
    assert not keys & FORBIDDEN_KEYS
    assert {k for k in keys if k.endswith("_pct")} <= ALLOWED_PCT_KEYS
    grid_keys = set(importlib.import_module("strategies.fair_price_reversal").GRID)
    for variant in data["features"]["f1"]["variants"].values():
        assert set(variant["params"]) == grid_keys
    assert data["features"]["f3"] is None


def period_frame(rows):
    return pd.DataFrame({"exit_time": pd.to_datetime([r[0] for r in rows], utc=True), "profit": [r[1] for r in rows]})


PERIOD_TFS = {
    0: period_frame([("2023-01-02T10:00:00+00:00", 50.0), ("2023-02-01T10:00:00+00:00", -10.0)]),
    1: period_frame([("2023-01-02T10:00:00+00:00", 30.0), ("2023-02-01T10:00:00+00:00", -30.0)]),
    2: period_frame([("2023-01-02T10:00:00+00:00", 10.0)]),
}
PERIOD_SCEN = {0: {"total_closed_trades": 2, "net_profit": 40.0}, 1: {"total_closed_trades": 2, "net_profit": 0.0},
               2: {"total_closed_trades": 1, "net_profit": 10.0}}


def test_period_table_aligns_scenarios_and_marks_missing_periods():
    table = ew.period_table(PERIOD_TFS, PERIOD_SCEN, "month", "f1-ny")
    assert table == {"periods": ["2023-01", "2023-02"],
                     "net": {"0": [50.0, -10.0], "1": [30.0, -30.0], "2": [10.0, None]}}


@pytest.mark.parametrize("field,value", [("total_closed_trades", 3), ("net_profit", 41.0)])
def test_period_table_must_add_up_to_the_summary(field, value):
    scen = {k: dict(v) for k, v in PERIOD_SCEN.items()}
    scen[0][field] = value
    with pytest.raises(ew.ExportError, match="f1-ny month at 0 ticks"):
        ew.period_table(PERIOD_TFS, scen, "month", "f1-ny")


def test_year_check_rejects_a_report_mismatch():
    good = [{"year": 2023, "trades": 2, "net_profit": 40.0, "percent_profitable": 50.0, "profit_factor": 5.0}]
    ew.check_year_matches_report(PERIOD_TFS[0], good, "ny")
    for change in ({"trades": 3}, {"net_profit": 40.01}, {"profit_factor": 5.001}, {"year": 2022}):
        with pytest.raises(ew.ExportError, match="does not match the report"):
            ew.check_year_matches_report(PERIOD_TFS[0], [{**good[0], **change}], "ny")


VERDICTS_TS = """export const F2_VERDICTS: Record<string, Record<string, Verdict>> = {
  fair_price_reversal: {
    ny_run: {
      verdict: "candidate",
      reason: "kept",
    },
    asia_run: {
      verdict: "rejected",
      reason: "dropped",
    },
  },
  other: {
    x_run: {
      verdict: "candidate",
      reason: "not this strategy",
    },
  },
};
"""


def test_read_candidates_reads_only_the_named_strategy():
    assert ew.read_candidates(VERDICTS_TS, "fair_price_reversal") == {"ny_run": True, "asia_run": False}
    assert ew.read_candidates(VERDICTS_TS, "missing") == {}


def test_read_candidates_rejects_an_unreadable_entry():
    broken = VERDICTS_TS.replace('verdict: "rejected"', 'verdict: maybe')
    with pytest.raises(ew.ExportError, match="no readable verdict"):
        ew.read_candidates(broken, "fair_price_reversal")


@pytest.mark.skipif(not (ew.ROOT / "results" / "fair_price_reversal" / "ledger.jsonl").exists(),
                    reason="tester results not present")
def test_real_export_writes_period_files_for_f1_and_candidates_only(tmp_path, monkeypatch):
    monkeypatch.setattr(ew, "OUT", tmp_path)
    monkeypatch.setattr(ew, "PUBLIC_OUT", tmp_path / "public")
    stale = tmp_path / "public" / "fair_price_reversal" / "f2-old_run" / "day.json"
    stale.parent.mkdir(parents=True)
    stale.write_text("{}")
    data = json.loads(ew.Exporter("fair_price_reversal").run().read_text())
    assert not stale.exists()
    candidates = ew.read_candidates(ew.VERDICTS.read_text(), "fair_price_reversal")
    expected = {f"f1-{v}" for v in data["features"]["f1"]["variants"]}
    expected |= {f"f2-{r}" for r, is_candidate in candidates.items() if is_candidate}
    written = {p.name for p in (tmp_path / "public" / "fair_price_reversal").iterdir()}
    assert written == expected
    for run in data["features"]["f2"]["runs"]:
        assert (run["periods_year"] is not None) == candidates[run["run_id"]]
    for path in (tmp_path / "public" / "fair_price_reversal").rglob("*.json"):
        doc = json.loads(path.read_text())
        assert doc["grain"] == path.stem and doc["export_version"] == ew.EXPORT_VERSION
        assert doc["generated_utc"] == data["generated_utc"] and doc["strategy"] == "fair_price_reversal"
        assert all(len(doc["net"][k]) == len(doc["periods"]) for k in ("0", "1", "2"))
        ew.check_publication(doc)


@pytest.mark.skipif(not (ew.ROOT / "results" / "fair_price_reversal" / "ledger.jsonl").exists(),
                    reason="tester results not present")
def test_failed_swap_keeps_the_previous_publication(tmp_path, monkeypatch):
    monkeypatch.setattr(ew, "OUT", tmp_path)
    monkeypatch.setattr(ew, "PUBLIC_OUT", tmp_path / "public")
    previous = tmp_path / "public" / "fair_price_reversal" / "f1-ny" / "day.json"
    previous.parent.mkdir(parents=True)
    previous.write_text("old")
    (tmp_path / "fair_price_reversal.json").write_text("old main")
    real_replace = Path.replace

    def failing_replace(self, target):
        if self.name.endswith(".json.tmp"):
            raise OSError("disk full")
        return real_replace(self, target)

    monkeypatch.setattr(Path, "replace", failing_replace)
    with pytest.raises(OSError, match="disk full"):
        ew.Exporter("fair_price_reversal").run()
    assert previous.read_text() == "old"
    assert (tmp_path / "fair_price_reversal.json").read_text() == "old main"
    assert sorted(p.name for p in (tmp_path / "public").iterdir()) == ["fair_price_reversal"]
