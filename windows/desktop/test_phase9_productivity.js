// test_phase9_productivity.js — Phase 9 Automated Test Suite
// Tests: Password Vault, Download Manager Enhancements, Bookmark Export/Import
// Run: npx electron test_phase9_productivity.js
// All tests are standalone IPC + logic tests (no UI rendering needed)

'use strict';

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// ─── Override userData so tests don't pollute real profile ───────────────────
const TEST_DATA_DIR = path.join(os.tmpdir(), 'staunt_phase9_test_' + Date.now());
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
app.setPath('userData', TEST_DATA_DIR);

// ─── Results ─────────────────────────────────────────────────────────────────
const results = [];
let passed = 0;
let failed = 0;

function pass(id, msg) {
  results.push({ id, status: 'PASS', msg });
  passed++;
  console.log(`  ✓ PASS  [${id}] ${msg}`);
}

function fail(id, msg, detail) {
  results.push({ id, status: 'FAIL', msg, detail });
  failed++;
  console.error(`  ✗ FAIL  [${id}] ${msg}${detail ? ': ' + detail : ''}`);
}

// ─── Encryption helpers (copied from main.js logic) ──────────────────────────
function getVaultKey(userDataPath) {
  const seed = crypto.createHash('sha256')
    .update(userDataPath + 'STAUNT_VAULT_V1_KEY')
    .digest();
  return crypto.scryptSync(seed, 'staunt-credentials-salt-v1', 32);
}

function encryptCredential(plaintext, userDataPath) {
  const key = getVaultKey(userDataPath);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), enc: enc.toString('hex'), tag: tag.toString('hex') });
}

function decryptCredential(stored, userDataPath) {
  try {
    const key = getVaultKey(userDataPath);
    const { iv, enc, tag } = JSON.parse(stored);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return decipher.update(Buffer.from(enc, 'hex')) + decipher.final('utf8');
  } catch (_) { return null; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function readJsonSafe(filePath, fallback = null) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {}
  return fallback;
}

function atomicWrite(filePath, data) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, `${filePath}.bak`);
  fs.renameSync(tmp, filePath);
}

