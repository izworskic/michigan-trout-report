import assert from 'node:assert/strict';
import test from 'node:test';
import { syncMetadata } from './social-metadata.mjs';

const page = `<html><head><title>A &amp; B</title><meta name="description" content="Fish &quot;cool&quot; water &amp; compare."><link rel="canonical" href="https://example.com/guide/"></head><body>Original body</body></html>`;
test('fallbacks preserve escaped editorial values, canonical and body, then remain idempotent', () => {
  const result = syncMetadata(page);
  assert.ok(result.includes('property="og:title" content="A &amp; B"'));
  assert.ok(result.includes('name="twitter:description" content="Fish &quot;cool&quot; water &amp; compare."'));
  assert.ok(result.includes('property="og:url" content="https://example.com/guide/"'));
  assert.ok(result.includes('<body>Original body</body>'));
  assert.equal(syncMetadata(result), result);
  assert.ok(!result.includes('og:image'), 'no invented image');
});
test('explicit article type, social titles and card image retain their editorial ownership', () => {
  const result = syncMetadata(page.replace('</head>', '<meta property="og:type" content="article"><meta property="og:title" content="Specific social title"><meta property="og:image" content="https://example.com/real.png"></head>'));
  assert.ok(result.includes('property="og:type" content="article"'));
  assert.ok(result.includes('name="twitter:title" content="Specific social title"'));
  assert.ok(result.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(result.includes('name="twitter:image" content="https://example.com/real.png"'));
});
test('missing canonical, divergent social URLs, blank or duplicate social tags fail', () => {
  assert.throws(() => syncMetadata(page.replace(/<link[^>]+>/, '')), /canonical/);
  assert.throws(() => syncMetadata(page.replace('</head>', '<meta property="og:url" content="https://example.com/other/"></head>')), /canonical/);
  assert.throws(() => syncMetadata(page.replace('</head>', '<meta name="twitter:title" content=""></head>')), /empty/);
  assert.throws(() => syncMetadata(page.replace('</head>', '<meta property="og:type" content="article"><meta property="og:type" content="website"></head>')), /Duplicate/);
});
test('intentional noindex document is unchanged', () => {
  const html = page.replace(/<link[^>]+>/, '').replace('</head>', '<meta name="robots" content="noindex, follow"></head>');
  assert.equal(syncMetadata(html), html);
});
