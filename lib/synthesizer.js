// Synthesize outfitter reports into a plain-spoken guide brief
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `You are summarizing fishing reports for Michigan trout anglers. 
Write in the voice of an experienced guide: direct, specific, no fluff.

Given outfitter reports for a specific river, extract and summarize:
1. What species are being caught (brown, rainbow, brook, steelhead)
2. What they're biting on (specific flies, lures, bait: be specific: "size 16 Sulphur comparaduns", "white streamers on sink tip", "pink worms under an indicator")
3. Where on the river (upper, lower, specific pools or runs if mentioned)
4. Best time of day
5. Any hatch activity

Keep it under 150 words. If reports are pre-season or have no fishing detail, say so briefly.
Do NOT invent details not in the source material.

Output plain text only: no markdown, no headers, no bullet points.`;

export async function synthesizeReports(riverId, riverName, reports) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!reports?.length) return null;

  // Check if there's actually fishing content to synthesize
  const hasContent = reports.some(r => r.posts?.some(p => 
    p.content?.length > 50 || p.excerpt?.length > 50
  ));
  if (!hasContent) return null;

  const client = new Anthropic({ apiKey });

  const lines = [`River: ${riverName}`, '', 'REPORTS:'];
  for (const r of reports) {
    for (const p of (r.posts || [])) {
      lines.push(`\nSource: ${r.source} (${p.date})`);
      lines.push(`Title: ${p.title}`);
      if (p.content) lines.push(`Content: ${p.content.slice(0, 500)}`);
    }
  }

  try {
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: 'user', content: lines.join('\n') }],
    });
    return result.content[0].text.trim();
  } catch(e) {
    console.error('[synthesizer] error:', e.message);
    return null;
  }
}
