package com.staunt.browser

import android.net.Uri

/**
 * STAUNT / VASTUDA — Native Android Search Client
 * Phase 5.10 Authoritative Architecture
 *
 * Centralizes:
 * - Production Search API & Web URLs
 * - Deterministic Omnibox Input Classification (URL vs Domain vs Math vs Search)
 * - Safe URL construction and Search Query Extraction
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
    fun classifyInput(input: String?): Classification {
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
                url = buildSearchUrl(trimmed),
                query = trimmed
            )
        }

        // 5. Standard Search Query (Persons, Entities, Web Search)
        return Classification(
            type = InputType.SEARCH,
            url = buildSearchUrl(trimmed),
            query = trimmed
        )
    }

    /**
     * Builds the direct web SERP URL for a search query.
     */
    fun buildSearchUrl(query: String): String {
        val clean = query.trim()
        val encoded = Uri.encode(clean)
        return "$SEARCH_WEB_URL/?q=$encoded"
    }

    /**
     * Extracts search query if a given URL is a STAUNT search results URL.
     */
    fun extractSearchQuery(url: String?): String? {
        if (url.isNullOrBlank()) return null
        return try {
            val uri = Uri.parse(url)
            val host = uri.host?.lowercase() ?: ""
            val isStaunt = host.contains("staunt.vercel.app") || 
                           host.contains("staunt.onrender.com") || 
                           uri.path?.contains("search") == true
            if (isStaunt) {
                uri.getQueryParameter("q")
            } else {
                null
            }
        } catch (_: Exception) {
            null
        }
    }
}
