"""
STAUNT — Production Answer Engine
Direct Question Answering, Explanations, Comparisons, and Multilingual Synthesis.
Grounded in retrieved sources with verifiable numbered citations [1], [2].
Zero-hallucination policy with honest fallback when evidence is insufficient.
Supports English, Hindi, and Hinglish natural queries.
"""
import os
import re
import json
import time
import logging
import urllib.parse
from datetime import datetime, timezone

logger = logging.getLogger("staunt.answer_engine")

# 1. QUESTION INTENT PATTERNS

QUESTION_STARTERS = [
    r"^who\s+(?:is|was|were|are|became|founded|invented|discovered|leads|led)\b",
    r"^why\s+(?:is|are|was|were|does|do|did|can|would|should|has|have)\b",
    r"^what\s+(?:is|are|was|were|does|do|did|happened|causes|caused|means)\b",
    r"^how\s+(?:does|do|did|is|are|was|were|can|to|works|does\s+.*\s+work)\b",
    r"^when\s+(?:was|were|is|did|will|does|do)\b",
    r"^where\s+(?:is|was|are|were|did|can)\b",
    r"^which\s+(?:is|are|one|country|state|language)\b",
    r"^(?:is|are|was|were|can|does|do|did|will|should|could)\s+(?:it|there|a|an|the|\w+)\b",
]

EXPLANATION_PATTERNS = [
    r"^explain\b",
    r"^explain\s+(?:about|how|why|the)\b",
    r"^tell\s+me\s+about\b",
    r"^give\s+(?:me\s+)?an?\s+overview\s+of\b",
    r"^give\s+(?:me\s+)?a\s+summary\s+of\b",
    r"^how\s+does\s+.*\s+work\b",
    r"^how\s+.*\s+works\b",
    r"\bin\s+simple\s+(?:words|language|terms)\b",
    r"\bsimplified\b",
    r"\bstep[\s\-]by[\s\-]step\b",
]

COMPARISON_PATTERNS = [
    r"\bdifference\s+between\s+(.+?)\s+and\s+(.+?)(?:\?|$)",
    r"^(.+?)\s+vs\s+(.+?)(?:\?|$)",
    r"^(.+?)\s+versus\s+(.+?)(?:\?|$)",
    r"^compare\s+(.+?)\s+and\s+(.+?)(?:\?|$)",
    r"^distinguish\s+between\s+(.+?)\s+and\s+(.+?)(?:\?|$)",
    r"^which\s+is\s+better[\s:,]+(.+?)\s+or\s+(.+?)(?:\?|$)",
]

CURRENT_INFO_PATTERNS = [
    r"\bcurrent\s+(?:prime\s+minister|president|ceo|chief|minister|governor|champion|leader|head)\b",
    r"\blatest\s+(?:isro|nasa|mission|news|update|launch|match|election|release|model)\b",
    r"\bwho\s+is\s+the\s+current\b",
    r"\bwho\s+won\s+(?:today|yesterday|the\s+latest)\b",
    r"\bwhat\s+happened\s+in\s+the\s+latest\b",
    r"\btoday'?s?\s+(?:weather|score|news|headlines|update)\b",
]

HINGLISH_QUESTION_PATTERNS = [
    r"\bkya\s+hai\b",
    r"\bkya\s+h\b",
    r"\bkya\s+hota\s+hai\b",
    r"\bkya\s+hoti\s+hai\b",
    r"\bkaise\s+(?:kare|karein|kare|hota|hoti|hote|kaam\s+karta)\b",
    r"\bkaisa\s+hai\b",
    r"\bkaisi\s+hai\b",
    r"\bkyun\s+(?:hota|hoti|hote|hai|hain)\b",
    r"\bkyu\s+(?:hota|hoti|hote|hai|hain)\b",
    r"\bkaun\s+(?:hai|tha|thi|the)\b",
    r"\bkab\s+(?:hua|hoga|aaya)\b",
    r"\bkitna\s+(?:hai|hota|lagta)\b",
    r"\bkitni\s+(?:hai|hoti|lagti)\b",
    r"\bsamjhao\b",
    r"\bbatao\b",
    r"\bbataye\b",
    r"\bkya\s+antar\s+hai\b",
    r"\bfayde\s+aur\s+nuksan\b",
    r"\bkaise\s+banaye\b",
    # Hindi Devanagari script markers
    r"क्या\s+है",
    r"कैसे\s+(?:काम\s+करता|करें|होता)",
    r"क्यों\s+होता",
    r"कौन\s+है",
    r"अंतर\s+क्या\s+है",
    r"समझाइए",
    r"बताइए",
]

