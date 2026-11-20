package com.staunt.browser

import android.content.Context
import android.net.Uri

/**
 * STAUNT / VASTUDA — Native Android Search Client
 * Authoritative Architecture: Universal Search Engine Support
 *
 * Centralizes:
 * - Multi-Engine Search Routing (Google, DuckDuckGo, Bing, Brave, Ecosia, Yahoo, Startpage, STAUNT, Custom)
 * - Deterministic Omnibox Input Classification (URL vs Domain vs Math vs Search)
 * - Safe URL construction and Multi-Engine Query Extraction
 * - Zero tracking / Zero credential exposure
 */
object NativeSearchClient {

    const val ENVIRONMENT = "production"

    val SEARCH_API_BASE_URL: String
        get() {
            val prop = System.getProperty("staunt.api.url")
            if (!prop.isNullOrBlank()) {
                return prop.trimEnd('/')
            }
            return "https://staunt.vercel.app"
        }

    val SEARCH_WEB_URL: String
        get() {
            val prop = System.getProperty("staunt.search.url")
            if (!prop.isNullOrBlank()) {
                return prop.trimEnd('/')
            }
            return "https://staunt.vercel.app"
        }

    data class EngineMeta(
        val id: String,
        val name: String,
        val icon: String,
        val domain: String,
        val queryParam: String,
        val template: String
    )

    val SUPPORTED_ENGINES = mapOf(
        "google" to EngineMeta("google", "Google", "🔍", "google.com", "q", "https://www.google.com/search?q=%s"),
        "duckduckgo" to EngineMeta("duckduckgo", "DuckDuckGo", "🦆", "duckduckgo.com", "q", "https://duckduckgo.com/?q=%s"),
        "bing" to EngineMeta("bing", "Bing", "ᵇ", "bing.com", "q", "https://www.bing.com/search?q=%s"),
        "brave" to EngineMeta("brave", "Brave Search", "🦁", "search.brave.com", "q", "https://search.brave.com/search?q=%s"),
        "ecosia" to EngineMeta("ecosia", "Ecosia", "🌳", "ecosia.org", "q", "https://www.ecosia.org/search?q=%s"),
        "yahoo" to EngineMeta("yahoo", "Yahoo", "Y!", "search.yahoo.com", "p", "https://search.yahoo.com/search?p=%s"),
        "startpage" to EngineMeta("startpage", "Startpage", "🛡️", "startpage.com", "query", "https://www.startpage.com/sp/search?query=%s"),
        "yandex" to EngineMeta("yandex", "Yandex", "Я", "yandex.com", "text", "https://yandex.com/search/?text=%s"),
        "baidu" to EngineMeta("baidu", "Baidu", "🐾", "baidu.com", "wd", "https://www.baidu.com/s?wd=%s"),
        "qwant" to EngineMeta("qwant", "Qwant", "🇶", "qwant.com", "q", "https://www.qwant.com/?q=%s"),
        "kagi" to EngineMeta("kagi", "Kagi", "🐕", "kagi.com", "q", "https://kagi.com/search?q=%s"),
        "perplexity" to EngineMeta("perplexity", "Perplexity AI", "✦", "perplexity.ai", "q", "https://www.perplexity.ai/search?q=%s"),
        "swisscows" to EngineMeta("swisscows", "Swisscows", "🐄", "swisscows.com", "query", "https://swisscows.com/web?query=%s"),
        "ask" to EngineMeta("ask", "Ask.com", "❓", "ask.com", "q", "https://www.ask.com/web?q=%s"),
        "aol" to EngineMeta("aol", "AOL", "🅰️", "search.aol.com", "q", "https://search.aol.com/aol/search?q=%s"),
        "searx" to EngineMeta("searx", "SearXNG", "🔬", "searx.be", "q", "https://searx.be/search?q=%s"),
        "mojeek" to EngineMeta("mojeek", "Mojeek", "🇬🇧", "mojeek.com", "q", "https://www.mojeek.com/search?q=%s"),
        "you" to EngineMeta("you", "You.com", "🆈", "you.com", "q", "https://you.com/search?q=%s"),
        "wikipedia" to EngineMeta("wikipedia", "Wikipedia", "W", "wikipedia.org", "search", "https://en.wikipedia.org/wiki/Special:Search?search=%s"),
        "youtube" to EngineMeta("youtube", "YouTube", "▶️", "youtube.com", "search_query", "https://www.youtube.com/results?search_query=%s"),
        "github" to EngineMeta("github", "GitHub", "🐙", "github.com", "q", "https://github.com/search?q=%s"),
        "reddit" to EngineMeta("reddit", "Reddit", "🤖", "reddit.com", "q", "https://www.reddit.com/search/?q=%s"),
        "staunt" to EngineMeta("staunt", "STAUNT Search", "▲", "staunt.vercel.app", "q", "https://staunt.vercel.app/?q=%s"),
        "custom" to EngineMeta("custom", "Custom Search Engine", "⚙️", "", "q", "https://www.google.com/search?q=%s")
    )

