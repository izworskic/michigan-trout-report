import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const canonicalHost = 'https://michigantroutreport.com';
const pages = ['public/alerts.html', 'public/directory.html', 'public/river.html'];

for (const path of pages) {
  const html = readFileSync(path, 'utf8');
  assert.ok(html.includes(`<link rel="canonical"`), `${path} needs a canonical link`);
  assert.ok(html.includes(canonicalHost), `${path} must use the canonical domain`);
  assert.ok(!html.includes('michigan-trout-report.vercel.app'), `${path} exposes the Vercel hostname`);
}

for (const path of ['public/alerts.html', 'public/directory.html']) {
  const html = readFileSync(path, 'utf8');
  for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
    assert.ok(html.includes(`property="${property}"`), `${path} is missing ${property}`);
  }
}

const sitemap = readFileSync('public/sitemap.xml', 'utf8');
for (const path of ['/alerts.html', '/directory.html']) {
  assert.ok(sitemap.includes(`${canonicalHost}${path}`), `sitemap is missing ${path}`);
}

console.log('SEO checks passed.');
