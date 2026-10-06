import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const person = 'https://chrisizworski.com/#person';
const personUrl = 'https://chrisizworski.com/';
const profile = 'https://chrisizworski.com/chris-izworski/';
const localPerson = 'https://michigantroutreport.com/chris-izworski/#person';

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(file);
    return entry.isFile() && entry.name.endsWith('.html') ? [file] : [];
  });
}
function jsonLd(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}
function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
  else Object.values(value).forEach((item) => walk(item, visit));
}

const files = htmlFiles('public');
let contentDocumentCount = 0;
let contentSchemaCount = 0;
const publishingTypes = ['Article', 'WebPage', 'WebApplication', 'Dataset', 'WebSite', 'ProfilePage', 'TouristTrip'];
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const nodes = [];
  for (const block of jsonLd(html)) {
    walk(block, (node) => {
      nodes.push(node);
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      if (!types.includes('Person') || node.name !== 'Chris Izworski') return;
      assert.equal(node['@id'], person, `${file}: Chris must use the canonical Person @id`);
      assert.equal(node.url, personUrl, `${file}: canonical Person url must be the homepage`);
    });
  }
  const personDefinition = nodes.find((node) => {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    return types.includes('Person') && node.name === 'Chris Izworski'
      && node['@id'] === person && node.url === personUrl;
  });
  const contentNodes = nodes.filter((node) => {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    return publishingTypes.some((type) => types.includes(type));
  });
  if (contentNodes.length > 0) {
    contentDocumentCount += 1;
    contentSchemaCount += contentNodes.length;
    assert.ok(personDefinition, `${file}: content document must include the full canonical Chris Person definition`);
  }
  for (const node of contentNodes) {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const creator = node.author || node.creator;
    assert.equal(creator?.['@id'], person, `${file}: primary content publisher must identify canonical Chris as author or creator`);
    assert.ok(node.publisher, `${file}: primary content publisher node must declare an actual publisher`);
    if (!types.includes('Article')) {
      assert.equal(node.publisher['@id'], person, `${file}: owned page, site, dataset, or profile publisher must reference the canonical Person`);
    }
  }
  assert.ok(
    !/<a\b[^>]*href=["']https:\/\/chrisizworski\.com\/?["'][^>]*>Chris Izworski<\/a>/i.test(html),
    `${file}: visible Chris attribution links must resolve to the profile`,
  );
}

const home = readFileSync('public/index.html', 'utf8');
const author = readFileSync('public/chris-izworski/index.html', 'utf8');
const map = readFileSync('public/map.html', 'utf8');
const salmon = readFileSync('public/salmon-run/index.html', 'utf8');
assert.ok(home.includes(`<link rel="author" href="${profile}">`), 'homepage must expose the canonical Chris Izworski profile');
assert.ok(home.includes(`href="${profile}" target="_blank" rel="noopener">Chris Izworski</a>`), 'homepage must show a visible profile-linked creator credit');
assert.ok(author.includes(`"@id": "${person}"`), 'author page must describe the canonical Person entity');
assert.ok(author.includes(`"mainEntity": { "@id": "${person}" }`), 'ProfilePage must point at the canonical Person entity');
assert.ok(!author.includes(localPerson), 'author page must not mint a second local Person identity');
assert.ok(map.includes('<h1 class="hdr-title"'), 'map must start with a readable h1');
assert.ok(map.includes(`href="${profile}">Built by Chris Izworski</a>`), 'map must show a visible profile-linked creator credit');
assert.ok(salmon.includes(`href="${profile}" target="_blank" rel="noopener">Chris Izworski</a>`), 'salmon page must show a visible profile-linked creator credit');

const salmonGraph = jsonLd(salmon).find((block) => Array.isArray(block['@graph']))['@graph'];
const salmonPage = salmonGraph.find((node) => node['@type'] === 'WebPage');
assert.equal(salmonPage.author['@id'], person, 'salmon WebPage author must reference the canonical Person');
assert.equal(salmonPage.publisher['@id'], person, 'salmon WebPage publisher must reference the canonical Person');
assert.ok(salmonGraph.some((node) => node['@id'] === person && node.url === personUrl), 'salmon graph must define the canonical Person');

assert.equal(contentDocumentCount, 99, 'all 99 current Trout Report content documents must have a checked primary publishing node');
assert.equal(contentSchemaCount, 124, 'all primary publishing nodes across current Trout Report content documents must be checked');
console.log(`Creator entity checks passed: ${contentSchemaCount} primary publishing nodes across ${contentDocumentCount} content documents (${files.length} HTML pages).`);
