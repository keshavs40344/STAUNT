"""
STAUNT — Test Suite for Complete Answer Engine
Tests intent classification, factual questions, explanations, comparisons,
current-information requests, Hindi/Hinglish queries, grounded synthesis with
numbered citations, honest fallback on insufficient sources, and API contracts.
"""
import pytest
import os
import sys

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "search-engine", "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import answer_engine
from server import app


class TestAnswerEngineIntentClassification:
    """Test suite for detecting questions, explanations, comparisons, and Hinglish queries."""

    def test_factual_questions(self):
        res1 = answer_engine.classify_question_intent("Who was Albert Einstein?")
        assert res1["is_question"] is True
        assert res1["question_type"] in ("factual", "explanation")
        assert res1["question_word"] == "who"

        res2 = answer_engine.classify_question_intent("When did India become independent?")
        assert res2["is_question"] is True
        assert res2["question_type"] in ("factual", "explanation")
        assert res2["question_word"] == "when"

    def test_explanation_requests(self):
        res1 = answer_engine.classify_question_intent("Why is the sky blue?")
        assert res1["is_question"] is True
        assert res1["question_type"] == "explanation"

        res2 = answer_engine.classify_question_intent("Explain photosynthesis.")
        assert res2["is_question"] is True
        assert res2["question_type"] == "explanation"

        res3 = answer_engine.classify_question_intent("How does Python work?")
        assert res3["is_question"] is True
        assert res3["question_type"] == "explanation"

        res4 = answer_engine.classify_question_intent("Explain this topic in simple language.")
        assert res4["is_question"] is True
        assert res4["question_type"] == "explanation"

    def test_comparison_queries(self):
        res1 = answer_engine.classify_question_intent("What is the difference between CA and CMA?")
        assert res1["is_question"] is True
        assert res1["question_type"] == "comparison"
        assert res1["item_a"].lower() == "ca"
        assert res1["item_b"].lower() == "cma"

        res2 = answer_engine.classify_question_intent("Python vs JavaScript")
        assert res2["is_question"] is True
        assert res2["question_type"] == "comparison"

    def test_current_information_queries(self):
        res1 = answer_engine.classify_question_intent("Who is the current Prime Minister of India?")
        assert res1["is_question"] is True
        assert res1["question_type"] == "current_info"
        assert res1["freshness_required"] is True

        res2 = answer_engine.classify_question_intent("What happened in the latest ISRO mission?")
        assert res2["is_question"] is True
        assert res2["question_type"] == "current_info"
        assert res2["freshness_required"] is True

    def test_hindi_hinglish_queries(self):
        res1 = answer_engine.classify_question_intent("photosynthesis kya hai")
        assert res1["is_question"] is True
        assert res1["question_type"] == "hindi_hinglish"

        res2 = answer_engine.classify_question_intent("python kaise kaam karta hai")
        assert res2["is_question"] is True
        assert res2["question_type"] == "hindi_hinglish"

        res3 = answer_engine.classify_question_intent("aaj ka mausam kaisa hai")
        assert res3["is_question"] is True

    def test_step_by_step_math_problem(self):
        res = answer_engine.classify_question_intent("Give me a step-by-step solution to this mathematics problem.")
        assert res["is_question"] is True
        assert res["question_type"] in ("explanation", "math_problem")

    def test_non_question_queries(self):
        res1 = answer_engine.classify_question_intent("python download windows 11")
        assert res1["is_question"] is False

        res2 = answer_engine.classify_question_intent("amazon login")
        assert res2["is_question"] is False