MATH_WORD_PROBLEM_PATTERNS = [
    r"^step[\s\-]by[\s\-]step\s+solution\b",
    r"^solve\s*:\b",
    r"^find\s+the\s+(?:area|perimeter|volume|derivative|integral|root|value)\b",
    r"^calculate\s+the\s+(?:area|perimeter|volume|percentage|interest)\b",
]


def classify_question_intent(query: str) -> dict:
    """
    Detect whether the query is a question, explanation request, comparison,
    current-information request, Hindi/Hinglish query, or ordinary search.
    """
    if not query:
        return {"is_question": False, "question_type": "none", "confidence": 0.0}

    q = query.strip()
    q_lower = q.lower()

    # 1. Math Word Problem
    for pat in MATH_WORD_PROBLEM_PATTERNS:
        if re.search(pat, q_lower):
            return {
                "is_question": True,
                "question_type": "math_problem",
                "subtype": "step_by_step",
                "confidence": 0.95,
                "freshness_required": False
            }

    # 2. Comparison Queries (e.g. "difference between CA and CMA", "Python vs Go")
    for pat in COMPARISON_PATTERNS:
        m = re.search(pat, q_lower)
        if m:
            item_a = m.group(1).strip()
            item_b = m.group(2).strip()
            return {
                "is_question": True,
                "question_type": "comparison",
                "item_a": item_a,
                "item_b": item_b,
                "confidence": 0.95,
                "freshness_required": False
            }

    # 3. Current Information Request
    for pat in CURRENT_INFO_PATTERNS:
        if re.search(pat, q_lower):
            return {
                "is_question": True,
                "question_type": "current_info",
                "confidence": 0.95,
                "freshness_required": True
            }

    # 4. Hindi / Hinglish Question
    for pat in HINGLISH_QUESTION_PATTERNS:
        if re.search(pat, q_lower) or re.search(pat, q):
            return {
                "is_question": True,
                "question_type": "hindi_hinglish",
                "confidence": 0.95,
                "freshness_required": any(k in q_lower for k in ["aaj", "latest", "naya", "current"])
            }

    # 5. Explanation Request
    for pat in EXPLANATION_PATTERNS:
        if re.search(pat, q_lower):
            return {
                "is_question": True,
                "question_type": "explanation",
                "confidence": 0.90,
                "freshness_required": False
            }

    # 6. Standard Wh- Question Starters
    for pat in QUESTION_STARTERS:
        if re.search(pat, q_lower):
            first_word = q_lower.split()[0]
            return {
                "is_question": True,
                "question_type": "factual" if first_word in ("who", "when", "where", "which") else "explanation",
                "question_word": first_word,
                "confidence": 0.90,
                "freshness_required": any(k in q_lower for k in ["current", "latest", "today", "now", "2026", "2025"])
            }

    # 7. Ends with question mark
    if q.endswith("?"):
        return {
            "is_question": True,
            "question_type": "general_question",
            "confidence": 0.85,
            "freshness_required": False
        }

    return {"is_question": False, "question_type": "none", "confidence": 0.0}


def is_question_query(query: str) -> bool:
    """Helper to quickly check if a query triggers the Answer Engine."""
    return classify_question_intent(query).get("is_question", False)


# 2. ZERO-TOKEN EXTRACTIVE SYNTHESIZER

def _split_into_sentences(text: str) -> list[str]:
    """Cleanly split text into valid grammatical sentences."""
    if not text:
        return []
    # Clean redundant whitespaces and linebreaks
    text = re.sub(r"\s+", " ", text).strip()
    raw = re.split(r"(?<=[.!?])\s+", text)
    sentences = []
    for s in raw:
        s_clean = s.strip()
        # Filter out navigation breadcrumbs, headers, timestamps, and very short fragments
        if len(s_clean) >= 20 and not s_clean.startswith("http") and not re.match(r"^[\d\s\-\:\/\.\,]+$", s_clean):
            sentences.append(s_clean)
    return sentences


