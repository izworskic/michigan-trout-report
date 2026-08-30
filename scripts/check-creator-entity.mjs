import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const person = 'https://chrisizworski.com/#person';
const profile = 'https://chrisizworski.com/chris-izworski/';
const localPerson = 'https://michigantroutreport.com/chris-izworski/#person';

const home = readFileSync('public/index.html', 'utf8');
const author = readFileSync('public/chris-izworski/index.html', 'utf8');

assert.ok(home.includes(`<link rel="author" href="${profile}">`), 'homepage must expose the canonical Chris Izworski profile');
assert.ok(home.includes(`"@id": "${person}"`), 'homepage creator must use the canonical Person @id');
assert.ok(home.includes(`"url": "${profile}"`), 'homepage creator must resolve to the canonical profile');

assert.ok(author.includes(`"@id": "${person}"`), 'author page must describe the canonical Person entity');
assert.ok(author.includes(`"mainEntity": { "@id": "${person}" }`), 'ProfilePage must point at the canonical Person entity');
assert.ok(!author.includes(localPerson), 'author page must not mint a second local Person identity');

console.log('Creator entity checks passed.');
