"""Export tester results to JSON for the public site.

Display, never compute: numbers are copied from the tester's own outputs, or produced by the tester's own functions
(period tables come from tvtester.metrics.by_period). The other transforms are key renames, the field allowlist,
and month-end sampling of cumulative closed-trade P&L. No trade rows leave the machine. Period tables go down to
one day (owner decision 2026-10-31), so a day row can hold a single trade's net profit; prices, price-based
percentages and raw symbols are never exported.

Run from the repo root:  .venv/bin/python web/tools/export_web.py fair_price_reversal
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import math
import re
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
OUT = ROOT / "web" / "src" / "data" / "strategies"
# Month, week and day tables are static files the browser fetches on demand; year tables stay in the main JSON.
PUBLIC_OUT = ROOT / "web" / "public" / "data"
VERDICTS = ROOT / "web" / "src" / "data" / "verdicts.ts"
EXPORT_VERSION = 2
FETCHED_GRAINS = ("month", "week", "day")
SCENARIOS = (0, 1, 2)

# Per-scenario fields copied from summary.json. Dollar amounts and counts only, plus percentages of initial
# capital (not of price).
SUMMARY_FIELDS = (
    "max_equity_drawdown", "max_equity_drawdown_pct", "max_equity_runup", "max_equity_runup_pct",
    "sharpe_ratio", "sortino_ratio", "open_pnl", "commission_per_order", "slippage_ticks",
    "net_profit_pct", "period_start", "period_end",
)
ALL_FIELDS = (
    "net_profit", "gross_profit", "gross_loss", "profit_factor", "commission_paid", "total_closed_trades",
    "winning_trades", "losing_trades", "percent_profitable", "avg_trade", "avg_winning_trade", "avg_losing_trade",
    "ratio_avg_win_avg_loss", "largest_winning_trade", "largest_losing_trade", "avg_bars_in_trades",
    "long_trades", "short_trades",
)
SIDE_FIELDS = ("net_profit", "total_closed_trades", "percent_profitable", "profit_factor")
# These percentages use initial capital, never an instrument price.
ALLOWED_PCT_KEYS = {"max_equity_drawdown_pct", "max_equity_runup_pct", "net_profit_pct"}
FORBIDDEN_KEYS = {"entry_price", "exit_price", "raw_symbol", "buy_hold_return"}
EXIT_REASONS = {"limit", "stop", "close", "roll"}
TEXT_FIELDS = {
    "strategy", "generated_utc", "period_start", "period_end", "run_id", "variant", "space", "sampler",
    "objective", "winner", "time_utc", "note", "path", "sha256", "key", "grain",
}


class ExportError(RuntimeError):
    pass


def forbidden_key(key: str) -> bool:
    return key in FORBIDDEN_KEYS or (key.endswith("_pct") and key not in ALLOWED_PCT_KEYS)


def check_exit_reasons(value) -> None:
    if (not isinstance(value, dict)
            or any(k not in EXIT_REASONS or type(v) is not int for k, v in value.items())):
        raise ExportError("exit_reasons must map limit/stop/close/roll to integer counts")


def check_params(value) -> None:
    if not isinstance(value, dict):
        raise ExportError("params must be a flat str-to-scalar mapping")
    for key, scalar in value.items():
        if (not isinstance(key, str) or forbidden_key(key)
                or type(scalar) not in (str, int, float, bool, type(None))
                or (type(scalar) is float and not math.isfinite(scalar))):
            raise ExportError(f"invalid params key or scalar: {key!r}")


def check_filters(value) -> None:
    if not isinstance(value, list):
        raise ExportError("filters must be a list of [feature, operator, threshold]")
    for entry in value:
        if not isinstance(entry, list) or len(entry) != 3:
            raise ExportError("each filter must be a list of exactly 3 values")
        feature, operator, threshold = entry
        # Includes the committed features and supertrend features without allowing arbitrary structures.
        if (not isinstance(feature, str) or not re.fullmatch(r"[a-z_]+", feature)
                or forbidden_key(feature) or not isinstance(operator, str) or operator not in {"min", "max"}
                or type(threshold) not in (int, float) or not math.isfinite(threshold)):
            raise ExportError("invalid filter feature, operator or numeric threshold")


def check_publication(node, path: str = "$") -> None:
    """Validate the complete publication before any output is created, at every nesting depth."""
    if isinstance(node, dict):
        for key, value in node.items():
            label = f"{path}.{key}"
            if isinstance(key, str):
                if forbidden_key(key):
                    raise ExportError(f"forbidden publication key: {label}")
                if "MCL" in key.upper():
                    raise ExportError(f"MCL in publication key: {label}")
                if key == "exit_reasons":
                    check_exit_reasons(value)
                elif key == "params":
                    check_params(value)
                elif key == "filters":
                    check_filters(value)
                elif key == "interval":
                    if (not isinstance(value, list) or len(value) != 2
                            or any(v is not None and not isinstance(v, str) for v in value)):
                        raise ExportError(f"{label} must be [start, end] strings or null")
                elif key == "lineage":
                    if not isinstance(value, list) or any(not isinstance(v, str) for v in value):
                        raise ExportError(f"{label} must be a list of strings")
                elif key in TEXT_FIELDS and not isinstance(value, str):
                    raise ExportError(f"{label} must be str")
            check_publication(value, label)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            check_publication(value, f"{path}[{index}]")
    elif isinstance(node, str) and "MCL" in node.upper():
        raise ExportError(f"MCL in publication string: {path}")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, float):
        return round(v, 4)
    return v


CL_SYMBOL = r"CL[FGHJKMNQUVXZ]\d+"
BY_YEAR_HEADING = "#### By year"


def check_cl_only(symbols: pd.Series, label: str) -> None:
    bad = symbols[~symbols.astype(str).str.fullmatch(CL_SYMBOL)].unique()
    if len(bad):
        raise ExportError(f"non-CL symbol in {label}: {list(bad)[:5]} (CL only, never MCL)")


def check_trades_match_summary(tf: pd.DataFrame, scen: dict, label: str) -> None:
    """A trade list must have the summary's trade count and end at its net profit."""
    if len(tf) != scen["total_closed_trades"]:
        raise ExportError(f"{label}: {len(tf)} trade rows, summary says {scen['total_closed_trades']}")
    last = float(tf["cum_profit"].iloc[-1]) if len(tf) else 0.0
    if abs(last - scen["net_profit"]) > 0.05:
        raise ExportError(f"{label}: trades end at {last:.2f}, summary says {scen['net_profit']:.2f}")