    var activeEngine: String = "google"
        private set

    var customSearchUrl: String = ""
        private set

    fun initFromPreferences(context: Context) {
        val prefs = context.getSharedPreferences("staunt_settings", Context.MODE_PRIVATE)
        val savedEngine = prefs.getString("search_engine", "google") ?: "google"
        val savedCustom = prefs.getString("custom_search_url", "") ?: ""
        setSearchEngine(savedEngine, savedCustom)
    }

    fun setSearchEngine(engine: String, customUrl: String = "") {
        val clean = engine.lowercase().trim()
        activeEngine = if (clean == "custom" || SUPPORTED_ENGINES.containsKey(clean)) clean else "google"
        customSearchUrl = customUrl.trim()
    }

    fun getEngineMetadata(engine: String? = null): EngineMeta {
        val key = (engine ?: activeEngine).lowercase().trim()
        return SUPPORTED_ENGINES[key] ?: SUPPORTED_ENGINES["google"]!!
    }

    enum class InputType {
        EMPTY,
        URL,
        DOMAIN,
        MATH,
        SEARCH
    }

    data class Classification(
        val type: InputType,
        val url: String,
        val query: String? = null
    )

    private val DOMAIN_REGEX = Regex(
        "^([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}(:\\d+)?(/.*)?$"
    )

    private val IPV4_REGEX = Regex(
        "^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(:\\d+)?(/.*)?$"
    )

    private val MATH_OPERATOR_REGEX = Regex("[+\\-*/%^]")
    private val MATH_CHAR_SET_REGEX = Regex("^[\\d\\s+\\-*/%^().,]+$")
    private val HAS_ALPHA_REGEX = Regex("[a-zA-Z]")

