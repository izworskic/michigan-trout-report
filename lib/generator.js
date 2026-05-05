// Michigan Trout Report: AI Brief Generator
// Model: claude-haiku-4-5-20251001
// Produces a short daily lead + one-line conditions note per river

import Anthropic from '@anthropic-ai/sdk';
import { RATINGS } from './rater.js';

const SYSTEM_PROMPT = `You are the editor of the Michigan Trout Report, a daily stream conditions brief for Michigan trout anglers. Your voice is from Bay City, Michigan: direct, practical, written by someone who fishes the AuSable and knows these rivers.

RULES:
1. Write for trout anglers who want to know if it's worth making the drive. No fluff.
2. Use fishing lingo: "running at 106% of median," "mending upstream," "high and off-color," "getting color back," "low and clear," "fish are holding tight," "swing through the riffle," etc.
3. Lead paragraph: 3-4 sentences on overall Michigan conditions today. Season context matters (March = pre-opener, April = opener, June = peak).
4. Per-river note: 1-2 tight sentences. Reference the actual numbers. Mention the rating.
5. Never invent conditions not in the data.
6. If temp data is missing, say so briefly. Don't pad.
7. Keep it under 500 words total.

OUTPUT FORMAT: strict JSON, no markdown:
{
  "lead": "3-4 sentence overall conditions paragraph",
  "rivers": {
    "ausable": "1-2 sentence note",
    "manistee": "1-2 sentence note",
    "pere-marquette": "1-2 sentence note",
    "muskegon": "1-2 sentence note",
    "boardman": "1-2 sentence note",
    "jordan": "1-2 sentence note",
    "pigeon": "1-2 sentence note",
    "rifle": "1-2 sentence note",
    "little-manistee": "1-2 sentence note"
  }
}`;

export async function generateBrief(riverData) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const client = new Anthropic({ apiKey });

  // Build context for the AI
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const month = new Date().getMonth() + 1;
  let seasonNote = '';
  if (month <= 3)       seasonNote = 'Pre-season. General trout season opens last Saturday of April.';
  else if (month === 4) seasonNote = 'Opening month. General trout season just opened or opening soon.';
  else if (month <= 6)  seasonNote = 'Peak spring season. Best hatches of the year.';
  else if (month <= 8)  seasonNote = 'Summer. Thermal stress possible on warm days.';
  else if (month <= 10) seasonNote = 'Fall season. Brown trout spawning in October.';
  else                  seasonNote = 'Late season. Steelhead in lower rivers.';

  const lines = [`Today: ${today}`, `Season note: ${seasonNote}`, '', 'RIVER CONDITIONS:'];

  for (const r of riverData) {
    const c = r.conditions;
    const rating = RATINGS[c.ratingKey]?.label || c.ratingKey;
    lines.push(`\n${r.name.toUpperCase()} (${r.id}):`);
    lines.push(`  Rating: ${rating}`);
    if (c.flow !== null) lines.push(`  Flow: ${c.flow} cfs (${c.flowLabel}, ${c.flowPct}% of median)`);
    if (c.tempF !== null) lines.push(`  Temp: ${c.tempF}°F / ${c.tempC?.toFixed(1)}°C (${c.tempLabel})`);
    if (c.gage !== null) lines.push(`  Gage: ${c.gage} ft`);
    if (c.stats?.p50) lines.push(`  Median for date: ${c.stats.p50} cfs`);
    if (c.flow === null && c.tempF === null) lines.push('  No live data available');
  }

  const userMessage = lines.join('\n');

  try {
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = result.content[0].text.trim();
    // Strip any markdown fences
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(clean);
  } catch(e) {
    console.error('[generator] AI failed:', e.message);
    // Fallback: generate plain descriptions from data
    const fallback = { lead: `Stream conditions for ${today}. USGS data current.`, rivers: {} };
    for (const r of riverData) {
      const c = r.conditions;
      const rating = RATINGS[c.ratingKey]?.label || 'Unknown';
      const parts = [];
      if (c.flow !== null) parts.push(`${c.flow} cfs (${c.flowLabel})`);
      if (c.tempF !== null) parts.push(`${c.tempF}°F`);
      fallback.rivers[r.id] = `${rating}. ${parts.join(', ') || 'Check USGS for current readings.'}.`;
    }
    return fallback;
  }
}