def monthly_curve(tf: pd.DataFrame, start: str, end: str) -> list[list]:
    """Month-end cumulative closed-trade P&L. Months without exits carry the previous value."""
    exit_month = pd.to_datetime(tf["exit_time"], utc=True).dt.tz_localize(None).dt.to_period("M")
    last = tf.assign(month=exit_month).groupby("month")["cum_profit"].last()
    months = pd.period_range(pd.Timestamp(start).tz_localize(None).to_period("M"),
                             pd.Timestamp(end).tz_localize(None).to_period("M"), freq="M")
    outside = last.index.difference(months)
    if len(outside):
        raise ExportError(f"trades exit outside the test period: {[str(m) for m in outside[:3]]}")
    series = last.reindex(months).ffill().fillna(0.0)
    return [[str(month), round(float(value), 2)] for month, value in zip(months, series, strict=True)]


def period_table(tfs: dict[int, pd.DataFrame], scen: dict[int, dict], grain: str, label: str) -> dict:
    """Net profit per exit period for 0, 1 and 2 ticks, from tvtester.metrics.by_period. Each scenario's periods
    must add up to its own summary (trade count and net profit), so nothing is lost or invented."""
    from tvtester import metrics

    nets: dict[int, dict[str, float]] = {}
    for k in SCENARIOS:
        table = metrics.by_period(tfs[k], grain)
        if int(table["trades"].sum()) != scen[k]["total_closed_trades"]:
            raise ExportError(f"{label} {grain} at {k} ticks: {int(table['trades'].sum())} trades, "
                              f"summary says {scen[k]['total_closed_trades']}")
        if abs(float(table["net_profit"].sum()) - scen[k]["net_profit"]) > 0.05:
            raise ExportError(f"{label} {grain} at {k} ticks: periods sum to {table['net_profit'].sum():.2f}, "
                              f"summary says {scen[k]['net_profit']:.2f}")
        nets[k] = {str(p): round(float(v), 2) for p, v in zip(table["period"], table["net_profit"], strict=True)}
    periods = sorted(set().union(*(n.keys() for n in nets.values())))
    return {"periods": periods, "net": {str(k): [nets[k].get(p) for p in periods] for k in SCENARIOS}}