class TestAnswerEngineSynthesis:
    """Test grounded extractive and neural answer synthesis with citations and fallback."""

    def test_grounded_synthesis_with_citations(self):
        query = "Who was Albert Einstein?"
        results = [
            {
                "title": "Albert Einstein - Wikipedia",
                "url": "https://en.wikipedia.org/wiki/Albert_Einstein",
                "domain": "en.wikipedia.org",
                "snippet": "Albert Einstein was a German-born theoretical physicist who is widely held to be one of the greatest and most influential scientists of all time. He is best known for developing the theory of relativity and also made important contributions to quantum mechanics."
            },
            {
                "title": "Albert Einstein Biography - NobelPrize.org",
                "url": "https://www.nobelprize.org/prizes/physics/1921/einstein/biographical/",
                "domain": "nobelprize.org",
                "snippet": "Albert Einstein received the 1921 Nobel Prize in Physics for his services to Theoretical Physics, and especially for his discovery of the law of the photoelectric effect."
            }
        ]

        ans = answer_engine.synthesize_answer(query, results)
        assert ans is not None
        assert ans["is_sufficient"] is True
        assert "Albert Einstein" in ans["direct_answer"]
        assert "[1]" in ans["direct_answer"]
        assert len(ans["sources"]) >= 1
        assert ans["sources"][0]["index"] == 1
        assert "en.wikipedia.org" in ans["sources"][0]["domain"]
        assert len(ans["related_questions"]) >= 2

    def test_comparison_synthesis(self):
        query = "What is the difference between CA and CMA?"
        results = [
            {
                "title": "Difference between CA and CMA",
                "url": "https://example.com/ca-vs-cma",
                "domain": "example.com",
                "snippet": "Chartered Accountants focus primarily on financial accounting, auditing, and taxation laws governed by ICAI. Cost and Management Accountants focus on cost management, budgeting, and strategic planning governed by ICMAI. While CAs deal with external reporting, CMAs specialize in internal cost control."
            }
        ]

        ans = answer_engine.synthesize_answer(query, results)
        assert ans is not None
        assert ans["is_sufficient"] is True
        assert ans["question_type"] == "comparison"
        assert "[1]" in ans["direct_answer"]

    def test_insufficient_sources_fallback(self):
        # Empty results must trigger honest fallback
        ans = answer_engine.synthesize_answer("Who was nonexistentperson12345?", [])
        assert ans is not None
        assert ans["is_sufficient"] is False
        assert "Insufficient information" in ans["direct_answer"]
        assert ans["sources"] == []


class TestSearchAndAnswerAPIContracts:
    """Test Flask integration for /api/search with answers and dedicated /api/answer."""

    @pytest.fixture
    def client(self):
        return app.test_client()

    def test_search_endpoint_with_question_intent(self, client):
        resp = client.get("/api/search?q=Who+was+Albert+Einstein%3F")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "results" in data
        # Normal web results must be preserved
        assert isinstance(data["results"], list)
        # Answer must be attached
        assert "answer" in data
        if data["answer"]:
            assert "direct_answer" in data["answer"]
            assert "sources" in data["answer"]

    def test_search_math_unaffected(self, client):
        # Math queries must stay calculator, answer must be None
        resp = client.get("/api/search?q=120*45")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["provider"] == "local_calculator"
        assert data["instant_answer"]["result"] == "5400"
        assert data.get("answer") is None

    def test_search_currency_unaffected(self, client):
        # Currency conversions must stay live currency converter, answer must be None
        resp = client.get("/api/search?q=100+USD+to+INR")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["provider"] == "live_currency_converter"
        assert data["instant_answer"]["type"] == "currency"
        assert data.get("answer") is None

    def test_dedicated_answer_endpoint_get(self, client):
        resp = client.get("/api/answer?q=Why+is+the+sky+blue%3F")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get("status") in ("success", "insufficient_evidence")
        assert "data" in data
        assert "direct_answer" in data["data"]

    def test_dedicated_answer_endpoint_post(self, client):
        payload = {
            "query": "Explain photosynthesis.",
            "results": [
                {
                    "title": "Photosynthesis - Biology",
                    "url": "https://example.com/photosynthesis",
                    "domain": "example.com",
                    "snippet": "Photosynthesis is the biological process by which green plants and certain other organisms transform light energy into chemical energy. During photosynthesis in green plants, light energy is captured and used to convert water, carbon dioxide, and minerals into oxygen and energy-rich organic compounds."
                }
            ]
        }
        resp = client.post("/api/answer", json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get("status") == "success"
        assert "photosynthesis" in data["data"]["direct_answer"].lower()
        assert "[1]" in data["data"]["direct_answer"]
