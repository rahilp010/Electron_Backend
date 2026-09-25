// Verification script: renders the admin page HTML from renderAdminPage()
// and validates that (1) the inline <script> has no syntax errors and
// (2) every element referenced via getElementById exists in the markup.
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

// 1. Extract the inline script exactly as served
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('FAIL: no inline <script> found');
  process.exit(1);
}
const script = scriptMatch[1];

// 2. Syntax check (parse only, no execution)
try {
  new Function(script);
  console.log('PASS: inline script parses without syntax errors');
} catch (err) {
  console.error('FAIL: inline script has a syntax error:', err.message);
  failures++;
}

// 3. Every getElementById target must exist as id="..." in the markup
const referenced = [...script.matchAll(/getElementById\((['"])(.*?)\1\)/g)].map((m) => m[2]);
const definedIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const missing = [...new Set(referenced)].filter((id) => !definedIds.has(id));
if (missing.length) {
  console.error('FAIL: getElementById targets missing from markup:', missing);
  failures++;
} else {
  console.log(`PASS: all ${new Set(referenced).size} referenced element ids exist`);
}

// 4. No residual onclick attributes that depend on broken escapes
const badOnclick = [...html.matchAll(/onclick="[^"]*\\'/g)];
if (badOnclick.length) {
  console.error(`FAIL: ${badOnclick.length} onclick attribute(s) contain raw backslash-quote escapes`);
  failures++;
} else {
  console.log('PASS: no broken onclick escapes in served HTML');
}

// 5. Expected interactive elements present
for (const id of ['openUpdateBtn', 'passwordModal', 'updateModal', 'submitPassword', 'clearFormBtn', 'newReleaseBtn', 'releasesTableBody', 'uploadZipBtn', 'copyDownloadUrlBtn']) {
  if (!definedIds.has(id)) {
    console.error(`FAIL: expected element #${id} missing`);
    failures++;
  }
}
console.log('PASS: all expected interactive elements present');

// 6. Modal open/close CSS classes referenced by JS exist in stylesheet
for (const cls of ['.modal-overlay', '.modal-overlay.active', 'body.modal-open']) {
  if (!html.includes(cls)) {
    console.error(`FAIL: CSS hook "${cls}" missing`);
    failures++;
  }
}
console.log('PASS: modal CSS hooks present');

process.exit(failures ? 1 : 0);