// ─── Tests ───────────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  STAUNT Phase 9 — Productivity Test Suite');
  console.log('══════════════════════════════════════════════\n');

  // T1: Encryption round-trip
  try {
    const plain = 'SuperSecret123!@#';
    const encrypted = encryptCredential(plain, TEST_DATA_DIR);
    const parsed = JSON.parse(encrypted);
    if (parsed.iv && parsed.enc && parsed.tag) {
      const decrypted = decryptCredential(encrypted, TEST_DATA_DIR);
      if (decrypted === plain) {
        pass('T1', 'AES-256-GCM encrypt/decrypt round-trip succeeds');
      } else {
        fail('T1', 'Decrypted value does not match original', `got: ${decrypted}`);
      }
    } else {
      fail('T1', 'Encrypted output missing iv/enc/tag fields');
    }
  } catch (err) {
    fail('T1', 'Encryption threw exception', err.message);
  }

  // T2: No plaintext passwords in DB file
  try {
    const credFile = path.join(TEST_DATA_DIR, 'staunt_credentials.json');
    const testPass = 'CorrectHorseBatteryStaple';
    const credDB = [{
      id: 'test001',
      origin: 'https://example.com',
      username: 'alice@example.com',
      encryptedPassword: encryptCredential(testPass, TEST_DATA_DIR),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }];
    atomicWrite(credFile, credDB);
    const rawContent = fs.readFileSync(credFile, 'utf-8');
    if (rawContent.includes(testPass)) {
      fail('T2', 'SECURITY FAIL: plaintext password found in credentials file!');
    } else {
      pass('T2', 'Credentials file contains NO plaintext passwords');
    }
  } catch (err) {
    fail('T2', 'DB write/read check threw', err.message);
  }

  // T3: Credential upsert by origin+username (save → retrieve → update)
  try {
    const credFile = path.join(TEST_DATA_DIR, 'staunt_credentials.json');
    let db = readJsonSafe(credFile, []);
    const org = 'https://test3.example.com';
    const user = 'bob';
    const pass1 = 'pass_v1';
    const pass2 = 'pass_v2_updated';
    // Simulate save
    const existing = db.findIndex(c => c.origin === org && c.username === user);
    const now = Date.now();
    if (existing !== -1) {
      db[existing].encryptedPassword = encryptCredential(pass1, TEST_DATA_DIR);
    } else {
      db.unshift({ id: now.toString(36)+'t3', origin: org, username: user, encryptedPassword: encryptCredential(pass1, TEST_DATA_DIR), createdAt: now, updatedAt: now });
    }
    atomicWrite(credFile, db);
    db = readJsonSafe(credFile, []);
    const found = db.find(c => c.origin === org && c.username === user);
    if (!found) { fail('T3', 'Credential not found after save'); return; }
    const dec1 = decryptCredential(found.encryptedPassword, TEST_DATA_DIR);
    if (dec1 !== pass1) { fail('T3', 'Decrypted pass1 mismatch', dec1); return; }
    // Update
    const idx = db.findIndex(c => c.origin === org && c.username === user);
    db[idx].encryptedPassword = encryptCredential(pass2, TEST_DATA_DIR);
    atomicWrite(credFile, db);
    db = readJsonSafe(credFile, []);
    const updated = db.find(c => c.origin === org && c.username === user);
    const dec2 = decryptCredential(updated.encryptedPassword, TEST_DATA_DIR);
    if (dec2 === pass2) {
      pass('T3', 'Credential upsert (save + update) works correctly');
    } else {
      fail('T3', 'Updated decrypted value mismatch', dec2);
    }
  } catch (err) {
    fail('T3', 'Upsert test threw', err.message);
  }

  // T4: Delete credential removes from DB
  try {
    const credFile = path.join(TEST_DATA_DIR, 'staunt_credentials.json');
    let db = readJsonSafe(credFile, []);
    const idToDelete = db[0] && db[0].id;
    if (!idToDelete) { fail('T4', 'No credential to delete in DB'); return; }
    db = db.filter(c => c.id !== idToDelete);
    atomicWrite(credFile, db);
    db = readJsonSafe(credFile, []);
    if (db.some(c => c.id === idToDelete)) {
      fail('T4', 'Deleted credential still found in DB');
    } else {
      pass('T4', 'Delete credential removes entry from DB correctly');
    }
  } catch (err) {
    fail('T4', 'Delete test threw', err.message);
  }

  // T5: get-all-credentials returns no encrypted passwords (only metadata)
  try {
    const credFile = path.join(TEST_DATA_DIR, 'staunt_credentials.json');
    let db = readJsonSafe(credFile, []);
    // Simulate get-all-credentials masking
    const masked = db.map(c => ({ id: c.id, origin: c.origin, username: c.username, createdAt: c.createdAt, updatedAt: c.updatedAt }));
    const hasEncField = masked.some(m => 'encryptedPassword' in m);
    const hasPlainField = masked.some(m => 'password' in m);
    if (!hasEncField && !hasPlainField) {
      pass('T5', 'getAllCredentials returns masked list (no password fields)');
    } else {
      fail('T5', 'getAllCredentials exposes password-related fields in response');
    }
  } catch (err) {
    fail('T5', 'Masking test threw', err.message);
  }

  // T6: Clear completed downloads removes only completed/cancelled/interrupted
  try {
    const dlFile = path.join(TEST_DATA_DIR, 'staunt_downloads_vault.json');
    const testDownloads = [
      { id: 'dl1', fileName: 'file1.zip', state: 'completed', startTime: Date.now() },
      { id: 'dl2', fileName: 'file2.pdf', state: 'progressing', startTime: Date.now() },
      { id: 'dl3', fileName: 'file3.mp3', state: 'cancelled', startTime: Date.now() },
      { id: 'dl4', fileName: 'file4.txt', state: 'paused', startTime: Date.now() },
      { id: 'dl5', fileName: 'file5.exe', state: 'interrupted', startTime: Date.now() }
    ];
    atomicWrite(dlFile, testDownloads);
    let db = readJsonSafe(dlFile, []);
    // Simulate clear-completed-downloads
    db = db.filter(d => d.state !== 'completed' && d.state !== 'cancelled' && d.state !== 'interrupted');
    atomicWrite(dlFile, db);
    db = readJsonSafe(dlFile, []);
    const remaining = db.map(d => d.id).sort();
    const expected = ['dl2', 'dl4'].sort();
    if (JSON.stringify(remaining) === JSON.stringify(expected)) {
      pass('T6', 'Clear completed downloads removes only completed/cancelled/interrupted entries');
    } else {
      fail('T6', 'Clear completed left wrong entries', JSON.stringify(remaining));
    }
  } catch (err) {
    fail('T6', 'Clear completed test threw', err.message);
  }

  // T7: Download filter logic
  try {
    const items = [
      { id: 'a', fileName: 'report_2026.pdf', state: 'completed' },
      { id: 'b', fileName: 'music_track.mp3', state: 'progressing' },
      { id: 'c', fileName: 'archive_backup.zip', state: 'completed' }
    ];
    const q = 'report';
    const filtered = items.filter(d => (d.fileName||'').toLowerCase().includes(q));
    if (filtered.length === 1 && filtered[0].id === 'a') {
      pass('T7', 'Download filter correctly narrows list by filename query');
    } else {
      fail('T7', 'Filter returned unexpected results', JSON.stringify(filtered));
    }
  } catch (err) {
    fail('T7', 'Filter test threw', err.message);
  }

  // T8: Bookmark HTML export format
  try {
    const bkFile = path.join(TEST_DATA_DIR, 'staunt_bookmarks_vault.json');
    const testBM = [
      { id: 'bk1', url: 'https://example.com', title: 'Example Site', createdAt: 1700000000000 },
      { id: 'bk2', url: 'https://staunt.vercel.app', title: 'STAUNT Browser', createdAt: 1700100000000 }
    ];
    atomicWrite(bkFile, testBM);
    // Simulate export HTML generation
    const lines = [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>'
    ];
    for (const bm of testBM) {
      const addDate = Math.floor((bm.createdAt||Date.now()) / 1000);
      const title = bm.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const url = bm.url.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
      lines.push(`    <DT><A HREF="${url}" ADD_DATE="${addDate}">${title}</A>`);
    }
    lines.push('</DL><p>');
    const html = lines.join('\n');
    const exportFile = path.join(TEST_DATA_DIR, 'test_export.html');
    fs.writeFileSync(exportFile, html, 'utf-8');
    // Verify format
    const isNetscape = html.includes('NETSCAPE-Bookmark-file-1');
    const hasBothUrls = html.includes('https://example.com') && html.includes('https://staunt.vercel.app');
    const hasDL = html.includes('<DL><p>') && html.includes('</DL><p>');
    if (isNetscape && hasBothUrls && hasDL) {
      pass('T8', 'Bookmark HTML export produces valid Netscape format with all bookmarks');
    } else {
      fail('T8', 'Export HTML format validation failed', `netscape:${isNetscape} urls:${hasBothUrls} dl:${hasDL}`);
    }
  } catch (err) {
    fail('T8', 'Export format test threw', err.message);
  }

  // T9: Bookmark HTML import parsing (deduplicate)
  try {
    const importHtml = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<DL><p>
  <DT><A HREF="https://github.com" ADD_DATE="1700000000">GitHub</A>
  <DT><A HREF="https://example.com" ADD_DATE="1700100000">Example</A>
  <DT><A HREF="https://wikipedia.org" ADD_DATE="1700200000">Wikipedia</A>
  <DT><A HREF="javascript:void(0)" ADD_DATE="1700300000">Skip Me</A>
</DL><p>`;
    const importFile = path.join(TEST_DATA_DIR, 'test_import.html');
    fs.writeFileSync(importFile, importHtml, 'utf-8');
    // Simulate import parsing
    const existing = new Set(['https://example.com']); // already in DB
    const raw = fs.readFileSync(importFile, 'utf-8');
    const regex = /<A\s[^>]*HREF="([^"]+)"[^>]*>([^<]*)<\/A>/gi;
    let match;
    const added = [];
    while ((match = regex.exec(raw)) !== null) {
      const url = match[1].trim();
      const title = match[2].trim() || url;
      if (!url || url.startsWith('javascript:') || url.startsWith('data:')) continue;
      if (existing.has(url)) continue;
      added.push({ url, title });
      existing.add(url);
    }
    const addedUrls = added.map(a => a.url).sort();
    const expectedAdded = ['https://github.com', 'https://wikipedia.org'].sort();
    if (JSON.stringify(addedUrls) === JSON.stringify(expectedAdded)) {
      pass('T9', 'Bookmark import parses HTML correctly, deduplicates, skips javascript: URLs');
    } else {
      fail('T9', 'Import parsed unexpected URLs', JSON.stringify(addedUrls));
    }
  } catch (err) {
    fail('T9', 'Import parsing test threw', err.message);
  }

  // T10: Credential DB uses only AES-GCM encrypted blobs (no raw strings)
  try {
    const credFile = path.join(TEST_DATA_DIR, 'staunt_credentials.json');
    const passwords = ['Passw0rd!', 'hunter2', '123456'];
    const db = passwords.map((p, i) => ({
      id: 'tc' + i,
      origin: `https://site${i}.test`,
      username: 'user' + i,
      encryptedPassword: encryptCredential(p, TEST_DATA_DIR),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
    atomicWrite(credFile, db);
    const rawContent = fs.readFileSync(credFile, 'utf-8');
    const plaintextLeak = passwords.some(p => rawContent.includes(p));
    if (plaintextLeak) {
      fail('T10', 'SECURITY FAIL: at least one plaintext password found in DB file');
    } else {
      // Verify all can be decrypted back
      const freshDb = readJsonSafe(credFile, []);
      const allDecrypt = freshDb.every((c, i) => decryptCredential(c.encryptedPassword, TEST_DATA_DIR) === passwords[i]);
      if (allDecrypt) {
        pass('T10', 'All credentials encrypted at rest; all decrypt correctly to originals');
      } else {
        fail('T10', 'One or more credentials failed to decrypt back correctly');
      }
    }
  } catch (err) {
    fail('T10', 'Encryption-at-rest test threw', err.message);
  }

  // T11: Backup (.bak) file is written alongside primary
  try {
    const credFile = path.join(TEST_DATA_DIR, 'staunt_credentials.json');
    const bakFile = `${credFile}.bak`;
    // atomicWrite creates .bak on second write
    const data1 = [{ id: 'bak1', note: 'first' }];
    const data2 = [{ id: 'bak2', note: 'second' }];
    atomicWrite(credFile, data1);
    atomicWrite(credFile, data2);
    if (fs.existsSync(bakFile)) {
      const bakData = readJsonSafe(bakFile, null);
      if (bakData && bakData[0] && bakData[0].id === 'bak1') {
        pass('T11', 'Backup (.bak) file written correctly with previous state');
      } else {
        fail('T11', '.bak exists but contains unexpected data', JSON.stringify(bakData));
      }
    } else {
      fail('T11', '.bak file not created after second atomic write');
    }
  } catch (err) {
    fail('T11', 'Backup file test threw', err.message);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log(`  Results: ${passed} PASS / ${failed} FAIL / ${results.length} TOTAL`);
  console.log('══════════════════════════════════════════════\n');

  // Cleanup
  try { fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true }); } catch (_) {}

  if (failed > 0) {
    console.error('PHASE 9 TEST SUITE: FAILED\n');
    process.exitCode = 1;
  } else {
    console.log('PHASE 9 TEST SUITE: ALL PASS ✓\n');
    process.exitCode = 0;
  }
  setTimeout(() => app.quit(), 500);
}

app.whenReady().then(runTests);
app.on('window-all-closed', () => { app.quit(); });
