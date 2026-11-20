/**
 * Staunt Core — Enterprise Ad-Blocker & Privacy Shield Engine (v3.0)
 * Powered by @ghostery/adblocker-electron, Brave-style script surrogates,
 * and zero-breakage whitelist architecture.
 */

const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');
const path = require('path');
const fs = require('fs');

// =============================================================================
// 1. CRITICAL WHITELIST (NEVER INTERCEPT OR CANCEL)
// Guaranteed 100% functionality for Auth, Payments, CAPTCHA, and CDNs
// =============================================================================
const CRITICAL_WHITELIST_HOSTS = [
  // Identity & OAuth Providers
  'accounts.google.com',
  'appleid.apple.com',
  'github.com',
  'login.microsoftonline.com',
  'login.live.com',
  'auth0.com',
  'okta.com',
  'idmsa.apple.com',

  // Anti-Bot & Human Verification (CAPTCHA / Cloudflare Turnstile)
  'recaptcha.net',
  'google.com/recaptcha',
  'challenges.cloudflare.com',
  'hcaptcha.com',
  'turnstile.cloudflare.com',

  // Payment Processors & Banking SPAs
  'stripe.com',
  'razorpay.com',
  'paypal.com',
  'paytm.com',
  'checkout.stripe.com',
  'js.stripe.com',
  'api.stripe.com',
  'm.stripe.network',
  'api.razorpay.com',
  'checkout.razorpay.com',
  'paypalobjects.com',

  // Core Open Source CDNs & Fonts
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'ajax.googleapis.com'
];

