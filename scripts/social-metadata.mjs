// Fill missing social metadata from the page's existing editorial values.
// Never replace an explicit value, title, canonical, schema type, or image.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)]
    .map((match) => [match[1].toLowerCase(), match[3]]));
}
function decode(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (_, entity) => {
    if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x'
      ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10));
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[entity.toLowerCase()];
  });
}
function encode(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function metadata(html) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert.ok(head, 'HTML document must have a head');
  const values = new Map();
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (values.has(key) && (key.startsWith('og:') || key.startsWith('twitter:'))) {
      throw new Error(`Duplicate social metadata: ${key}`);
    }
    values.set(key, decode(attrs.content || '').trim());
  }
  if (/\bnoindex\b/i.test(values.get('robots') || '')) return { values };
  const canonicalTags = (head.match(/<link\b[^>]*>/gi) || [])
    .map(attributes).filter(attrs => attrs.rel?.toLowerCase() === 'canonical');
  assert.equal(canonicalTags.length, 1, 'Page must have exactly one canonical');
  const canonical = decode(canonicalTags[0].href || '');
  assert.ok(/^https:\/\//.test(canonical), 'Canonical must be an absolute HTTPS URL');
  const title = decode(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const description = values.get('description');
  assert.ok(title && description, 'Page needs its own title and description before social metadata');
  return { values, canonical, title, description };
}

export function syncMetadata(html) {
  const { values, canonical, title, description } = metadata(html);
  if (/\bnoindex\b/i.test(values.get('robots') || '')) return html;
  const additions = [];
  const add = (key, value) => {
    if (values.has(key)) {
      assert.ok(values.get(key), `${key} must not be empty`);
      return;
    }
    const attribute = key.startsWith('og:') ? 'property' : 'name';
    additions.push(`<meta ${attribute}="${key}" content="${encode(value)}">`);
    values.set(key, value);
  };
  add('og:title', title);
  add('og:description', description);
  add('og:url', canonical);
  add('og:type', 'website');
  assert.equal(values.get('og:url'), canonical, 'Social URL must equal the declared canonical');
  add('twitter:card', values.get('og:image') ? 'summary_large_image' : 'summary');
  add('twitter:title', values.get('og:title'));
  add('twitter:description', values.get('og:description'));
  if (values.get('og:image')) add('twitter:image', values.get('og:image'));
  return additions.length ? html.replace(/<\/head>/i, `${additions.join('\n')}\n</head>`) : html;
}

function htmlFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ['node_modules', 'scripts', 'tests'].includes(entry.name)) return [];
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith('.html') ? [file] : [];
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const rootIndex = process.argv.indexOf('--root');
  const root = rootIndex < 0 ? 'public' : process.argv[rootIndex + 1];
  assert.ok(root, '--root needs a directory');
  const check = process.argv.includes('--check');
  const files = htmlFiles(root);
  const missing = [];
  for (const file of files) {
    try {
      const original = readFileSync(file, 'utf8');
      const updated = syncMetadata(original);
      if (original === updated) continue;
      if (check) missing.push(file);
      else writeFileSync(file, updated);
    } catch (error) {
      throw new Error(`${file}: ${error.message}`, { cause: error });
    }
  }
  assert.equal(missing.length, 0, `Missing social metadata in ${missing.join(', ')}. Run the metadata sync command and commit the output.`);
  console.log(`Social metadata ${check ? 'checks' : 'sync'} passed for ${files.length} HTML documents.`);
}
