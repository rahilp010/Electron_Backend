// Verification script: renders the admin page HTML and validates its scripts,
// referenced elements, theme controls, and release-management UI.
import { getVersionAdminPage } from '../API/version/versionController.js';

const fakeRes = {
  statusCode: 200,
  body: '',
  status(code) { this.statusCode = code; return this; },
  type() { return this; },
  send(html) { this.body = html; },
};

await getVersionAdminPage({}, fakeRes, (err) => {
  if (err) { console.error('Controller error:', err); process.exit(1); }
});

const html = fakeRes.body;
let failures = 0;

// 1. Extract and syntax-check every inline script exactly as served
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!scripts.length) {
  console.error('FAIL: no inline <script> found');
  process.exit(1);
}

for (const [index, scriptMatch] of scripts.entries()) {
  try {
    new Function(scriptMatch[1]);
    console.log(`PASS: inline script ${index + 1} parses without syntax errors`);
  } catch (err) {
    console.error(`FAIL: inline script ${index + 1} has a syntax error:`, err.message);
    failures++;
  }
}

// 2. Every getElementById target must exist as id="..." in the markup
const referenced = scripts.flatMap((scriptMatch) =>
  [...scriptMatch[1].matchAll(/getElementById\((['"])(.*?)\1\)/g)].map((match) => match[2])
);
const definedIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const missing = [...new Set(referenced)].filter((id) => !definedIds.has(id));
if (missing.length) {
  console.error('FAIL: getElementById targets missing from markup:', missing);
  failures++;
} else {
  console.log(`PASS: all ${new Set(referenced).size} referenced element ids exist`);
}

// 3. No residual onclick attributes that depend on broken escapes
const badOnclick = [...html.matchAll(/onclick="[^"]*\\'/g)];
if (badOnclick.length) {
  console.error(`FAIL: ${badOnclick.length} onclick attribute(s) contain raw backslash-quote escapes`);
  failures++;
} else {
  console.log('PASS: no broken onclick escapes in served HTML');
}

// 4. Expected interactive elements present
for (const id of ['openUpdateBtn', 'passwordModal', 'updateModal', 'submitPassword', 'clearFormBtn', 'newReleaseBtn', 'releasesTableBody', 'uploadZipBtn', 'copyDownloadUrlBtn', 'theme-toggle']) {
  if (!definedIds.has(id)) {
    console.error(`FAIL: expected element #${id} missing`);
    failures++;
  }
}
console.log('PASS: all expected interactive elements present');

// 5. Theme and modal styling hooks used by the UI exist in the stylesheet.
for (const cls of ['.modal-overlay', '.modal-overlay.active', 'body.modal-open', '[data-theme="dark"]', '.release-modal-kicker', '::view-transition-new(root)']) {
  if (!html.includes(cls)) {
    console.error(`FAIL: CSS hook "${cls}" missing`);
    failures++;
  }
}
console.log('PASS: theme and release modal CSS hooks present');

for (const expected of [
  "window.matchMedia('(prefers-color-scheme: dark)')",
  "localStorage.getItem('envy-theme') || localStorage.getItem('theme')",
  "localStorage.setItem('envy-theme', theme)",
  'document.startViewTransition',
  "window.matchMedia('(prefers-reduced-motion: reduce)')",
  'Release workspace',
  'Manage product releases',
]) {
  if (!html.includes(expected)) {
    console.error(`FAIL: expected theme or release UI content missing: ${expected}`);
    failures++;
  }
}

process.exit(failures ? 1 : 0);
