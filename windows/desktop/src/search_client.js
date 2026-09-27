/**
 * STAUNT / VASTUDA — Native Production Search Client
 * Phase 5.10 Authoritative Architecture
 * 
 * Centralizes:
 * - Production Search API & Web URLs
 * - Deterministic Omnibox Input Classification (URL vs Domain vs Math vs Search)
 * - Safe network requests with strict timeouts (5s connect, 10s read)
 * - Error classification (Timeout, Network, HTTP, Malformed JSON)
 * - Zero tracking / Zero credential exposure
 */

(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NativeSearchClient = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {

  const SEARCH_CONFIG = Object.freeze({
    ENVIRONMENT: 'production',
    SEARCH_API_BASE_URL: (typeof process !== 'undefined' && process.env && process.env.STAUNT_API_URL) 
      ? process.env.STAUNT_API_URL.replace(/\/+$/, '') 
      : 'https://staunt.vercel.app',
    SEARCH_WEB_URL: (typeof process !== 'undefined' && process.env && process.env.STAUNT_WEB_URL) 
      ? process.env.STAUNT_WEB_URL.replace(/\/+$/, '') 
      : 'https://staunt.vercel.app',
    CONNECT_TIMEOUT_MS: 5000,
    READ_TIMEOUT_MS: 10000,
    MAX_RETRIES: 1
  });

  class NativeSearchClient {
    constructor(config = {}) {
      this.config = Object.freeze({ ...SEARCH_CONFIG, ...config });
    }

    /**
     * Deterministic query classification:
     * - URL: starts with http://, https://, file://, staunt://, about:
     * - Domain: localhost, IPv4, or standard TLD without spaces
     * - Math: expression with operators and numbers (+, -, *, /, %, ^)
     * - Search: plain keywords, person names, general text
     */
    classifyInput(input) {
      const trimmed = (input || '').trim();
      if (!trimmed) {
        return { type: 'EMPTY', value: '', url: null, query: null };
      }

      // 1. Full Protocol URLs
      if (/^https?:\/\//i.test(trimmed) || /^file:\/\//i.test(trimmed) || trimmed.startsWith('staunt://') || trimmed.startsWith('about:')) {
        return { type: 'URL', url: trimmed, query: null };
      }

      // 2. Localhost & IPv4 Addresses
      const isLocalhost = /^localhost(:\d+)?(\/.*)?$/i.test(trimmed) || /^127\.0\.0\.1(:\d+)?(\/.*)?$/.test(trimmed);
      if (isLocalhost) {
        return { type: 'DOMAIN', url: 'http://' + trimmed, query: null };
      }

      const isIpv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(:\d+)?(\/.*)?$/.test(trimmed);
      if (isIpv4) {
        return { type: 'DOMAIN', url: 'http://' + trimmed, query: null };
      }

      // 3. Domain Names (e.g. github.com, python.org, example.org/path)
      // Must contain a valid domain dot, 2+ char TLD, and no spaces
      const isDomain = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed) && !trimmed.includes(' ');
      if (isDomain) {
        return { type: 'DOMAIN', url: 'https://' + trimmed, query: null };
      }

      // 4. Pure Mathematical Expression Check
      // Valid math: contains numbers and arithmetic operators (+, -, *, /, %, ^) but no alphabetic chars
      const isMath = /^[\d\s\+\-\*\/\%\^\(\)\.\,]+$/.test(trimmed) && /[\+\-\*\/\%\^]/.test(trimmed) && !/[a-zA-Z]/.test(trimmed);
      if (isMath) {
        return { 
          type: 'MATH', 
          query: trimmed, 
          url: this.buildSearchUrl(trimmed) 
        };
      }

      // 5. Standard Search Query (Persons, Entities, Web Search)
      return { 
        type: 'SEARCH', 
        query: trimmed, 
        url: this.buildSearchUrl(trimmed) 
      };
    }

    /**
     * Builds the direct web SERP URL for a search query.
     */
    buildSearchUrl(query) {
      const clean = (query || '').trim();
      return `${this.config.SEARCH_WEB_URL}/?q=${encodeURIComponent(clean)}`;
    }

    /**
     * Extracts search query if a given URL is a STAUNT search results URL.
     */
    extractSearchQuery(url) {
      if (!url || typeof url !== 'string') return null;
      try {
        const u = new URL(url);
        const isStaunt = u.hostname.includes('staunt.vercel.app') || 
                        u.hostname.includes('staunt.onrender.com') || 
                        u.pathname.includes('/search');
        if (isStaunt && u.searchParams.has('q')) {
          return u.searchParams.get('q');
        }
      } catch (e) {
        // Fallback regex matching
        const match = url.match(/[?&]q=([^&]+)/);
        if (match && (url.includes('staunt') || url.includes('/search'))) {
          try {
            return decodeURIComponent(match[1].replace(/\+/g, ' '));
          } catch (_) {
            return match[1];
          }
        }
      }
      return null;
    }

    /**
     * Direct production search API request.
     */
    async search(query, options = {}) {
      const cleanQuery = (query || '').trim();
      if (!cleanQuery) {
        return {
          success: false,
          error: { type: 'EMPTY_QUERY', message: 'Search query cannot be empty' },
          data: null
        };
      }

      const url = `${this.config.SEARCH_API_BASE_URL}/api/search?q=${encodeURIComponent(cleanQuery)}`;
      return this._fetchWithTimeout(url, options);
    }

    /**
     * Direct production entity resolution request.
     */
    async entity(query, options = {}) {
      const cleanQuery = (query || '').trim();
      if (!cleanQuery) {
        return {
          success: false,
          error: { type: 'EMPTY_QUERY', message: 'Entity query cannot be empty' },
          data: null
        };
      }

      const url = `${this.config.SEARCH_API_BASE_URL}/api/entity?q=${encodeURIComponent(cleanQuery)}`;
      return this._fetchWithTimeout(url, options);
    }

    /**
     * Direct production health check.
     */
    async health(options = {}) {
      const url = `${this.config.SEARCH_API_BASE_URL}/api/health`;
      return this._fetchWithTimeout(url, options);
    }

    /**
     * Resilient fetch implementation with timeout & clean error categorization.
     */
    async _fetchWithTimeout(url, options = {}) {
      const timeoutMs = options.timeout || (this.config.CONNECT_TIMEOUT_MS + this.config.READ_TIMEOUT_MS);
      
      // Node.js or modern Browser fetch
      const fetchFn = (typeof fetch !== 'undefined') ? fetch : require('node-fetch');
      const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const signal = controller ? controller.signal : undefined;
      let timer = null;

      if (controller) {
        timer = setTimeout(() => controller.abort(), timeoutMs);
      }

      try {
        const resp = await fetchFn(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'STAUNT-NativeBrowser/1.0'
          },
          signal: signal
        });

        if (timer) clearTimeout(timer);

        if (!resp.ok) {
          return {
            success: false,
            status: resp.status,
            error: {
              type: 'HTTP_ERROR',
              status: resp.status,
              message: `Search service returned HTTP ${resp.status}`
            },
            data: null
          };
        }

        let data;
        try {
          data = await resp.json();
        } catch (jsonErr) {
          return {
            success: false,
            status: resp.status,
            error: {
              type: 'MALFORMED_JSON',
              message: 'Search service returned an invalid response format'
            },
            data: null
          };
        }

        return {
          success: true,
          status: resp.status,
          data: data,
          error: null
        };

      } catch (err) {
        if (timer) clearTimeout(timer);

        if (err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
          return {
            success: false,
            error: {
              type: 'TIMEOUT',
              message: 'Search service request timed out. Please check your connection.'
            },
            data: null
          };
        }

        return {
          success: false,
          error: {
            type: 'NETWORK_FAILURE',
            message: 'Unable to connect to search service. Network unavailable.'
          },
          data: null
        };
      }
    }
  }

  // Attach default singleton instance
  NativeSearchClient.defaultInstance = new NativeSearchClient();
  NativeSearchClient.CONFIG = SEARCH_CONFIG;

  return NativeSearchClient;
}));