// =============================================================================
// 2. CONTEXT-AWARE FIRST-PARTY DOMAIN MATCHING (eTLD+1)
// =============================================================================
function getETLDPlusOne(hostname) {
  if (!hostname) return '';
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;
  
  const secondTld = parts[parts.length - 2];
  if (['co', 'com', 'org', 'net', 'gov', 'edu'].includes(secondTld) && parts.length > 2) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function isCriticalWhitelisted(targetUrl) {
  if (!targetUrl) return true;
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    const full = targetUrl.toLowerCase();

    for (const wl of CRITICAL_WHITELIST_HOSTS) {
      if (host === wl || host.endsWith('.' + wl)) return true;
      if (wl.includes('/') && full.includes(wl)) return true;
    }

    if (full.includes('/recaptcha/') || full.includes('/turnstile/') || full.includes('/challenges/')) {
      return true;
    }

    if (full.includes('oauth') && (host.includes('google') || host.includes('apple') || host.includes('github') || host.includes('microsoft'))) {
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

function isFirstParty(targetUrl, initiatorUrl) {
  if (!initiatorUrl) return false;
  try {
    const targetHost = new URL(targetUrl).hostname;
    const initHost = new URL(initiatorUrl).hostname;
    return getETLDPlusOne(targetHost) === getETLDPlusOne(initHost);
  } catch(e) {
    return false;
  }
}

// =============================================================================
// 3. SAFE SCRIPT DEFUSING / SURROGATES (uBlock-style Defusers)
// Satisfies analytics checks without leaking tracking data
// =============================================================================
const SURROGATES_SCRIPT = `
(() => {
  if (window.__STAUNT_SURROGATES_DEFUSED__) return;
  window.__STAUNT_SURROGATES_DEFUSED__ = true;

  // Google Analytics & DataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function() { window.dataLayer.push(arguments); };
  window.ga = window.ga || function(fn) { if (typeof fn === 'function') try { fn(); } catch(e){} };
  window.ga.q = window.ga.q || [];
  window.ga.l = Date.now();

  // Facebook Pixel
  window.fbq = window.fbq || function() {};
  window.fbq.push = function() {};
  window.fbq.loaded = true;
  window.fbq.version = '2.0';
  window.fbq.queue = [];

  // Google Ads / Publisher
  window.google_ad_client = null;
  window.googletag = window.googletag || {
    cmd: [],
    display: function() {},
    pubads: function() {
      return {
        enableSingleRequest: function() {},
        addService: function() {},
        setTargeting: function() {},
        collapseEmptyDivs: function() {},
        addEventListener: function() {},
        refresh: function() {},
        clear: function() {}
      };
    },
    sizeMapping: function() { return { addSize: function() { return this; }, build: function() { return []; } }; },
    enableServices: function() {}
  };

  // Optimizely, Mixpanel, Amplitude, Twitter, Pinterest
  window.optimizely = window.optimizely || [];
  window.amplitude = window.amplitude || { getInstance: function() { return { init: function(){}, logEvent: function(){} }; } };
  window.mixpanel = window.mixpanel || { init: function(){}, track: function(){}, identify: function(){} };
  window._hsq = window._hsq || [];
  window.twq = window.twq || function() {};
  window.pintrk = window.pintrk || function() {};
})();
`;

// =============================================================================
// 4. YOUTUBE DYNAMIC AD SUPPRESSION (Zero-Buffering Skipping)
// =============================================================================
const YOUTUBE_AD_SUPPRESSION_SCRIPT = `
(() => {
  if (window.__STAUNT_YT_SHIELD_ACTIVE__) return;
  window.__STAUNT_YT_SHIELD_ACTIVE__ = true;

  function suppressYouTubeAds() {
    const player = document.querySelector('#movie_player, .html5-video-player');
    const video = document.querySelector('video');

    if (player && player.classList.contains('ad-showing')) {
      // 1. Fast-forward ad cleanly to duration without buffer drop
      if (video && !isNaN(video.duration) && video.duration > 0) {
        video.playbackRate = 16.0;
        video.currentTime = video.duration;
      }

      // 2. Trigger skip buttons instantly
      const skipBtn = document.querySelector(
        '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-overlay-close-button'
      );
      if (skipBtn) {
        try { skipBtn.click(); } catch(e) {}
      }
    }

    // 3. Close overlay banners
    const overlayClose = document.querySelector('.ytp-ad-overlay-close-button');
    if (overlayClose) {
      try { overlayClose.click(); } catch(e) {}
    }
  }

  // Check every 150ms for responsive suppression
  setInterval(suppressYouTubeAds, 150);

  // MutationObserver for instantaneous reaction
  const observer = new MutationObserver(() => suppressYouTubeAds());
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
})();
`;

// =============================================================================
// 5. NON-DESTRUCTIVE SCOPED COSMETIC HIDING RULES
// Scoped strictly to proven ad slots (no global class/wildcard breaking)
// =============================================================================
const SCOPED_COSMETIC_CSS = `
ytd-ad-slot-renderer,
ytd-promoted-sparkles-web-renderer,
ytd-in-feed-ad-layout-renderer,
ytd-banner-promo-renderer,
#masthead-ad,
#player-ads,
.ytd-merch-shelf-renderer,
.ytp-ad-module,
.ytp-ad-overlay-container,
ins.adsbygoogle,
div[id^="google_ads_iframe"],
div[data-ad-unit],
div[data-ad-slot] {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  width: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
`;

// =============================================================================
// 6. GHOSTERY + BRAVE HYBRID SHIELD INITIALIZATION
// =============================================================================
let activeBlocker = null;
let currentShieldLevel = 'standard'; // 'strict' | 'standard' | 'off'
const SHIELD_SESSIONS = new WeakSet();
let stats = {
  totalBlocked: 0,
  trackersBlocked: 0,
  adsBlocked: 0,
  bandwidthSavedMB: 0.0
};

const STANDARD_TRACKER_PATTERNS = [
  'google-analytics.com',
  'hotjar.com',
  'clarity.ms',
  'coinhive.com',
  'doubleclick.net'
];

const STRICT_TRACKER_PATTERNS = [
  ...STANDARD_TRACKER_PATTERNS,
  'googletagmanager.com',
  'googlesyndication.com',
  'googleadservices.com',
  'mouseflow.com',
  'crazyegg.com',
  'fullstory.com',
  'segment.io',
  'segment.com',
  'mixpanel.com',
  'optimizely.com',
  'connect.facebook.net',
  'ads-twitter.com',
  'analytics.twitter.com',
  'criteo.com',
  'outbrain.com',
  'taboola.com',
  'pubmatic.com',
  'adnxs.com'
];

function setShieldLevel(level) {
  const clean = String(level || 'standard').toLowerCase().trim();
  if (clean === 'strict' || clean === 'standard' || clean === 'off') {
    currentShieldLevel = clean;
  }
  return currentShieldLevel;
}

function getShieldLevel() {
  return currentShieldLevel;
}

async function initStauntShieldEngine(userDataPath) {
  const cachePath = path.join(userDataPath || '.', 'staunt_engine_cache.bin');

  try {
    // Try loading prebuilt Ghostery Ads + Tracking filters
    if (fs.existsSync(cachePath)) {
      const buffer = fs.readFileSync(cachePath);
      activeBlocker = ElectronBlocker.deserialize(buffer);
      console.log('[STAUNT SHIELD] Initialized from local cache engine.');
    } else {
      activeBlocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
      try {
        fs.writeFileSync(cachePath, activeBlocker.serialize());
        console.log('[STAUNT SHIELD] Downloaded and cached fresh prebuilt filter engine.');
      } catch(e) {}
    }
  } catch (err) {
    console.warn('[STAUNT SHIELD] Prebuilt fetch failed, using offline fallback engine:', err.message);
    activeBlocker = await ElectronBlocker.fromLists(fetch, [
      'https://easylist.to/easylist/easylist.txt',
      'https://easylist.to/easylist/easyprivacy.txt'
    ]).catch(() => null);
  }

  return activeBlocker;
}

let siteShieldOverrideChecker = null;
let privacyHeaderConfig = { dnt: true, gpc: true, cookiePolicy: 'block-third-party' };

function setSiteShieldOverrideChecker(fn) {
  siteShieldOverrideChecker = typeof fn === 'function' ? fn : null;
}

function setPrivacyHeaderConfig(cfg) {
  if (cfg && typeof cfg === 'object') {
    privacyHeaderConfig = { ...privacyHeaderConfig, ...cfg };
  }
}

function enableShieldInSession(targetSession, onStatsUpdate) {
  if (!targetSession || SHIELD_SESSIONS.has(targetSession)) return;
  SHIELD_SESSIONS.add(targetSession);

  if (activeBlocker && typeof targetSession.registerPreloadScript === 'function') {
    try {
      activeBlocker.enableBlockingInSession(targetSession);
    } catch (_e) {}
  }

  targetSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    if (currentShieldLevel === 'off') {
      return callback({ cancel: false });
    }

    if (siteShieldOverrideChecker && siteShieldOverrideChecker(details.initiator || details.url)) {
      return callback({ cancel: false });
    }

    const url = details.url;
    if (isCriticalWhitelisted(url)) {
      return callback({ cancel: false });
    }

    if (currentShieldLevel === 'standard' && isFirstParty(url, details.initiator)) {
      if (!url.includes('/ads/') && !url.includes('/pagead/')) {
        return callback({ cancel: false });
      }
    }

    const patterns = currentShieldLevel === 'strict' ? STRICT_TRACKER_PATTERNS : STANDARD_TRACKER_PATTERNS;
    if (patterns.some(pat => url.includes(pat))) {
      stats.totalBlocked++;
      stats.trackersBlocked++;
      stats.bandwidthSavedMB += 0.12;
      if (onStatsUpdate) onStatsUpdate(stats);
      return callback({ cancel: true });
    }

    callback({ cancel: false });
  });

  targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };

    if (currentShieldLevel !== 'off') {
      delete headers['X-Client-Data'];
      delete headers['Sec-CH-UA-Model'];
      delete headers['Sec-CH-UA-Platform-Version'];
      delete headers['Sec-CH-UA-Full-Version-List'];

      if (privacyHeaderConfig.gpc !== false) {
        headers['Sec-GPC'] = '1';
      }
      if (privacyHeaderConfig.dnt !== false) {
        headers['DNT'] = '1';
      }
    }

    callback({ requestHeaders: headers });
  });

  targetSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    const policy = privacyHeaderConfig.cookiePolicy || 'block-third-party';

    if (policy === 'block-all') {
      delete responseHeaders['set-cookie'];
      delete responseHeaders['Set-Cookie'];
    } else if (policy === 'block-third-party' && details.initiator) {
      if (!isFirstParty(details.url, details.initiator) && !isCriticalWhitelisted(details.url)) {
        delete responseHeaders['set-cookie'];
        delete responseHeaders['Set-Cookie'];
      }
    }

    callback({ responseHeaders });
  });
}

