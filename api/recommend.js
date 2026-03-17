// GET /api/recommend?id=ausable
// Returns AI-powered fly recommendations based on:
//   - Live USGS data (water temp, flow %)
//   - Static Michigan hatch chart (lib/hatches.js)
//   - Current hatch intel from RSS feeds (lib/intel.js)
//   - Time of day and time of year
//
// Cached 4 hours in Redis — recommendations don't change that fast.

import { Redis } from '@upstash/redis';
import Anthropic from '@anthropic-ai/sdk';
import { RIVERS } from '../lib/rivers.js';
import { fetchLiveReadings, fetchAllStats } from '../lib/usgs.js';
import { buildConditions } from '../lib/rater.js';
import { buildRecommendations, getTempZone, getFlowAdvice, MICHIGAN_HATCHES } from '../lib/hatches.js';
import { fetchHatchIntel } from '../lib/intel.js';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const CACHE_TTL = 4 * 60 * 60; // 4 hours

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const river = RIVERS.find(r => r.id === id);
  if (!river) return res.status(404).json({ error: 'River not found' });

  const redis     = makeRedis();
  const now       = new Date();
  const hourUTC   = now.getUTCHours();
  const hourET    = ((hourUTC - 5 + 24) % 24); // approximate ET
  const month     = now.getMonth() + 1;
  const dateKey   = now.toISOString().slice(0, 10);
  const hourBucket = Math.floor(hourET / 4); // 6 buckets per day
  const cacheKey  = `trout:recommend:${id}:${dateKey}:${hourBucket}`;

  // Try cache
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json({ success: true, cached: true, ...parsed });
      }
    } catch(e) { /* non-fatal */ }
  }

  try {
    // Fetch live conditions
    const [liveReadings, allStats] = await Promise.all([
      fetchLiveReadings([river.primaryGauge]),
      fetchAllStats([river.primaryGauge]),
    ]);

    const reading    = liveReadings[river.primaryGauge] || {};
    const stats      = allStats[river.primaryGauge]    || {};
    const conditions = buildConditions(reading, stats);

    // Build static recommendations from hatch chart
    const staticRec = buildRecommendations(
      conditions.tempF,
      conditions.flowPct,
      conditions.ratingKey,
      month,
      hourET
    );

    // Fetch current hatch intel from RSS (cached separately in Redis)
    let intel = null;
    const intelKey = `trout:intel:${dateKey}`;
    if (redis) {
      try {
        const cachedIntel = await redis.get(intelKey);
        if (cachedIntel) {
          intel = typeof cachedIntel === 'string' ? JSON.parse(cachedIntel) : cachedIntel;
        }
      } catch(e) { /* non-fatal */ }
    }

    if (!intel) {
      intel = await fetchHatchIntel();
      if (redis && intel) {
        try { await redis.set(intelKey, JSON.stringify(intel), { ex: 6 * 60 * 60 }); }
        catch(e) { /* non-fatal */ }
      }
    }

    // Generate AI recommendation
    const aiRec = await generateAIRecommendation(river, conditions, staticRec, intel, month, hourET);

    const payload = {
      river: { id: river.id, name: river.name },
      conditions: {
        tempF:      conditions.tempF,
        tempLabel:  conditions.tempLabel,
        flow:       conditions.flow,
        flowPct:    conditions.flowPct,
        flowLabel:  conditions.flowLabel,
        ratingKey:  conditions.ratingKey,
      },
      recommendation: aiRec,
      staticRec: {
        activeHatches: staticRec.activeHatches.map(h => ({
          name: h.name, timeOfDay: h.timeOfDay, tempRange: h.tempRange,
          patterns: h.patterns, presentation: h.presentation, notes: h.notes,
        })),
        flowAdvice: staticRec.flowAdvice,
        timeAdvice: staticRec.timeAdvice,
        topFlies:   staticRec.topFlies,
      },
      intel: {
        items: (intel?.items || []).slice(0, 3).map(i => ({
          title: i.title, date: i.date, url: i.url, source: i.source,
          excerpt: i.content.slice(0, 200),
        })),
      },
      context: { month, hourET, dateKey },
      generatedAt: now.toISOString(),
    };

    if (redis) {
      try { await redis.set(cacheKey, JSON.stringify(payload), { ex: CACHE_TTL }); }
      catch(e) { /* non-fatal */ }
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ success: true, cached: false, ...payload });

  } catch(e) {
    console.error(`[recommend/${id}]`, e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}

async function generateAIRecommendation(river, conditions, staticRec, intel, month, hour) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = monthNames[month] || '';

  // Build context
  const lines = [
    `River: ${river.name} (${river.region})`,
    `Date context: ${monthName}, ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 20 ? 'evening' : 'night'} (approximately ${hour}:00 ET)`,
    '',
    'CURRENT CONDITIONS (USGS live data):',
  ];

  if (conditions.tempF !== null) lines.push(`  Water temp: ${conditions.tempF}°F (${conditions.tempLabel})`);
  else lines.push('  Water temp: unavailable');

  if (conditions.flow !== null) {
    lines.push(`  Flow: ${conditions.flow} cfs (${conditions.flowPct}% of seasonal median — ${conditions.flowLabel})`);
  } else {
    lines.push('  Flow: unavailable');
  }
  lines.push(`  Conditions rating: ${conditions.ratingKey}`);

  // Active hatches from chart
  lines.push('', 'ACTIVE HATCHES FROM MICHIGAN HATCH CHART:');
  if (staticRec.activeHatches.length) {
    for (const h of staticRec.activeHatches) {
      lines.push(`  • ${h.name} (${h.timeOfDay}) — patterns: ${h.patterns.map(p => `${p.name} #${p.sizes[0]}`).join(', ')}`);
      lines.push(`    ${h.presentation}`);
    }
  } else {
    lines.push('  No hatches active for these conditions/season.');
  }

  // Flow advice
  if (staticRec.flowAdvice) {
    lines.push('', `FLOW ADVICE: ${staticRec.flowAdvice.summary}`);
    lines.push(`  ${staticRec.flowAdvice.technique}`);
    if (staticRec.flowAdvice.flies?.length) {
      lines.push(`  Suggested: ${staticRec.flowAdvice.flies.join(', ')}`);
    }
  }

  // Current intel
  const goodIntel = (intel?.items || []).filter(i => i.score?.hatchScore >= 2).slice(0, 3);
  if (goodIntel.length) {
    lines.push('', 'CURRENT HATCH INTEL (from Hatch Magazine / MidCurrent):');
    for (const item of goodIntel) {
      lines.push(`  [${item.source} — ${item.date}] ${item.title}`);
      if (item.content) lines.push(`    ${item.content.slice(0, 200)}`);
    }
  }

  const SYSTEM = `You are an expert Michigan trout guide writing a specific fly recommendation for an angler checking conditions before a trip.

Write 3-4 tight paragraphs:
1. Lead with the most important thing — is it worth going, and why? Be direct.
2. Specific flies and sizes for TODAY's conditions. Always give pattern name + size. Be specific: not "a nymph" but "Pheasant Tail #16 with split shot."
3. Presentation advice: where on the river to fish, how to fish it, what time of day if the angler has flexibility.
4. One honest note about what might surprise them or what to watch for.

Use real fly fishing language. No bullet points. No headers. Plain paragraphs.
Keep it under 300 words. Write like you're texting a friend before they leave for the river.`;

  try {
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: 'user', content: lines.join('\n') }],
    });
    return result.content[0].text.trim();
  } catch(e) {
    console.error('[recommend] AI error:', e.message);
    // Fallback to structured static rec
    if (!staticRec.activeHatches.length) return null;
    const h = staticRec.activeHatches[0];
    return `${staticRec.flowAdvice?.summary || 'Conditions are fishable'}. Primary hatch: ${h.name}. ${h.presentation} Flies: ${h.patterns.slice(0,3).map(p => `${p.name} #${p.sizes[0]}`).join(', ')}.`;
  }
}