    /**
     * Deterministic query classification:
     * - URL: starts with http://, https://, file://, staunt://, about:
     * - Domain: localhost, IPv4, 10.0.2.2 (Android emulator host), or standard TLD without spaces
     * - Math: expression with operators and numbers (+, -, *, /, %, ^)
     * - Search: plain keywords, person names, general text
     */
    fun classifyInput(input: String?, engineOverride: String? = null): Classification {
        val trimmed = input?.trim() ?: ""
        if (trimmed.isEmpty()) {
            return Classification(InputType.EMPTY, "")
        }

        // 1. Full Protocol URLs
        val lower = trimmed.lowercase()
        if (lower.startsWith("http://") || lower.startsWith("https://") || 
            lower.startsWith("file://") || lower.startsWith("staunt://") || 
            lower.startsWith("about:")) {
            return Classification(InputType.URL, trimmed)
        }

        // 2. Localhost & IPv4 / Emulator host
        val isLocalhost = lower.startsWith("localhost") || lower.startsWith("127.0.0.1") || lower.startsWith("10.0.2.2")
        if (isLocalhost) {
            return Classification(InputType.DOMAIN, "http://$trimmed")
        }

        if (IPV4_REGEX.matches(trimmed)) {
            return Classification(InputType.DOMAIN, "http://$trimmed")
        }

        // 3. Domain Names (e.g. github.com, python.org, example.org/path)
        if (!trimmed.contains(" ") && DOMAIN_REGEX.matches(trimmed)) {
            return Classification(InputType.DOMAIN, "https://$trimmed")
        }

        // 4. Pure Mathematical Expression Check
        val isMath = MATH_CHAR_SET_REGEX.matches(trimmed) && 
                     MATH_OPERATOR_REGEX.containsMatchIn(trimmed) && 
                     !HAS_ALPHA_REGEX.containsMatchIn(trimmed)
        if (isMath) {
            return Classification(
                type = InputType.MATH,
                url = buildSearchUrl(trimmed, engineOverride),
                query = trimmed
            )
        }

        // 5. Standard Search Query (Persons, Entities, Web Search)
        return Classification(
            type = InputType.SEARCH,
            url = buildSearchUrl(trimmed, engineOverride),
            query = trimmed
        )
    }

    private fun urlEncode(str: String): String {
        return try {
            java.net.URLEncoder.encode(str, "UTF-8").replace("+", "%20")
        } catch (_: Exception) {
            str
        }
    }

    private fun getQueryParam(urlString: String, paramName: String): String? {
        val queryStart = urlString.indexOf('?')
        if (queryStart == -1) return null
        val query = urlString.substring(queryStart + 1)
        for (pair in query.split('&')) {
            val idx = pair.indexOf('=')
            if (idx != -1) {
                val key = pair.substring(0, idx)
                if (key.equals(paramName, ignoreCase = true)) {
                    val rawVal = pair.substring(idx + 1)
                    return try {
                        java.net.URLDecoder.decode(rawVal, "UTF-8")
                    } catch (_: Exception) {
                        rawVal.replace('+', ' ')
                    }
                }
            }
        }
        return null
    }

    /**
     * Builds the direct web SERP URL for a search query using the configured engine.
     */
    fun buildSearchUrl(query: String, engineOverride: String? = null): String {
        val clean = query.trim()
        val encoded = urlEncode(clean)
        val eng = (engineOverride ?: activeEngine).lowercase().trim()

        if (eng == "custom") {
            return if (customSearchUrl.contains("%s")) {
                customSearchUrl.replace("%s", encoded)
            } else if (customSearchUrl.contains("{query}")) {
                customSearchUrl.replace("{query}", encoded)
            } else if (customSearchUrl.contains("{searchTerms}")) {
                customSearchUrl.replace("{searchTerms}", encoded)
            } else if (customSearchUrl.isNotBlank()) {
                val sep = if (customSearchUrl.contains("?")) "&" else "?"
                "$customSearchUrl${sep}q=$encoded"
            } else {
                "https://www.google.com/search?q=$encoded"
            }
        }
        if (eng == "staunt") {
            return "$SEARCH_WEB_URL/?q=$encoded"
        }
        val meta = SUPPORTED_ENGINES[eng]
        if (meta != null) {
            return meta.template.replace("%s", encoded)
        }
        return "https://www.google.com/search?q=$encoded"
    }

    /**
     * Extracts search query from visited URLs across all supported search engines.
     */
    fun extractSearchQuery(url: String?): String? {
        if (url.isNullOrBlank()) return null
        return try {
            val lower = url.lowercase()
            for ((_, meta) in SUPPORTED_ENGINES) {
                if (meta.domain.isNotBlank() && lower.contains(meta.domain.lowercase())) {
                    val q = getQueryParam(url, meta.queryParam)
                    if (!q.isNullOrBlank()) return q
                }
            }
            null
        } catch (_: Exception) {
            null
        }
    }
}
