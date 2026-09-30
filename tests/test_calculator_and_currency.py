"""
STAUNT — Test Suite for Real Calculator & Live Currency Converter
Tests mathematical evaluation, percentage calculations, division by zero,
currency query parsing, live and mocked exchange rate calculations, caching,
stale rate fallbacks, and search engine integration.
"""
import pytest
import unittest.mock as mock
import sys
import os

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "search-engine", "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import calculator_engine
import currency_engine
from server import app


class TestCalculatorEngine:
    """Unit tests for the safe AST calculator engine."""

    def test_basic_arithmetic_bodmas(self):
        # 120*45 = 5400
        res = calculator_engine.evaluate_calculator_query("120*45")
        assert res is not None
        assert res["result"] == "5400"
        assert res["formatted_result"] == "5,400"
        assert res["raw_result"] == 5400

        # BODMAS: 2 + 3 * 4 = 14 (not 20)
        res_bodmas = calculator_engine.evaluate_calculator_query("2 + 3 * 4")
        assert res_bodmas is not None
        assert res_bodmas["raw_result"] == 14

        # Division with decimals
        res_div = calculator_engine.evaluate_calculator_query("100 / 3")
        assert res_div is not None
        assert "33.33333333" in res_div["result"]

    def test_brackets_and_decimals(self):
        res1 = calculator_engine.evaluate_calculator_query("(10 + 5) * 2")
        assert res1 is not None
        assert res1["raw_result"] == 30

        # Square brackets
        res2 = calculator_engine.evaluate_calculator_query("[10 + 5] * 2")
        assert res2 is not None
        assert res2["raw_result"] == 30

        # Decimals
        res3 = calculator_engine.evaluate_calculator_query("12.5 * 4.2")
        assert res3 is not None
        assert res3["raw_result"] == 52.5

    def test_powers_and_roots(self):
        # 2^10 = 1024
        res_pow = calculator_engine.evaluate_calculator_query("2^10")
        assert res_pow is not None
        assert res_pow["result"] == "1024"
        assert res_pow["formatted_result"] == "1,024"
        assert res_pow["raw_result"] == 1024
        assert res_pow["raw_result"] == 1024

        # sqrt(144) = 12
        res_sqrt = calculator_engine.evaluate_calculator_query("sqrt(144)")
        assert res_sqrt is not None
        assert res_sqrt["result"] == "12"
        assert res_sqrt["raw_result"] == 12

        # Natural phrase: square root of 81
        res_sqrt_phrase = calculator_engine.evaluate_calculator_query("square root of 81")
        assert res_sqrt_phrase is not None
        assert res_sqrt_phrase["raw_result"] == 9

    def test_percentages(self):
        # 15% of 2500 = 375
        res1 = calculator_engine.evaluate_calculator_query("15% of 2500")
        assert res1 is not None
        assert res1["result"] == "375"
        assert res1["raw_result"] == 375
        assert "steps" in res1 and res1["steps"] is not None

        # Natural phrase: what is 15 percent of 2500
        res2 = calculator_engine.evaluate_calculator_query("what is 15 percent of 2500")
        assert res2 is not None
        assert res2["result"] == "375"

        # Percentage addition: 2500 + 10% = 2750
        res3 = calculator_engine.evaluate_calculator_query("2500 + 10%")
        assert res3 is not None
        assert res3["result"] == "2750"

        # Percentage subtraction: 2500 - 15% = 2125
        res4 = calculator_engine.evaluate_calculator_query("2500 - 15%")
        assert res4 is not None
        assert res4["result"] == "2125"

        # Standalone percentage: 15% = 0.15
        res5 = calculator_engine.evaluate_calculator_query("15%")
        assert res5 is not None
        assert res5["raw_result"] == 0.15

    def test_scientific_functions(self):
        # sin(pi/2) = 1
        res_sin = calculator_engine.evaluate_calculator_query("sin(pi / 2)")
        assert res_sin is not None
        assert abs(res_sin["raw_result"] - 1.0) < 1e-6

        # log10(1000) = 3
        res_log = calculator_engine.evaluate_calculator_query("log10(1000)")
        assert res_log is not None
        assert res_log["raw_result"] == 3

    def test_division_by_zero_error(self):
        res = calculator_engine.evaluate_calculator_query("100 / 0")
        assert res is not None
        assert "Division by zero" in res["result"]
        assert res["error"] == "Cannot divide by zero"

    def test_negative_square_root_error(self):
        res = calculator_engine.evaluate_calculator_query("sqrt(-16)")
        assert res is not None
        assert "negative" in res["result"].lower()
        assert res["error"] is not None

    def test_non_math_queries_rejected(self):
        # Text queries should NOT be intercepted as calculations
        assert calculator_engine.evaluate_calculator_query("python programming") is None
        assert calculator_engine.evaluate_calculator_query("c++") is None
        assert calculator_engine.evaluate_calculator_query("what is the weather in Delhi") is None
        assert calculator_engine.evaluate_calculator_query("who was albert einstein") is None

    def test_safe_ast_rejects_arbitrary_code(self):
        # Code execution attempts must be rejected without executing
        assert calculator_engine.evaluate_calculator_query("__import__('os').system('dir')") is None
        assert calculator_engine.evaluate_calculator_query("open('/etc/passwd').read()") is None