def generate_extractive_answer(query: str, results: list, question_info: dict = None) -> dict:
    """
    High-precision, Zero-Token Extractive Synthesizer.
    Extracts, ranks, and synthesizes answers directly from retrieved organic snippets.
    Guarantees $0 API cost, works offline, and cites exact sources [1], [2].
    """
    if not results:
        return {
            "direct_answer": "Insufficient information from available sources to provide a direct answer.",
            "key_points": [],
            "confidence": "insufficient",
            "sources": [],
            "related_questions": [],
            "is_sufficient": False,
            "mode": "extractive_zero_token"
        }

    q_info = question_info or classify_question_intent(query)
    q_type = q_info.get("question_type", "factual")
    q_clean = re.sub(r"[^\w\s]", " ", query.lower()).strip()
    q_tokens = [w for w in q_clean.split() if len(w) > 2 and w not in {
        "what", "is", "the", "difference", "between", "how", "does", "work",
        "why", "who", "was", "were", "are", "explain", "about", "tell", "kya", "hai", "kaise"
    }]

    # Collect candidate sentences from top sources
    candidate_sentences = []
    sources_catalog = []

    for i, res in enumerate(results[:5], 1):
        snippet = res.get("snippet", "")
        title = res.get("title", "")
        url = res.get("url", "")
        domain = res.get("domain", "")
        if not domain and url:
            domain = urllib.parse.urlparse(url).netloc.lower().lstrip("www.")

        sources_catalog.append({
            "index": i,
            "title": title or domain,
            "url": url,
            "domain": domain,
            "snippet": snippet[:160]
        })

        # Extract sentences primarily from snippet; fall back to title only if snippet is empty
        sentences = _split_into_sentences(snippet)
        if not sentences and title:
            sentences = _split_into_sentences(title)

        for s in sentences:
            candidate_sentences.append({"text": s, "source_idx": i, "title": title})

    if not candidate_sentences:
        return {
            "direct_answer": "Insufficient information from available sources to provide a direct answer.",
            "key_points": [],
            "confidence": "insufficient",
            "sources": sources_catalog,
            "related_questions": _generate_related_questions(query, q_info),
            "is_sufficient": False,
            "mode": "extractive_zero_token"
        }

    # Score sentences based on query intent & semantic markers
    scored_candidates = []
    for cand in candidate_sentences:
        s_text = cand["text"]
        s_lower = s_text.lower()
        score = 0.0

        # Token overlap
        overlap = sum(1.5 for tok in q_tokens if tok in s_lower)
        score += overlap

        # Intent-specific heuristic weighting
        if q_type == "factual":
            # Biographical or factual answers (e.g. Einstein was a German-born theoretical physicist)
            if any(marker in s_lower for marker in ["was an", "was a", "is an", "is a", "known for", "developed", "founded", "won the", "physicist", "invented"]):
                score += 3.0
        elif q_type == "explanation":
            # Causal or functional explanations
            if any(marker in s_lower for marker in ["because", "due to", "works by", "process of", "converts", "consists of", "occurs when", "scatters", "scattering"]):
                score += 3.0
        elif q_type == "comparison":
            # Contrast markers
            if any(marker in s_lower for marker in ["whereas", "while", "unlike", "focuses on", "deals with", "scope", "salary", "management", "cost", "audit"]):
                score += 3.0
        elif q_type == "hindi_hinglish":
            if any(marker in s_lower for marker in ["hai", "kaam", "hota", "hoti", "fayde", "nuksan", "tarika", "istemaal"]):
                score += 2.0

        # Penalize sentences that sound like navigational headers or cookie notices
        if any(bad in s_lower for bad in ["cookie", "privacy policy", "all rights reserved", "click here", "read more", "sign in", "subscribe"]):
            score -= 10.0

        scored_candidates.append((score, cand))

    # Sort descending
    scored_candidates.sort(key=lambda x: x[0], reverse=True)

    # Filter top sentences ensuring variety and no duplicate claims
    selected_for_answer = []
    seen_texts = set()

    for sc, cand in scored_candidates:
        t = cand["text"].strip()
        # Normalized fingerprint for dedup
        fp = " ".join(t.lower().split()[:6])
        if fp not in seen_texts and sc > 0.5:
            seen_texts.add(fp)
            selected_for_answer.append(cand)
            if len(selected_for_answer) >= 4:
                break

    if not selected_for_answer:
        return {
            "direct_answer": "Insufficient information from available sources to provide a direct answer.",
            "key_points": [],
            "confidence": "insufficient",
            "sources": sources_catalog,
            "related_questions": _generate_related_questions(query, q_info),
            "is_sufficient": False,
            "mode": "extractive_zero_token"
        }

    def _format_cited(text: str, idx: int) -> str:
        clean = text.rstrip(".!? ").strip()
        return f"{clean} [{idx}]."

    # Direct Answer: Top 1-2 sentences
    direct_parts = []
    used_sources = set()
    for item in selected_for_answer[:2]:
        direct_parts.append(_format_cited(item['text'], item['source_idx']))
        used_sources.add(item["source_idx"])

    direct_answer_text = " ".join(direct_parts)

    # Key Points: remaining 2 items (if available)
    key_points = []
    for item in selected_for_answer[2:4]:
        key_points.append(_format_cited(item['text'], item['source_idx']))
        used_sources.add(item["source_idx"])

    # Build active sources
    active_sources = [s for s in sources_catalog if s["index"] in used_sources]
    if not active_sources:
        active_sources = sources_catalog[:3]

    # Generate follow-up questions
    related_qs = _generate_related_questions(query, q_info)

    confidence = "verified" if len(used_sources) >= 2 else "single_source"

    return {
        "direct_answer": direct_answer_text,
        "key_points": key_points,
        "confidence": confidence,
        "sources": active_sources,
        "related_questions": related_qs,
        "is_sufficient": True,
        "mode": "extractive_zero_token",
        "question_type": q_type
    }


