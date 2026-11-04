"""Run Feature 0: one current source-default CL configuration, without a grid search.

From the repo root: .venv/bin/python web/tools/run_original.py <strategy>
Private audit artifacts live in results/<strategy>/original/. Only aggregate results
are exported to the website. This uses the tester; it is not independent replication.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import inspect
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from export_web import Exporter, check_publication, check_trades_match_summary, monthly_curve
from tvtester import metrics
from tvtester.config import DEFAULT
from tvtester.data import Bars, load_bars
from tvtester.engine import run
from tvtester.experiment import EXECUTION_VERSION

# Python argument -> Pine input variable. Extra input controls are included below,
# including inactive ones, so the page states every input rather than only grid axes.
INPUTS = {
    "fair_price_reversal": dict(session="sessionInput", window="windowInput", atr_len="atrLengthInput",
                                atr_mult="atrMultInput", swing="swingInput", target="targetInput"),
    "supertrend_kalman": dict(hours="hoursInput", trigger="triggerInput", vol="volInput", exit="exitInput",
                              rr="rrInput", swing="swingInput", trail_mult="trailMult", kalman_q="kalmanQ",
                              st_factor="stFactor", atr_len="atrLen"),
    "tupa_trade": dict(t_min="tMinInput", tp="tpTicks", max_risk="maxRisk"),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("strategy", choices=INPUTS)
    args = parser.parse_args()
    key = args.strategy
    module = importlib.import_module(f"strategies.{key}")
    pine_path = ROOT / "strategies" / f"{key}.pine"
    pine = pine_path.read_text()
    inputs = []
    values = {}
    for name, value, label in re.findall(
        r'\b(\w+)\s*=\s*input\.(?:string|int|float|bool)\(\s*("[^"]*"|true|false|[-\d.]+)\s*,\s*"([^"]*)"', pine
    ):
        values[name] = json.loads(value)
        inputs.append({"label": label or name, "value": values[name]})
    defaults = inspect.signature(module.STRATEGY).parameters
    params = {}
    for arg, name in INPUTS[key].items():
        value = values[name]
        if arg in ("session", "hours"):
            value = value.lower()
        if value != defaults[arg].default:
            raise ValueError(f"Python/Pine default mismatch: {key}.{arg}")
        params[arg] = value
    if key == "tupa_trade":
        params["session"] = "ny"
        inputs.append({"label": "Session (fixed in source)", "value": "New York, 09:00–14:30 America/New_York"})
    strategy = module.STRATEGY(**params)
    bars = Bars.from_frame(load_bars())
    print(f"F0 {key}: one configuration, {len(bars):,} CL bars; {params}", flush=True)
    result = run(strategy, bars, DEFAULT)
    summary = metrics.summary(result)
    trades = metrics.trade_frame(result)
    out = ROOT / "results" / key / "original"
    out.mkdir(parents=True, exist_ok=True)
    config = {"params": strategy.params, "execution_version": EXECUTION_VERSION, "pine_inputs": inputs}
    (out / "configuration.json").write_text(json.dumps(config, indent=2))
    (out / "summary.json").write_text(json.dumps({"execution_version": EXECUTION_VERSION, "slippage_0": summary},
                                                indent=2, default=str, allow_nan=False))
    trades.to_csv(out / "trades_slippage0.csv", index=False)
    exporter = Exporter(key)
    scenario = exporter.scenario({"slippage_0": summary}, 0)
    public_trades = exporter.trades(out / "trades_slippage0.csv")
    check_trades_match_summary(public_trades, scenario, "F0")
    source_paths = [pine_path, ROOT / "strategies" / f"{key}.py", out / "configuration.json", out / "summary.json",
                    out / "trades_slippage0.csv", ROOT / "data" / "manifest.json"]
    data = {"strategy": key, "generated_utc": datetime.now(UTC).isoformat(),
            "execution_version": EXECUTION_VERSION, "params": strategy.params, "inputs": inputs,
            "scenarios": {"0": scenario},
            "curve": monthly_curve(public_trades, scenario["period_start"], scenario["period_end"], timezone="Asia/Kuala_Lumpur"),
            "sources": [{"path": str(p.relative_to(ROOT)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                        for p in source_paths]}
    check_publication(data)
    target = ROOT / "web" / "src" / "data" / "original" / f"{key}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n")
    print(f"F0 {key}: {scenario['total_closed_trades']} trades; net {scenario['net_profit']:.2f}; wrote {target}", flush=True)


if __name__ == "__main__":
    main()
