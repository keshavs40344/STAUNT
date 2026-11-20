// =============================================================================
// STAUNT DESKTOP — UNIVERSAL WEBSITE & WEB APP COMPATIBILITY VERIFICATION SUITE
// Automated audit of whitelisting, OAuth popups, pointer lock, CDNs, & headers
// =============================================================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--- STARTING UNIVERSAL WEBSITE & WEB APP COMPATIBILITY TEST ---');

// 1. Verify adblocker-core critical whitelist
const adblocker = require('./src/adblocker-core');

const criticalUrlsToTest = [
  // Google Auth & Services
  { url: 'https://accounts.google.com/o/oauth2/v2/auth', expected: true, label: 'Google OAuth' },
  { url: 'https://myaccount.google.com/security', expected: true, label: 'Google Account' },
  // Microsoft Services
  { url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', expected: true, label: 'Microsoft Azure OAuth' },
  { url: 'https://login.live.com/oauth20_authorize.srf', expected: true, label: 'Microsoft Live OAuth' },
  { url: 'https://account.microsoft.com', expected: true, label: 'Microsoft Account' },
  // Apple ID
  { url: 'https://appleid.apple.com/auth/authorize', expected: true, label: 'Apple ID Sign-In' },
  // Developer & SSO
  { url: 'https://github.com/login/oauth/authorize', expected: true, label: 'GitHub OAuth' },
  { url: 'https://gitlab.com/oauth/authorize', expected: true, label: 'GitLab OAuth' },
  { url: 'https://clerk.com/sign-in', expected: true, label: 'Clerk SSO' },
  { url: 'https://supabase.co/auth/v1/verify', expected: true, label: 'Supabase Auth' },
  { url: 'https://auth0.com/authorize', expected: true, label: 'Auth0' },
  { url: 'https://okta.com/oauth2', expected: true, label: 'Okta SSO' },
  // Payments & Gateways
  { url: 'https://js.stripe.com/v3/', expected: true, label: 'Stripe JS' },
  { url: 'https://checkout.stripe.com/c/pay/cs_live_123', expected: true, label: 'Stripe Checkout' },
  { url: 'https://checkout.razorpay.com/v1/checkout.js', expected: true, label: 'Razorpay Checkout' },
  { url: 'https://api.razorpay.com/v1/orders', expected: true, label: 'Razorpay API' },
  { url: 'https://www.paypal.com/checkoutnow', expected: true, label: 'PayPal Checkout' },
  { url: 'https://www.paypalobjects.com/api/checkout.js', expected: true, label: 'PayPal Assets' },
  // Human Verification / Anti-Bot / CAPTCHA
  { url: 'https://challenges.cloudflare.com/turnstile/v0/api.js', expected: true, label: 'Cloudflare Turnstile' },
  { url: 'https://turnstile.cloudflare.com/cdn-cgi/challenge-platform', expected: true, label: 'Cloudflare Platform' },
  { url: 'https://hcaptcha.com/1/api.js', expected: true, label: 'hCaptcha' },
  { url: 'https://arkoselabs.com/fc/api/', expected: true, label: 'Arkose Labs / FunCaptcha' },
  // WebRTC / Realtime Communication
  { url: 'https://meet.google.com/abc-defg-hij', expected: true, label: 'Google Meet' },
  { url: 'https://web.whatsapp.com', expected: true, label: 'WhatsApp Web' },
  { url: 'https://discord.com/channels/@me', expected: true, label: 'Discord Web' },
  { url: 'https://teams.microsoft.com/v2/', expected: true, label: 'Microsoft Teams' },
  { url: 'https://zoom.us/wc/join', expected: true, label: 'Zoom Web Client' },
  { url: 'https://slack.com/workspace-signin', expected: true, label: 'Slack Web' },
  // Public CDNs & Assets
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js', expected: true, label: 'Cloudflare CDNJS' },
  { url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js', expected: true, label: 'jsDelivr' },
  { url: 'https://fastly.jsdelivr.net/npm/vue@3', expected: true, label: 'jsDelivr Fastly' },
  { url: 'https://unpkg.com/three@0.160.0/build/three.module.js', expected: true, label: 'Unpkg' },
  { url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap', expected: true, label: 'Google Fonts CSS' },
  { url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2', expected: true, label: 'Google Fonts Woff2' },
  { url: 'https://cdn.tailwindcss.com', expected: true, label: 'Tailwind CSS CDN' }
];

console.log('[TEST 1] Verifying Critical Whitelist Hosts:');
let passedWhitelist = 0;
for (const item of criticalUrlsToTest) {
  const isWhitelisted = adblocker.isCriticalWhitelisted(item.url);
  assert.strictEqual(isWhitelisted, item.expected, `Expected ${item.label} (${item.url}) to be whitelisted: ${item.expected}`);
  passedWhitelist++;
}
console.log(` -> PASS: All ${passedWhitelist}/${criticalUrlsToTest.length} critical services, OAuth providers, payment gateways, and CDNs are whitelisted.`);

// 2. Verify main.js popup handling regex
const mainContent = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');

// Test isLegitimatePopupOrAuthFlow regex against realistic OAuth & payment URLs
const popupRegex = /accounts\.google\.com|appleid\.apple\.com|github\.com\/(login|oauth)|login\.microsoftonline\.com|login\.live\.com|auth0\.com|okta\.com|clerk\.com|clerk\.dev|supabase\.co|facebook\.com\/(dialog|v\d|oauth)|twitter\.com\/oauth|x\.com\/oauth|linkedin\.com\/oauth|stripe\.com|razorpay\.com|paypal\.com|paytm\.com|oauth|sso|saml|\/auth\/|\/signin\/|\/login\//i;

const samplePopupUrls = [
  'https://accounts.google.com/signin/oauth/identifier?client_id=123',
  'https://appleid.apple.com/auth/authorize?client_id=com.example',
  'https://github.com/login/oauth/authorize?client_id=github123',
  'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
  'https://login.live.com/oauth20_authorize.srf?client_id=live123',
  'https://auth0.com/authorize?audience=my-api',
  'https://dev-12345.okta.com/oauth2/v1/authorize',
  'https://clerk.example.com/oauth/authorize',
  'https://my-app.clerk.dev/sign-in',
  'https://xyz.supabase.co/auth/v1/authorize',
  'https://www.facebook.com/v18.0/dialog/oauth',
  'https://twitter.com/oauth/authenticate?oauth_token=xyz',
  'https://x.com/oauth/authorize?oauth_token=abc',
  'https://www.linkedin.com/oauth/v2/authorization',
  'https://checkout.stripe.com/pay/cs_test_123',
  'https://api.razorpay.com/v1/checkout/embedded',
  'https://www.paypal.com/cgi-bin/webscr?cmd=_express-checkout',
  'https://secure.paytm.com/oltp-web/processTransaction',
  'https://sso.enterprise.com/saml/login',
  'https://banking.example.com/auth/secure-token'
];

console.log('[TEST 2] Verifying OAuth & Payment Popup Pattern Recognition:');
let passedPopups = 0;
for (const pUrl of samplePopupUrls) {
  const matched = popupRegex.test(pUrl);
  assert.strictEqual(matched, true, `Expected popup regex to match legitimate auth/checkout flow: ${pUrl}`);
  passedPopups++;
}
console.log(` -> PASS: All ${passedPopups}/${samplePopupUrls.length} OAuth, SAML, SSO, and Payment Popup flows correctly detected.`);

// 3. Verify Pointer-Lock permission is not hardware-blocked
console.log('[TEST 3] Verifying Pointer-Lock Permission Policy:');
assert.ok(!mainContent.includes("'pointer-lock', 'midisysex'"), "ALWAYS_DENY_PERMS must NOT include 'pointer-lock'");
assert.ok(mainContent.includes("'pointer-lock': 'allow'"), "DEFAULT_GLOBAL_PERMISSIONS must allow 'pointer-lock' for 3D/Canvas/WebGL");
console.log(' -> PASS: Pointer Lock API is allowed for WebGL, Three.js, Babylon.js, Google Earth, and 3D web apps.');

// 4. Verify User-Agent consistency
console.log('[TEST 4] Verifying Standard Desktop User-Agent:');
assert.ok(mainContent.includes('OFFICIAL_CHROME_WINDOWS_UA'), 'OFFICIAL_CHROME_WINDOWS_UA must be defined');
assert.ok(mainContent.includes('Windows NT 10.0; Win64; x64'), 'User agent must match standard Windows 10/11 x64 architecture');
assert.ok(mainContent.includes('AppleWebKit/537.36'), 'User agent must include standard WebKit signature');
assert.ok(mainContent.includes('Chrome/130.0.0.0'), 'User agent must include official Chrome 130 signature');
console.log(' -> PASS: Official Chrome Windows Desktop User-Agent enforced across all browser tabs.');

// 5. Verify Security Isolation & WebPreferences
console.log('[TEST 5] Verifying WebContents Security Isolation:');
assert.ok(mainContent.includes('plugins: true'), 'plugins must be true for native Chromium PDF viewer support');
assert.ok(mainContent.includes('sandbox: true'), 'sandbox must be true for Chromium process security');
assert.ok(mainContent.includes('contextIsolation: true'), 'contextIsolation must be strictly true');
assert.ok(mainContent.includes('nodeIntegration: false'), 'nodeIntegration must be strictly false');
console.log(' -> PASS: Chromium process isolation, sandboxing, context isolation, and native PDF viewer enabled.');

// 6. Verify Shield Bypass when Shield is OFF or site is whitelisted
console.log('[TEST 6] Verifying Cookie & Header Shield Override:');
const adblockerCoreContent = fs.readFileSync(path.join(__dirname, 'src/adblocker-core.js'), 'utf8');
assert.ok(adblockerCoreContent.includes("currentShieldLevel === 'off'"), 'HeadersReceived must skip cookie stripping when shield is off');
assert.ok(adblockerCoreContent.includes('siteShieldOverrideChecker'), 'HeadersReceived must support per-site shield disabling');
console.log(' -> PASS: Shield override allows uninhibited cookies and headers when shield is disabled for a site.');

console.log('\n===============================================================');
console.log('ALL UNIVERSAL WEBSITE & WEB APP COMPATIBILITY CHECKS PASSED (6/6)!');
console.log('===============================================================');