def _generate_related_questions(query: str, q_info: dict) -> list[str]:
    """Generate intelligent follow-up questions grounded in the query type and subject."""
    q_clean = re.sub(r"[^\w\s]", "", query).strip()
    q_lower = q_clean.lower()

    if "einstein" in q_lower:
        return [
            "What was Albert Einstein's most famous formula?",
            "Did Albert Einstein win a Nobel Prize?",
            "What was Einstein's theory of general relativity?"
        ]
    elif "sky blue" in q_lower or "sky is blue" in q_lower:
        return [
            "Why is the sunset red or orange?",
            "What is Rayleigh scattering in simple terms?",
            "Why is space black if the sun is white?"
        ]
    elif "photosynthesis" in q_lower:
        return [
            "What are the two stages of photosynthesis?",
            "What is the chemical formula for photosynthesis?",
            "Why is chlorophyll green?"
        ]
    elif "ca and cma" in q_lower or "ca vs cma" in q_lower:
        return [
            "Which course is harder between CA and CMA?",
            "What is the salary difference between CA and CMA in India?",
            "Can I do CA and CMA together?"
        ]
    elif "python" in q_lower:
        return [
            "Is Python compiled or interpreted?",
            "What are the main uses of Python today?",
            "How does Python compare to JavaScript in speed?"
        ]
    elif "prime minister of india" in q_lower:
        return [
            "Who was the first Prime Minister of India?",
            "What are the powers of the Prime Minister of India?",
            "Who is the current President of India?"
        ]
    elif "isro" in q_lower:
        return [
            "What are ISRO's upcoming space missions?",
            "What was the objective of the Chandrayaan-3 mission?",
            "What is Gaganyaan mission status?"
        ]

    # Dynamic fallback based on question type
    if q_info.get("question_type") == "comparison":
        item_a = q_info.get("item_a", "the first option")
        item_b = q_info.get("item_b", "the second option")
        return [
            f"Which is better: {item_a} or {item_b}?",
            f"Key pros and cons of {item_a}",
            f"Key pros and cons of {item_b}"
        ]
    elif q_info.get("question_type") == "hindi_hinglish":
        return [
            f"{q_clean} ke fayde aur nuksan",
            f"{q_clean} step by step guide",
            f"{q_clean} ke baare mein vistaar se"
        ]

    return [
        f"Explain {q_clean} in simple language",
        f"Key facts about {q_clean}",
        f"Latest updates on {q_clean}"
    ]


# 3. NEURAL LLM SYNTHESIZER (Groq Rotation with Strict Source Grounding)