def check_year_matches_report(tf0: pd.DataFrame, report_rows: list[dict], label: str) -> None:
    """The 0-tick year table from by_period must equal the published report table at its printed precision."""
    from tvtester import metrics

    got = metrics.by_period(tf0, "year")
    if len(got) != len(report_rows):
        raise ExportError(f"{label}: {len(got)} years from trades, report has {len(report_rows)}")
    for row, want in zip(got.itertuples(index=False), report_rows, strict=True):
        pf = None if pd.isna(row.profit_factor) else round(float(row.profit_factor), 3)
        same = (int(row.period) == want["year"] and int(row.trades) == want["trades"]
                and round(float(row.net_profit), 2) == round(want["net_profit"], 2)
                and round(float(row.percent_profitable), 2) == round(want["percent_profitable"], 2)
                and pf == (None if want["profit_factor"] is None else round(want["profit_factor"], 3)))
        if not same:
            raise ExportError(f"{label}: year {want['year']} from trades does not match the report table")


def read_candidates(text: str, strategy: str) -> dict[str, bool]:
    """Run id -> is candidate, from the hand-written verdicts in web/src/data/verdicts.ts."""
    block = re.search(rf"^  {re.escape(strategy)}: \{{\n(.*?)^  \}},?$", text, re.M | re.S)
    if not block:
        return {}
    found = re.findall(r'^    (\w+): \{\s*\n\s*verdict: "(candidate|rejected)"', block.group(1), re.M)
    if len(found) != len(re.findall(r"^    \w+: \{", block.group(1), re.M)):
        raise ExportError(f"verdicts.ts: a {strategy} entry has no readable verdict")
    return {run_id: verdict == "candidate" for run_id, verdict in found}


def report_number(cell: str) -> float:
    text = cell.replace("USD", "").replace("%", "").replace(",", "").replace("\u2212", "-").strip()
    try:
        return float(text)
    except ValueError as e:
        raise ExportError(f"cannot read number {cell!r} in a report table") from e


def parse_by_year(report: str, variant: str) -> list[dict]:
    """Copy the 0-tick by-year table of `variant` from a feature-1 report (never re-aggregated)."""
    current, rows, grab = None, [], False
    for line in report.splitlines():
        heading = re.match(r"^## Variant: (\w+)", line)
        if heading:
            current, grab = heading.group(1), False
        if current == variant and line.startswith(BY_YEAR_HEADING):
            grab = True
            continue
        if not grab:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if re.fullmatch(r"\d{4}", cells[0]):
            rows.append({"year": int(cells[0]), "trades": int(cells[1]), "net_profit": report_number(cells[2]),
                         "percent_profitable": report_number(cells[3]),
                         "profit_factor": None if cells[4] in ("—", "-", "") else report_number(cells[4])})
        elif rows:
            break
    if not rows:
        raise ExportError(f"no by-year table for {variant} in the report")
    return rows


