import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, rules, headers] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('firestore.rules', 'utf8'),
  readFile('vercel.json', 'utf8'),
]);

const checks = [
  ['current Gemini model', () => assert.match(html, /models\/gemini-3\.5-flash:generateContent/)],
  ['retired Gemini model absent', () => assert.doesNotMatch(html, /gemini-2\.0-flash/)],
  ['API key sent in header', () => assert.match(html, /'x-goog-api-key': apiKey/)],
  ['API key absent from URL query', () => assert.doesNotMatch(html, /generateContent\?key=/)],
  ['Gemini key uses session storage', () => assert.match(html, /sessionStorage\.setItem\('res-gemini-key'/)],
  ['Gemini key is never persisted', () => assert.doesNotMatch(html, /localStorage\.(?:getItem|setItem)\('res-gemini-key'/)],
  ['AI input bounded', () => assert.match(html, /boundedText\(document\.getElementById\('suggestInput'\)\?\.value, 500\)/)],
  ['AI response bounded', () => assert.match(html, /text\.length > 20000/)],
  ['AI request timeout', () => assert.match(html, /controller\.abort\(\), 10000/)],
  ['raw auth errors not returned', () => assert.doesNotMatch(html, /error\?\.message \|\| fallback/)],
  ['journal output encoded', () => assert.match(html, /escapeHTML\(e\.note\)/)],
  ['favorite output encoded', () => assert.match(html, /escapeHTML\(fav\.name\)/)],
  ['Firestore ownership required', () => assert.match(rules, /request\.auth\.uid == userId/)],
  ['Firestore fields are type and size bounded', () => {
    assert.match(rules, /function optionalString\(field, maxSize\)/);
    assert.match(rules, /optionalString\('journal', 120000\)/);
    assert.match(rules, /profile\.email\.size\(\) <= 254/);
  }],
  ['Firestore default deny', () => assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false/)],
  ['CSP blocks objects', () => assert.match(headers, /object-src 'none'/)],
  ['HSTS configured', () => assert.match(headers, /Strict-Transport-Security/)],
];

const failures = [];
for (const [name, check] of checks) {
  try {
    check();
  } catch (error) {
    failures.push({ name, message: error.message });
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, passed: checks.map(([name]) => name) }, null, 2));
