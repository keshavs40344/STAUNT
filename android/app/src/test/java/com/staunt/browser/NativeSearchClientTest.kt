package com.staunt.browser

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class NativeSearchClientTest {

    @Before
    fun setUp() {
        NativeSearchClient.setSearchEngine("google")
    }

    @Test
    fun testAllSearchEnginesUrlGeneration() {
        NativeSearchClient.setSearchEngine("google")
        assertEquals("https://www.google.com/search?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("duckduckgo")
        assertEquals("https://duckduckgo.com/?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("bing")
        assertEquals("https://www.bing.com/search?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("brave")
        assertEquals("https://search.brave.com/search?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("ecosia")
        assertEquals("https://www.ecosia.org/search?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("yahoo")
        assertEquals("https://search.yahoo.com/search?p=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("startpage")
        assertEquals("https://www.startpage.com/sp/search?query=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("yandex")
        assertEquals("https://yandex.com/search/?text=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("baidu")
        assertEquals("https://www.baidu.com/s?wd=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("qwant")
        assertEquals("https://www.qwant.com/?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("kagi")
        assertEquals("https://kagi.com/search?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("perplexity")
        assertEquals("https://www.perplexity.ai/search?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("swisscows")
        assertEquals("https://swisscows.com/web?query=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("ask")
        assertEquals("https://www.ask.com/web?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("aol")
        assertEquals("https://search.aol.com/aol/search?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("searx")
        assertEquals("https://searx.be/search?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("wikipedia")
        assertEquals("https://en.wikipedia.org/wiki/Special:Search?search=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("youtube")
        assertEquals("https://www.youtube.com/results?search_query=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("github")
        assertEquals("https://github.com/search?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("reddit")
        assertEquals("https://www.reddit.com/search/?q=hello%20world", NativeSearchClient.buildSearchUrl("hello world"))

        NativeSearchClient.setSearchEngine("staunt")
        assertTrue(NativeSearchClient.buildSearchUrl("hello world").contains("?q=hello%20world"))
    }

    @Test
    fun testCustomSearchEngineTemplates() {
        NativeSearchClient.setSearchEngine("custom", "https://example.com/search?text=%s")
        assertEquals("https://example.com/search?text=test%20query", NativeSearchClient.buildSearchUrl("test query"))

        NativeSearchClient.setSearchEngine("custom", "https://kagi.com/search?q={query}")
        assertEquals("https://kagi.com/search?q=test%20query", NativeSearchClient.buildSearchUrl("test query"))

        NativeSearchClient.setSearchEngine("custom", "https://searx.be/search?q={searchTerms}")
        assertEquals("https://searx.be/search?q=test%20query", NativeSearchClient.buildSearchUrl("test query"))

        NativeSearchClient.setSearchEngine("custom", "https://custom.engine.org/find")
        assertEquals("https://custom.engine.org/find?q=test%20query", NativeSearchClient.buildSearchUrl("test query"))
    }

    @Test
    fun testExtractSearchQueryFromUrls() {
        assertEquals("android development", NativeSearchClient.extractSearchQuery("https://www.google.com/search?q=android+development&hl=en"))
        assertEquals("kotlin coroutines", NativeSearchClient.extractSearchQuery("https://duckduckgo.com/?q=kotlin+coroutines"))
        assertEquals("brave privacy", NativeSearchClient.extractSearchQuery("https://search.brave.com/search?q=brave+privacy"))
        assertEquals("bing ai", NativeSearchClient.extractSearchQuery("https://www.bing.com/search?q=bing+ai"))
        assertEquals("yahoo sports", NativeSearchClient.extractSearchQuery("https://search.yahoo.com/search?p=yahoo+sports"))
        assertNull(NativeSearchClient.extractSearchQuery("https://github.com/staunt/browser"))
    }

    @Test
    fun testActiveEngineState() {
        NativeSearchClient.setSearchEngine("duckduckgo")
        assertEquals("duckduckgo", NativeSearchClient.activeEngine)
        val meta = NativeSearchClient.getEngineMetadata()
        assertEquals("DuckDuckGo", meta.name)
        assertEquals("duckduckgo.com", meta.domain)
    }
}
