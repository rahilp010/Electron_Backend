import { renderLandingPage } from '../services/landingPage.js';

const html = renderLandingPage();
let failures = 0;
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  failures++;
};

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!scripts.length) {
  fail('no inline script found');
} else {
  scripts.forEach((scriptMatch, index) => {
    try {
      new Function(scriptMatch[1]);
      console.log(`PASS: inline script ${index + 1} parses without syntax errors`);
    } catch (error) {
      fail(`inline script ${index + 1} has a syntax error: ${error.message}`);
    }
  });

  const referencedIds = scripts.flatMap((scriptMatch) =>
    [...scriptMatch[1].matchAll(/getElementById\((['"])(.*?)\1\)/g)]
      .map((match) => match[2])
  );
  const definedIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const missingIds = [...new Set(referencedIds)].filter((id) => !definedIds.has(id));
  if (missingIds.length) {
    fail(`script references missing element ids: ${missingIds.join(', ')}`);
  } else {
    console.log('PASS: all script element references exist');
  }
}

for (const product of ['Envy ERP', 'Envy Mobile', 'Envy Sync']) {
  if (!html.includes(product)) fail(`product "${product}" is missing`);
}
for (const expected of [
  'rahilp704@gmail.com',
  'href="/api/version/admin"',
  "fetch('/api/version')",
  'id="releases"',
  'id="inquiry"',
  'id="inquiry-form"',
  'name="email" type="email" autocomplete="email" required',
  'name="message" required',
  'mailto:rahilp704@gmail.com?subject=',
  "window.matchMedia('(prefers-color-scheme: dark)')",
  "localStorage.getItem('envy-theme') || localStorage.getItem('theme')",
  "localStorage.setItem('envy-theme', theme)",
  'document.startViewTransition',
  'circle(0px at ',
  "window.matchMedia('(prefers-reduced-motion: reduce)')",
  'id="theme-toggle"',
  'aria-pressed="false"',
  '<img src="/updates/services/Envy.png" alt="" width="34" height="34">',
  '<img src="/updates/services/Envy.png" alt="" width="86" height="86">',
  '<!-- <svg viewBox="0 0 24 24"',
  '<!-- <svg viewBox="0 0 64 64"',
]) {
  if (!html.includes(expected)) fail(`expected dashboard content is missing: ${expected}`);
}

if (failures) process.exit(1);
console.log('PASS: products, inquiry contact, and release-management links are present');
