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

  const SEARCH_ENGINES = Object.freeze({
    google: (_baseUrl, q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    duckduckgo: (_baseUrl, q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    bing: (_baseUrl, q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    brave: (_baseUrl, q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
    ecosia: (_baseUrl, q) => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}`,
    yahoo: (_baseUrl, q) => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
    startpage: (_baseUrl, q) => `https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}`,
    yandex: (_baseUrl, q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}`,
    baidu: (_baseUrl, q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`,
    qwant: (_baseUrl, q) => `https://www.qwant.com/?q=${encodeURIComponent(q)}`,
    kagi: (_baseUrl, q) => `https://kagi.com/search?q=${encodeURIComponent(q)}`,
    perplexity: (_baseUrl, q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`,
    swisscows: (_baseUrl, q) => `https://swisscows.com/web?query=${encodeURIComponent(q)}`,
    ask: (_baseUrl, q) => `https://www.ask.com/web?q=${encodeURIComponent(q)}`,
    aol: (_baseUrl, q) => `https://search.aol.com/aol/search?q=${encodeURIComponent(q)}`,
    searx: (_baseUrl, q) => `https://searx.be/search?q=${encodeURIComponent(q)}`,
    mojeek: (_baseUrl, q) => `https://www.mojeek.com/search?q=${encodeURIComponent(q)}`,
    you: (_baseUrl, q) => `https://you.com/search?q=${encodeURIComponent(q)}`,
    wikipedia: (_baseUrl, q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
    youtube: (_baseUrl, q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    github: (_baseUrl, q) => `https://github.com/search?q=${encodeURIComponent(q)}`,
    reddit: (_baseUrl, q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
    staunt: (baseUrl, q) => `${baseUrl}/?q=${encodeURIComponent(q)}`
  });

  const ENGINE_METADATA = Object.freeze({
    google: { id: 'google', name: 'Google', label: 'Google', icon: '🔍', queryParam: 'q', domain: 'google.com', template: 'https://www.google.com/search?q=%s' },
    duckduckgo: { id: 'duckduckgo', name: 'DuckDuckGo', label: 'DuckDuckGo', icon: '🦆', queryParam: 'q', domain: 'duckduckgo.com', template: 'https://duckduckgo.com/?q=%s' },
    bing: { id: 'bing', name: 'Bing', label: 'Bing', icon: 'ᵇ', queryParam: 'q', domain: 'bing.com', template: 'https://www.bing.com/search?q=%s' },
    brave: { id: 'brave', name: 'Brave Search', label: 'Brave Search', icon: '🦁', queryParam: 'q', domain: 'search.brave.com', template: 'https://search.brave.com/search?q=%s' },
    ecosia: { id: 'ecosia', name: 'Ecosia', label: 'Ecosia', icon: '🌳', queryParam: 'q', domain: 'ecosia.org', template: 'https://www.ecosia.org/search?q=%s' },
    yahoo: { id: 'yahoo', name: 'Yahoo', label: 'Yahoo', icon: 'Y!', queryParam: 'p', domain: 'search.yahoo.com', template: 'https://search.yahoo.com/search?p=%s' },
    startpage: { id: 'startpage', name: 'Startpage', label: 'Startpage', icon: '🛡️', queryParam: 'query', domain: 'startpage.com', template: 'https://www.startpage.com/sp/search?query=%s' },
    yandex: { id: 'yandex', name: 'Yandex', label: 'Yandex', icon: 'Я', queryParam: 'text', domain: 'yandex.com', template: 'https://yandex.com/search/?text=%s' },
    baidu: { id: 'baidu', name: 'Baidu', label: 'Baidu', icon: '🐾', queryParam: 'wd', domain: 'baidu.com', template: 'https://www.baidu.com/s?wd=%s' },
    qwant: { id: 'qwant', name: 'Qwant', label: 'Qwant', icon: '🇶', queryParam: 'q', domain: 'qwant.com', template: 'https://www.qwant.com/?q=%s' },
    kagi: { id: 'kagi', name: 'Kagi', label: 'Kagi', icon: '🐕', queryParam: 'q', domain: 'kagi.com', template: 'https://kagi.com/search?q=%s' },
    perplexity: { id: 'perplexity', name: 'Perplexity AI', label: 'Perplexity AI', icon: '✦', queryParam: 'q', domain: 'perplexity.ai', template: 'https://www.perplexity.ai/search?q=%s' },
    swisscows: { id: 'swisscows', name: 'Swisscows', label: 'Swisscows', icon: '🐄', queryParam: 'query', domain: 'swisscows.com', template: 'https://swisscows.com/web?query=%s' },
    ask: { id: 'ask', name: 'Ask.com', label: 'Ask.com', icon: '❓', queryParam: 'q', domain: 'ask.com', template: 'https://www.ask.com/web?q=%s' },
    aol: { id: 'aol', name: 'AOL', label: 'AOL', icon: '🅰️', queryParam: 'q', domain: 'search.aol.com', template: 'https://search.aol.com/aol/search?q=%s' },
    searx: { id: 'searx', name: 'SearXNG', label: 'SearXNG', icon: '🔬', queryParam: 'q', domain: 'searx.be', template: 'https://searx.be/search?q=%s' },
    mojeek: { id: 'mojeek', name: 'Mojeek', label: 'Mojeek', icon: '🇬🇧', queryParam: 'q', domain: 'mojeek.com', template: 'https://www.mojeek.com/search?q=%s' },
    you: { id: 'you', name: 'You.com', label: 'You.com', icon: '🆈', queryParam: 'q', domain: 'you.com', template: 'https://you.com/search?q=%s' },
    wikipedia: { id: 'wikipedia', name: 'Wikipedia', label: 'Wikipedia', icon: 'W', queryParam: 'search', domain: 'wikipedia.org', template: 'https://en.wikipedia.org/wiki/Special:Search?search=%s' },
    youtube: { id: 'youtube', name: 'YouTube', label: 'YouTube', icon: '▶️', queryParam: 'search_query', domain: 'youtube.com', template: 'https://www.youtube.com/results?search_query=%s' },
    github: { id: 'github', name: 'GitHub', label: 'GitHub', icon: '🐙', queryParam: 'q', domain: 'github.com', template: 'https://github.com/search?q=%s' },
    reddit: { id: 'reddit', name: 'Reddit', label: 'Reddit', icon: '🤖', queryParam: 'q', domain: 'reddit.com', template: 'https://www.reddit.com/search/?q=%s' },
    staunt: { id: 'staunt', name: 'STAUNT', label: 'STAUNT Search', icon: '▲', queryParam: 'q', domain: 'staunt.vercel.app', template: 'https://staunt.vercel.app/?q=%s' },
    custom: { id: 'custom', name: 'Custom', label: 'Custom Engine', icon: '⚙️', queryParam: 'q', domain: '', template: 'Custom URL Template' }
  });

  function formatCustomSearchUrl(customTemplate, query) {
    const cleanTemplate = String(customTemplate || '').trim();
    const encoded = encodeURIComponent(query || '');
    if (!cleanTemplate) {
      return `https://www.google.com/search?q=${encoded}`;
    }
    if (cleanTemplate.includes('%s')) {
      return cleanTemplate.replace(/%s/g, encoded);
    }
    if (cleanTemplate.includes('{query}')) {
      return cleanTemplate.replace(/\{query\}/g, encoded);
    }
    if (cleanTemplate.includes('{searchTerms}')) {
      return cleanTemplate.replace(/\{searchTerms\}/g, encoded);
    }
    const sep = cleanTemplate.includes('?') ? '&' : '?';
    return `${cleanTemplate}${sep}q=${encoded}`;
  }

  class NativeSearchClient {
    constructor(config = {}) {
      const normalized = { ...config };
      if (config.apiBaseUrl) normalized.SEARCH_API_BASE_URL = config.apiBaseUrl;
      if (config.webUrl) normalized.SEARCH_WEB_URL = config.webUrl;
      if (config.connectTimeoutMs) normalized.CONNECT_TIMEOUT_MS = config.connectTimeoutMs;
      if (config.readTimeoutMs) normalized.READ_TIMEOUT_MS = config.readTimeoutMs;
      this.config = Object.freeze({ ...SEARCH_CONFIG, ...normalized });
      this.activeEngine = config.searchEngine || 'staunt';
      this.customSearchUrl = config.customSearchUrl || '';
    }

    setSearchEngine(engine, customUrl) {
      const clean = String(engine || 'staunt').toLowerCase().trim();
      if (clean === 'custom') {
        this.activeEngine = 'custom';
      } else {
        this.activeEngine = SEARCH_ENGINES[clean] ? clean : 'staunt';
      }
      if (customUrl !== undefined && customUrl !== null) {
        this.customSearchUrl = String(customUrl).trim();
      }
    }

    getEngineMetadata(engine = null) {
      const key = String(engine || this.activeEngine || 'staunt').toLowerCase().trim();
      return ENGINE_METADATA[key] || ENGINE_METADATA.staunt;
    }

    /**
     * Deterministic query classification:
     * - BLOCKED: dangerous executable/injection URI (javascript:, vbscript:, data:text/html)
     * - INVALID_URL: explicitly malformed URL syntax (e.g. "https://", invalid port, broken host)
     * - URL: valid http://, https://, file://, staunt://, about:
     * - DOMAIN: localhost, IPv4/IPv6, or valid domain without spaces
     * - MATH: arithmetic expression
     * - SEARCH: plain keywords, phrases, web queries
     */
    classifyInput(input, engineOverride = null, customUrlOverride = null) {
      const sanitized = String(input || '').replace(/[\x00-\x1f\x7f]/g, '').trim();
      if (!sanitized) {
        return { type: 'EMPTY', value: '', url: null, query: null };
      }

      // 0. Block dangerous URI schemes immediately
      if (/^(javascript|vbscript):/i.test(sanitized) || /^data:\s*text\/html/i.test(sanitized)) {
        return { type: 'BLOCKED', value: sanitized, url: null, query: null, error: 'Blocked unsafe URI scheme' };
      }

      // 1. Internal STAUNT / about URLs
      if (/^staunt:\/\/[a-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/i.test(sanitized) || /^about:(blank|newtab)$/i.test(sanitized)) {
        return { type: 'URL', url: sanitized, query: null };
      }

      // 2. Explicit http:// or https:// or file:// URLs (strictly validate with URL parser)
      if (/^(https?|file):\/\//i.test(sanitized)) {
        // Check spaces inside authority section (before first /, ?, or #)
        const schemeEnd = sanitized.indexOf('://') + 3;
        const afterScheme = sanitized.slice(schemeEnd);
        const pathStart = afterScheme.search(/[/?#]/);
        const authority = pathStart === -1 ? afterScheme : afterScheme.slice(0, pathStart);
        if (!authority || /\s/.test(authority) || authority.includes('..')) {
          return { type: 'INVALID_URL', value: sanitized, url: null, query: null, error: 'Malformed URL host' };
        }
        try {
          const parsed = new URL(sanitized);
          if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.hostname) {
            return { type: 'INVALID_URL', value: sanitized, url: null, query: null, error: 'Missing hostname' };
          }
          if (parsed.port) {
            const pNum = Number(parsed.port);
            if (!Number.isInteger(pNum) || pNum < 1 || pNum > 65535) {
              return { type: 'INVALID_URL', value: sanitized, url: null, query: null, error: 'Invalid port number' };
            }
          }
          return { type: 'URL', url: parsed.href, query: null };
        } catch (_err) {
          return { type: 'INVALID_URL', value: sanitized, url: null, query: null, error: 'Malformed URL syntax' };
        }
      }

      // Reject incomplete/malformed explicit scheme-like prefixes such as "http:", "https:" without //
      if (/^https?:(?![/]{2})/i.test(sanitized) || /^(https?|ftp):\/\/$/i.test(sanitized)) {
        return { type: 'INVALID_URL', value: sanitized, url: null, query: null, error: 'Incomplete URL' };
      }

      // 3. Localhost, IPv4 & IPv6 Bracketed Addresses
      const isLocalhost = /^localhost(:\d+)?([/?#].*)?$/i.test(sanitized) || /^127\.0\.0\.1(:\d+)?([/?#].*)?$/.test(sanitized);
      if (isLocalhost) {
        try {
          const parsed = new URL('http://' + sanitized);
          return { type: 'DOMAIN', url: parsed.href, query: null };
        } catch (_) {
          return { type: 'INVALID_URL', value: sanitized, url: null, query: null, error: 'Invalid localhost port or path' };
        }
      }

      const isIpv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(:\d+)?([/?#].*)?$/.test(sanitized);
      if (isIpv4) {
        try {
          const parsed = new URL('http://' + sanitized);
          return { type: 'DOMAIN', url: parsed.href, query: null };
        } catch (_) {
          return { type: 'INVALID_URL', value: sanitized, url: null, query: null, error: 'Invalid IPv4 URL' };
        }
      }

      const isIpv6 = /^\[[0-9a-fA-F:]+\](:\d+)?([/?#].*)?$/.test(sanitized);
      if (isIpv6) {
        try {
          const parsed = new URL('http://' + sanitized);
          return { type: 'DOMAIN', url: parsed.href, query: null };
        } catch (_) {
          return { type: 'INVALID_URL', value: sanitized, url: null, query: null, error: 'Invalid IPv6 URL' };
        }
      }

      // 4. Domain Names (e.g. github.com, python.org, example.org/path?a=1#h)
      // Labels may not begin/end with hyphen, must not have spaces or consecutive dots, valid 2-24 char alpha TLD
      const isDomain = !/\s/.test(sanitized) &&
        !sanitized.includes('..') &&
        /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,24}(:\d{1,5})?([/?#].*)?$/i.test(sanitized);
      if (isDomain) {
        try {
          const parsed = new URL('https://' + sanitized);
          if (parsed.port) {
            const pNum = Number(parsed.port);
            if (!Number.isInteger(pNum) || pNum < 1 || pNum > 65535) {
              return { type: 'INVALID_URL', value: sanitized, url: null, query: null, error: 'Invalid port number' };
            }
          }
          return { type: 'DOMAIN', url: parsed.href, query: null };
        } catch (_) {
          return { type: 'INVALID_URL', value: sanitized, url: null, query: null, error: 'Malformed domain' };
        }
      }

      // 5. Pure Mathematical Expression Check
      const isMath = /^[\d\s+\-*/%^().,]+$/.test(sanitized) && /[+\-*/%^]/.test(sanitized) && !/[a-zA-Z]/.test(sanitized);
      if (isMath) {
        return {
          type: 'MATH',
          query: sanitized,
          url: this.buildSearchUrl(sanitized, engineOverride, customUrlOverride)
        };
      }

      // 6. Standard Search Query
      return {
        type: 'SEARCH',
        query: sanitized,
        url: this.buildSearchUrl(sanitized, engineOverride, customUrlOverride)
      };
    }

    /**
     * Builds the direct web SERP URL for a search query using configured engine or custom template.
     */
    buildSearchUrl(query, engineOverride = null, customUrlOverride = null) {
      const clean = (query || '').trim();
      const engKey = String(engineOverride || this.activeEngine || 'staunt').toLowerCase().trim();
      if (engKey === 'custom') {
        const customTpl = (customUrlOverride !== null && customUrlOverride !== undefined) ? customUrlOverride : this.customSearchUrl;
        return formatCustomSearchUrl(customTpl, clean);
      }
      const builder = SEARCH_ENGINES[engKey] || SEARCH_ENGINES.staunt;
      return builder(this.config.SEARCH_WEB_URL, clean);
    }

    /**
     * Extracts search query across all supported search engines (Google, DuckDuckGo, Bing, Brave, Ecosia, Yahoo, Startpage, STAUNT, Custom).
     */
    extractSearchQuery(url) {
      if (!url || typeof url !== 'string') return null;
      try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        const p = u.pathname;

        // STAUNT Search
        let configuredHost = '';
        try { configuredHost = new URL(this.config.SEARCH_WEB_URL).hostname.toLowerCase(); } catch (_) {}
        if (host === 'staunt.vercel.app' || host === 'staunt.onrender.com' || (configuredHost && host === configuredHost)) {
          if (u.searchParams.has('q') && (p === '/' || p === '/search')) return u.searchParams.get('q');
        }

        // Iterate through all supported search engines
        for (const [key, meta] of Object.entries(ENGINE_METADATA)) {
          if (meta.domain && host.includes(meta.domain)) {
            if (u.searchParams.has(meta.queryParam)) {
              return u.searchParams.get(meta.queryParam);
            }
          }
        }

        // Custom search engine URL match
        if (this.customSearchUrl) {
          try {
            const dummy = this.customSearchUrl.replace(/%s|\{query\}|\{searchTerms\}/g, 'test');
            const cu = new URL(dummy);
            if (host === cu.hostname.toLowerCase()) {
              if (u.searchParams.has('q')) return u.searchParams.get('q');
              for (const [, v] of u.searchParams.entries()) {
                if (v && v.trim()) return v;
              }
            }
          } catch (_) {}
        }
      } catch (_e) {
        return null;
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
  NativeSearchClient.ENGINES = SEARCH_ENGINES;
  NativeSearchClient.METADATA = ENGINE_METADATA;

  return NativeSearchClient;
}));
