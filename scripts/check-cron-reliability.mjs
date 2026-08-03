import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isRealTodayPost, michiganDateKey } from '../api/cron.js';

const beforeDst = new Date('2026-03-08T04:30:00Z');
const afterMidnight = new Date('2026-03-08T05:30:00Z');
assert.equal(michiganDateKey(beforeDst), '2026-03-07');
assert.equal(michiganDateKey(afterMidnight), '2026-03-08');

const words = Array.from({ length: 260 }, (_, index) => `word${index}`).join(' ');
assert.equal(isRealTodayPost({ status: 'publish', date: '2026-08-03T05:10:00-04:00', content: `<p>${words}</p>` }, '2026-08-03'), true);
assert.equal(isRealTodayPost({ status: 'publish', date: '2026-08-03T05:10:00-04:00', content: '<p>stub</p>' }, '2026-08-03'), false);
assert.equal(isRealTodayPost({ status: 'draft', date: '2026-08-03T05:10:00-04:00', content: `<p>${words}</p>` }, '2026-08-03'), false);

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.equal(vercel.crons.find(item => item.path === '/api/cron')?.schedule, '0 9 * * *');

const cron = readFileSync(new URL('../api/cron.js', import.meta.url), 'utf8');
assert.match(cron, /WordPress dedupe lookup/);
assert.match(cron, /if \(!wpRes\.ok \|\| !wp\?\.URL\)/);
assert.match(cron, /streamPost\?\.status === 'failed'/);
assert.match(cron, /status: 'published'/);

console.log('Cron reliability checks passed.');