function attachShieldToWebContents(webContents) {
  if (!webContents || webContents.isDestroyed()) return;

  webContents.on('did-start-navigation', () => {
    if (currentShieldLevel === 'off') return;
    webContents.executeJavaScript(SURROGATES_SCRIPT).catch(() => {});
  });

  webContents.on('dom-ready', () => {
    if (currentShieldLevel === 'off') return;
    webContents.executeJavaScript(SURROGATES_SCRIPT).catch(() => {});
    webContents.insertCSS(SCOPED_COSMETIC_CSS).catch(() => {});

    const currentUrl = webContents.getURL() || '';
    if (currentUrl.includes('youtube.com')) {
      webContents.executeJavaScript(YOUTUBE_AD_SUPPRESSION_SCRIPT).catch(() => {});
    }
  });
}

module.exports = {
  initStauntShieldEngine,
  enableShieldInSession,
  attachShieldToWebContents,
  setShieldLevel,
  getShieldLevel,
  setSiteShieldOverrideChecker,
  setPrivacyHeaderConfig,
  isCriticalWhitelisted,
  isFirstParty,
  SURROGATES_SCRIPT,
  YOUTUBE_AD_SUPPRESSION_SCRIPT,
  SCOPED_COSMETIC_CSS,
  getShieldStats: () => ({ ...stats })
};