class TestCurrencyEngine:
    """Unit tests for the live currency converter engine."""

    def test_currency_query_parsing(self):
        # Standard: 100 USD to INR
        p1 = currency_engine.parse_currency_query("100 USD to INR")
        assert p1 == (100.0, "USD", "INR")

        # In syntax: 50 EUR in INR
        p2 = currency_engine.parse_currency_query("50 EUR in INR")
        assert p2 == (50.0, "EUR", "INR")

        # Equal syntax: 1000 INR = USD
        p3 = currency_engine.parse_currency_query("1000 INR = USD")
        assert p3 == (1000.0, "INR", "USD")

        # No amount specified: USD to INR (defaults to 1.0)
        p4 = currency_engine.parse_currency_query("USD to INR")
        assert p4 == (1.0, "USD", "INR")

        # Conversational: convert 250 GBP to INR
        p5 = currency_engine.parse_currency_query("convert 250 GBP to INR")
        assert p5 == (250.0, "GBP", "INR")

        # Aliases / symbols: 50 euros in rupees
        p6 = currency_engine.parse_currency_query("50 euros in rupees")
        assert p6 == (50.0, "EUR", "INR")

    def test_mocked_conversion_calculation(self):
        mock_rates = {
            "rates": {"INR": 96.0, "EUR": 0.88, "USD": 1.0},
            "time_str": "Wed, 30 Sep 2026 00:00:00 UTC",
            "provider": "MockExchange"
        }
        with mock.patch("currency_engine.fetch_live_rates", return_value=mock_rates):
            # Clear cache for isolated test
            currency_engine.RATES_CACHE.clear()
            res = currency_engine.convert_currency_query("100 USD to INR")

            assert res is not None
            assert res["amount"] == 100.0
            assert res["from_code"] == "USD"
            assert res["to_code"] == "INR"
            assert res["rate"] == 96.0
            assert res["converted_amount"] == 9600.0
            assert "9,600" in res["formatted_result"]
            assert res["provider"] == "MockExchange"
            assert res["is_cached"] is False

    def test_caching_behavior(self):
        mock_rates = {
            "rates": {"INR": 96.5, "USD": 1.0},
            "time_str": "Wed, 30 Sep 2026 00:00:00 UTC",
            "provider": "MockExchange"
        }
        with mock.patch("currency_engine.fetch_live_rates", return_value=mock_rates):
            currency_engine.RATES_CACHE.clear()
            # First call fetches live
            res1 = currency_engine.convert_currency_query("100 USD to INR")
            assert res1["is_cached"] is False

            # Second call must hit cache
            res2 = currency_engine.convert_currency_query("100 USD to INR")
            assert res2["is_cached"] is True
            assert res2["rate"] == 96.5

    def test_stale_cache_fallback(self):
        # Populate cache with old timestamp
        currency_engine.RATES_CACHE["USD"] = {
            "timestamp": 100.0,  # very old timestamp
            "time_str": "Old Recorded Date UTC",
            "provider": "FallbackCache",
            "rates": {"INR": 95.0}
        }
        # Simulate network failure on live refresh
        with mock.patch("currency_engine.fetch_live_rates", return_value=None):
            res = currency_engine.convert_currency_query("100 USD to INR")
            assert res is not None
            assert res["is_stale"] is True
            assert res["rate"] == 95.0
            assert res["timestamp"] == "Old Recorded Date UTC"

    def test_identity_conversion(self):
        res = currency_engine.convert_currency_query("100 USD to USD")
        assert res is not None
        assert res["rate"] == 1.0
        assert res["converted_amount"] == 100.0


class TestSearchIntegration:
    """Integration tests verifying calculator and currency routing in Flask search API."""

    @pytest.fixture
    def client(self):
        return app.test_client()

    def test_math_query_short_circuit(self, client):
        resp = client.get("/api/search?q=120*45")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["provider"] == "local_calculator"
        assert data["intent"]["intent"] == "calculation"
        assert data["instant_answer"]["result"] == "5400"
        assert data["instant_answer"].get("formatted_result") == "5,400"
        assert data["results"] == []

    def test_currency_query_short_circuit(self, client):
        resp = client.get("/api/search?q=100+USD+to+INR")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["provider"] == "live_currency_converter"
        assert data["intent"]["intent"] == "currency_conversion"
        assert data["instant_answer"]["type"] == "currency"
        assert "Indian Rupee" in data["instant_answer"]["result"]

    def test_dedicated_calculate_api(self, client):
        # GET
        resp_get = client.get("/api/calculate?q=2%5E10")
        assert resp_get.status_code == 200
        d1 = resp_get.get_json()
        assert d1["data"]["result"] == "1024"
        assert d1["data"]["formatted_result"] == "1,024"

        # POST
        resp_post = client.post("/api/calculate", json={"expression": "15% of 2500"})
        assert resp_post.status_code == 200
        d2 = resp_post.get_json()
        assert d2["data"]["result"] == "375"

    def test_dedicated_convert_api(self, client):
        resp = client.get("/api/convert?q=50+EUR+to+INR")
        assert resp.status_code == 200
        d = resp.get_json()
        assert d["status"] == "success"
        assert d["data"]["from_code"] == "EUR"
        assert d["data"]["to_code"] == "INR"