class Exporter:
    def __init__(self, strategy: str):
        self.strategy = strategy
        # Parameter allowlist: only the strategy's declared grid parameters (definitions only, no results).
        self.param_keys = tuple(importlib.import_module(f"strategies.{strategy}").GRID)
        self.results = ROOT / "results" / strategy
        self.docs = ROOT / "docs" / "strategies" / strategy
        self.sources: dict[str, str] = {}
        # Fetched period files, keyed by "<f1|f2>-<variant or run id>/<grain>"; written by run() after every check.
        self.period_files: dict[str, dict] = {}
        # One id per export run, stamped on the main JSON and every fetched file, so a page never mixes runs.
        self.generated_utc = datetime.now(UTC).replace(microsecond=0).isoformat()

    def read(self, path: Path) -> Path:
        if not path.exists():
            raise ExportError(f"missing input: {path.relative_to(ROOT)}")
        self.sources[str(path.relative_to(ROOT))] = sha256(path)
        return path

    def scenario(self, summary: dict, k: int) -> dict:
        s = summary[f"slippage_{k}"]
        if s["slippage_ticks"] != k:
            raise ExportError(f"slippage_{k} block reports slippage_ticks={s['slippage_ticks']}")
        out = {f: clean(s[f]) for f in SUMMARY_FIELDS}
        out.update({f: clean(s["all"][f]) for f in ALL_FIELDS})
        out["long"] = {f: clean(s["long"][f]) for f in SIDE_FIELDS}
        out["short"] = {f: clean(s["short"][f]) for f in SIDE_FIELDS}
        reasons = s.get("exit_reasons", {})
        check_exit_reasons(reasons)
        out["exit_reasons"] = dict(reasons)
        return out

    def trades(self, path: Path) -> pd.DataFrame:
        tf = pd.read_csv(self.read(path), usecols=["exit_time", "profit", "cum_profit", "raw_symbol"],
                         parse_dates=["exit_time"])
        check_cl_only(tf["raw_symbol"], str(path.relative_to(ROOT)))
        return tf

    def by_year(self, variant: str) -> list[dict]:
        return parse_by_year(self.read(self.docs / "README.md").read_text(), variant)

    def periods(self, key: str, tfs: dict[int, pd.DataFrame], scen: dict[int, dict]) -> dict:
        """Year table for the main JSON; month, week and day tables queued as fetched files."""
        for grain in FETCHED_GRAINS:
            self.period_files[f"{key}/{grain}"] = {
                "export_version": EXPORT_VERSION, "generated_utc": self.generated_utc, "strategy": self.strategy,
                "key": key, "grain": grain,
                **period_table(tfs, scen, grain, key),
            }
        return period_table(tfs, scen, "year", key)

    def feature1(self) -> dict:
        variants = {}
        grid_sizes = set()
        for vdir in sorted(p for p in self.results.iterdir() if (p / "summary.json").exists()):
            v = vdir.name
            summary = json.loads(self.read(vdir / "summary.json").read_text())
            grid = pd.read_csv(self.read(vdir / "grid.csv"))
            top = grid.sort_values("net_profit", ascending=False, kind="stable").iloc[0]
            net0 = summary["slippage_0"]["all"]["net_profit"]
            if abs(top["net_profit"] - net0) > 0.01:
                raise ExportError(f"{v}: grid top net {top['net_profit']} != summary net {net0}")
            missing = [c for c in self.param_keys if c not in grid.columns]
            if missing:
                raise ExportError(f"{v}: grid.csv lacks declared parameters {missing}")
            params = {c: clean(top[c].item() if hasattr(top[c], "item") else top[c]) for c in self.param_keys}
            grid_sizes.add(len(grid))
            scen, curves, tfs = {}, {}, {}
            for k in SCENARIOS:
                scen[k] = self.scenario(summary, k)
                tfs[k] = self.trades(vdir / f"trades_slippage{k}.csv")
                check_trades_match_summary(tfs[k], scen[k], f"{v} at {k} ticks")
                curves[k] = monthly_curve(tfs[k], scen[k]["period_start"], scen[k]["period_end"])
            by_year = self.by_year(v)
            closed = sum(r["net_profit"] for r in by_year)
            if abs(closed - net0) > 0.05:
                raise ExportError(f"{v}: by-year sum {closed:.2f} != net profit {net0:.2f}")
            check_year_matches_report(tfs[0], by_year, v)
            variants[v] = {"params": params, "grid_size": len(grid), "scenarios": scen,
                           "curve_month_end_closed_pnl": curves, "periods_year": self.periods(f"f1-{v}", tfs, scen)}
        if not variants:
            raise ExportError("no feature-1 variants found")
        return {"variants": variants, "grid_size": sorted(grid_sizes)}

    def feature2(self) -> dict | None:
        ledger_path = self.results / "ledger.jsonl"
        if not ledger_path.exists():
            return None
        ledger = [json.loads(line) for line in self.read(ledger_path).read_text().splitlines() if line.strip()]
        searches: dict[str, dict] = {}
        for e in (e for e in ledger if e["kind"] == "search"):
            if e["run_id"] in searches:
                raise ExportError(f"ledger has two search entries for {e['run_id']}")
            searches[e["run_id"]] = e
        candidates = read_candidates(self.read(VERDICTS).read_text(), self.strategy)
        unjudged = sorted(set(searches) - set(candidates))
        if unjudged:
            raise ExportError(f"no verdict in web/src/data/verdicts.ts for {unjudged}; write it before exporting")
        runs = []
        for run_id, e in searches.items():
            cfg_path = ROOT / "strategies" / "configs" / f"{self.strategy}_{run_id}.json"
            cfg = json.loads(self.read(cfg_path).read_text())
            summary = json.loads(self.read(self.results / "replay" / run_id / "summary.json").read_text())
            scen = {k: self.scenario(summary, k) for k in SCENARIOS}
            exp = cfg["expected"]
            for k in SCENARIOS:
                if (abs(scen[k]["net_profit"] - exp[f"net{k}"]) > 0.01
                        or abs((scen[k]["open_pnl"] or 0.0) - exp[f"open{k}"]) > 0.01
                        or scen[k]["total_closed_trades"] != exp[f"trades{k}"]):
                    raise ExportError(f"{run_id}: replay at {k} ticks does not match frozen config")
            if abs(scen[1]["net_profit"] + (scen[1]["open_pnl"] or 0.0) - exp["objective"]) > 0.01:
                raise ExportError(f"{run_id}: replay objective net1 does not match frozen config")
            tfs, curves = {}, {}
            for k in SCENARIOS:
                tfs[k] = self.trades(self.results / "replay" / run_id / f"trades_slippage{k}.csv")
                check_trades_match_summary(tfs[k], scen[k], f"{run_id} at {k} ticks")
                curves[k] = monthly_curve(tfs[k], scen[k]["period_start"], scen[k]["period_end"])
            # Period tables only for candidates: rejected runs are listed, not drilled into (and not published).
            periods = self.periods(f"f2-{run_id}", tfs, scen) if candidates[run_id] else None
            runs.append({
                "run_id": run_id, "variant": e["variant"], "space": e["space"], "sampler": e["sampler"],
                "objective": e["objective"], "seed": e["seed"], "trials": e["trials"],
                "duplicates": e["duplicates"], "eligible": e["eligible"], "evaluations": e["evaluations"],
                "winner": e["winner"], "time_utc": e["time_utc"], "params": cfg["params"],
                "filters": cfg["filters"], "interval": cfg["interval"], "source_trial": cfg["source"]["trial"],
                "scenarios": scen, "curve_month_end_closed_pnl": curves, "periods_year": periods,
            })
        return {
            "runs": runs,
            "total_trials": sum(r["trials"] for r in runs),
            "total_engine_evaluations": sum(e.get("evaluations", 0) for e in ledger),
            "manual_looks": [{"time_utc": e["time_utc"], "evaluations": e["evaluations"], "note": e["note"]}
                             for e in ledger if e["kind"] == "manual"],
            "lineage": [e["note"] for e in ledger if e["kind"] == "lineage"],
        }

    def run(self) -> Path:
        data = {
            "export_version": EXPORT_VERSION,
            "generated_utc": self.generated_utc,
            "strategy": self.strategy,
            "features": {"f1": self.feature1(), "f2": self.feature2(), "f3": None},
        }
        data["sources"] = [{"path": p, "sha256": h} for p, h in sorted(self.sources.items())]
        check_publication(data)
        for doc in self.period_files.values():
            check_publication(doc)
        return self.publish(data)

    def publish(self, data: dict) -> Path:
        """Write everything to staging first, then swap it in. The old files stay until the swap succeeds."""
        OUT.mkdir(parents=True, exist_ok=True)
        PUBLIC_OUT.mkdir(parents=True, exist_ok=True)
        out = OUT / f"{self.strategy}.json"
        out_tmp = OUT / f".{self.strategy}.json.tmp"
        target = PUBLIC_OUT / self.strategy
        staging = PUBLIC_OUT / f".{self.strategy}.staging"
        backup = PUBLIC_OUT / f".{self.strategy}.previous"
        for p in (staging, backup):
            shutil.rmtree(p, ignore_errors=True)
        staging.mkdir()
        try:
            for name, doc in self.period_files.items():
                path = staging / f"{name}.json"
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(doc, separators=(",", ":"), allow_nan=False) + "\n")
            out_tmp.write_text(json.dumps(data, indent=1, allow_nan=False) + "\n")
            if target.exists():
                target.rename(backup)
            try:
                staging.rename(target)
                out_tmp.replace(out)
            except OSError:
                shutil.rmtree(target, ignore_errors=True)
                if backup.exists():
                    backup.rename(target)
                raise
        finally:
            shutil.rmtree(staging, ignore_errors=True)
            out_tmp.unlink(missing_ok=True)
        shutil.rmtree(backup, ignore_errors=True)
        return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("strategy")
    args = ap.parse_args()
    try:
        out = Exporter(args.strategy).run()
    except ExportError as e:
        print(f"export failed: {e}", file=sys.stderr)
        return 1
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
