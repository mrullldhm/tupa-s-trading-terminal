"""Calendar-boundary regression tests; run with ../.venv/bin/python -m unittest discover -s tools -p test_malaysia_time.py."""
import unittest

import pandas as pd

import export_web as exporter


class MalaysiaDayTests(unittest.TestCase):
    def test_month_end_equity_uses_malaysian_month_boundary(self):
        trades = pd.DataFrame({"exit_time": ["2025-12-31T15:59:00Z", "2025-12-31T16:00:00Z"], "cum_profit": [10.0, 15.0]})
        self.assertEqual(exporter.monthly_curve(trades, "2025-12-01", "2026-01-02", timezone="Asia/Kuala_Lumpur"),
                         [["2025-12", 10.0], ["2026-01", 15.0]])
        self.assertEqual(exporter.monthly_curve(trades, "2025-12-01", "2026-01-02"),
                         [["2025-12", 15.0], ["2026-01", 15.0]])

    def test_midnight_and_year_boundary_regroup_without_changing_fills(self):
        source = pd.DataFrame({
            "exit_time": pd.to_datetime([
                "2025-12-31T15:59:59Z", "2025-12-31T16:00:00Z", "2026-01-01T15:59:59Z", "2026-01-01T16:00:00Z",
            ]),
            "profit": [10.0, -5.0, 2.0, 20.0],
        })
        original = source.copy(deep=True)
        summaries = {k: {"total_closed_trades": 4, "net_profit": 27.0} for k in exporter.SCENARIOS}
        table = exporter.period_table({k: source for k in exporter.SCENARIOS}, summaries, "day", "test", timezone="Asia/Kuala_Lumpur")
        self.assertEqual(table["periods"], ["2025-12-31", "2026-01-01", "2026-01-02"])
        self.assertEqual(table["net"]["0"], [10.0, -3.0, 20.0])
        pd.testing.assert_frame_equal(source, original)
        utc = exporter.period_table({k: source for k in exporter.SCENARIOS}, summaries, "day", "test")
        self.assertEqual(utc["net"]["0"], [5.0, 22.0])

    def test_selected_day_includes_early_malaysia_morning_and_excludes_next_midnight(self):
        day = pd.Timestamp("2026-10-28", tz="Asia/Kuala_Lumpur")
        exits = pd.to_datetime(["2026-10-27T15:59:59Z", "2026-10-27T16:00:00Z", "2026-10-27T18:30:00Z", "2026-10-28T16:00:00Z"])
        self.assertEqual(((day <= exits) & (exits < day + pd.Timedelta(days=1))).tolist(), [False, True, True, False])


if __name__ == "__main__":
    unittest.main()