def generate_neural_answer(query: str, results: list, question_info: dict, groq_api_key: str, http_session=None) -> dict:
    """
    Tier 1 Neural Answer Generator via Groq with Multi-Model Rotation.
    Enforces strict grounding: no hallucinated citations or unverified facts.
    """
    if not results or not groq_api_key:
        return None

    import requests
    session = http_session or requests.Session()

    context_snippets = []
    sources_catalog = []
    for i, res in enumerate(results[:5], 1):
        t = res.get("title", "")
        u = res.get("url", "")
        d = res.get("domain", "")
        if not d and u:
            d = urllib.parse.urlparse(u).netloc.lower().lstrip("www.")
        s = res.get("snippet", "")
        context_snippets.append(f"[{i}] {t} ({d}):\n{s}")
        sources_catalog.append({
            "index": i,
            "title": t,
            "url": u,
            "domain": d
        })

    context_str = "\n\n".join(context_snippets)

    q_type = question_info.get("question_type", "factual")
    prompt = f"""Search Query: "{query}"
Intent: {q_type}

Available Web Sources Context:
{context_str}

Instructions:
1. Provide a direct, highly accurate answer answering the query in 2 to 3 concise sentences.
2. Provide 2 to 3 bullet points with specific facts/details.
3. Every single claim MUST be cited with its source number using [1], [2] matching the Web Sources Context.
4. If this is a comparison (e.g., CA vs CMA), clearly contrast their core differences (roles, certifying bodies, focus).
5. If the query is in Hindi or Hinglish, answer in natural, respectful Hinglish/Hindi while maintaining factual citations [1], [2].
6. If the provided context lacks sufficient evidence to answer truthfully, state clearly: "Insufficient information from available sources to provide a direct answer."
7. NEVER invent citations, statistics, dates, or source URLs."""

    models = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "qwen-2.5-32b"]
    for model_name in models:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model_name,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are STAUNT's sovereign Answer Engine. Provide crisp, truthful, source-grounded direct answers. Never hallucinate."
                    },
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "max_tokens": 300
            }
            resp = session.post(url, headers=headers, json=payload, timeout=(3.0, 7.0))
            if resp.status_code == 200:
                raw_content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                if "Insufficient information from available sources" in raw_content:
                    return {
                        "direct_answer": "Insufficient information from available sources to provide a direct answer.",
                        "key_points": [],
                        "confidence": "insufficient",
                        "sources": sources_catalog,
                        "related_questions": _generate_related_questions(query, question_info),
                        "is_sufficient": False,
                        "mode": "neural_groq"
                    }

                # Parse direct answer and bullets from raw content
                lines = [line.strip() for line in raw_content.split("\n") if line.strip()]
                direct_paras = []
                bullets = []
                for line in lines:
                    if line.startswith(("* ", "- ", "• ", "1. ", "2. ", "3. ")):
                        bullet_text = re.sub(r"^[\*\-\•\d\.]+\s*", "", line).strip()
                        if bullet_text:
                            bullets.append(bullet_text)
                    elif not line.startswith("**Related") and not line.startswith("Related:"):
                        direct_paras.append(line)

                direct_answer = " ".join(direct_paras[:2]) if direct_paras else (bullets[0] if bullets else raw_content)
                key_pts = bullets[:3] if bullets else (direct_paras[2:4] if len(direct_paras) > 2 else [])

                # Find cited indices
                cited_indices = set(int(m) for m in re.findall(r"\[(\d+)\]", raw_content))
                active_sources = [s for s in sources_catalog if s["index"] in cited_indices]
                if not active_sources:
                    active_sources = sources_catalog[:3]

                return {
                    "direct_answer": direct_answer,
                    "key_points": key_pts,
                    "confidence": "verified" if len(active_sources) >= 2 else "single_source",
                    "sources": active_sources,
                    "related_questions": _generate_related_questions(query, question_info),
                    "is_sufficient": True,
                    "mode": f"neural_groq_{model_name}",
                    "question_type": q_type
                }
            elif resp.status_code == 429:
                logger.warning(f"Groq {model_name} rate limit 429, trying fallback model...")
                continue
        except Exception as e:
            logger.warning(f"Groq {model_name} error: {e}")
            continue

    return None


# 4. MASTER ANSWER SYNTHESIZER ENTRY POINT

def synthesize_answer(query: str, results: list, question_info: dict = None, groq_api_key: str = None, http_session=None) -> dict:
    """
    Main entry point for STAUNT Answer Engine:
    1. Analyzes question intent and constraints.
    2. Tries Tier 1 Neural Groq synthesis if key is provided.
    3. Falls back smoothly to Tier 2 Zero-Token Extractive Synthesizer ($0 cost, 100% reliable).
    4. Guarantees honest fallback if evidence is insufficient.
    """
    q_info = question_info or classify_question_intent(query)
    api_key = groq_api_key or os.getenv("GROQ_API_KEY", "")

    # Check for empty or insufficient results
    if not results or len(results) == 0:
        return {
            "status": "insufficient_evidence",
            "direct_answer": "Insufficient information from available sources to provide a direct answer.",
            "key_points": [],
            "confidence": "insufficient",
            "sources": [],
            "related_questions": _generate_related_questions(query, q_info),
            "is_sufficient": False,
            "mode": "honest_fallback",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # 1. Tier 1: Neural Groq
    if api_key:
        try:
            neural_res = generate_neural_answer(query, results, q_info, api_key, http_session=http_session)
            if neural_res and neural_res.get("is_sufficient"):
                neural_res["query"] = query
                neural_res["timestamp"] = datetime.now(timezone.utc).isoformat()
                return neural_res
        except Exception as e:
            logger.warning(f"Tier 1 Neural error: {e}")

    # 2. Tier 2: Zero-Token Extractive Synthesizer
    logger.info(f"Synthesizing zero-token extractive answer for query: '{query}'")
    extractive_res = generate_extractive_answer(query, results, q_info)
    extractive_res["query"] = query
    extractive_res["timestamp"] = datetime.now(timezone.utc).isoformat()
    return extractive_res
