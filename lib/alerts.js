// Michigan Trout Report: Premium Condition Alerts
// Sends email via Resend (resend.com) when subscriber's rivers hit Prime or Fishing Well
// Redis key structure:
//   alerts:sub:{email}: JSON { rivers, paidThrough, stripeCustomerId, createdAt }
//   alerts:emails: Redis SET of all subscriber emails

import { Redis } from '@upstash/redis';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// ── Subscriber management ─────────────────────────────────────────────────

export async function addSubscriber(email, rivers, stripeCustomerId, paidThrough) {
  const r = makeRedis();
  if (!r) throw new Error('Redis not configured');
  const sub = {
    rivers,
    paidThrough,
    stripeCustomerId,
    createdAt: new Date().toISOString(),
    alertsSent: 0,
  };
  await r.set(`alerts:sub:${email.toLowerCase()}`, JSON.stringify(sub));
  await r.sadd('alerts:emails', email.toLowerCase());
  console.log(`[alerts] subscriber added: ${email} rivers=${rivers.join(',')}`);
}

export async function getSubscriber(email) {
  const r = makeRedis();
  if (!r) return null;
  const raw = await r.get(`alerts:sub:${email.toLowerCase()}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function removeSubscriber(email) {
  const r = makeRedis();
  if (!r) return;
  await r.del(`alerts:sub:${email.toLowerCase()}`);
  await r.srem('alerts:emails', email.toLowerCase());
}

async function getAllSubscribers() {
  const r = makeRedis();
  if (!r) return [];
  const emails = await r.smembers('alerts:emails');
  if (!emails?.length) return [];
  const subs = [];
  for (const email of emails) {
    const raw = await r.get(`alerts:sub:${email}`);
    if (!raw) continue;
    const sub = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Check subscription is still active
    if (sub.paidThrough && new Date(sub.paidThrough) > new Date()) {
      subs.push({ email, ...sub });
    }
  }
  return subs;
}

// ── Email sending via Resend ──────────────────────────────────────────────

const RESEND_API = 'https://api.resend.com/emails';
const FROM = process.env.ALERT_FROM || 'Michigan Trout Report <alerts@michigantroutreport.com>';
const BASE_URL = 'https://michigantroutreport.com';

const RATINGS = {
  PRIME:        { label: 'Prime',        emoji: '🎣', tagline: 'Drop everything and go.' },
  FISHING_WELL: { label: 'Fishing Well', emoji: '✅', tagline: 'Worth the drive.' },
  FAIR:         { label: 'Fair',         emoji: '🟡', tagline: 'Fishable. Pick your spots.' },
  TOUGH:        { label: 'Tough',        emoji: '🟠', tagline: 'Fish are off.' },
  BLOWN_OUT:    { label: 'Blown Out',    emoji: '🔴', tagline: 'Stay home.' },
};

const RIVER_NAMES = {
  'ausable': 'AuSable River', 'manistee': 'Manistee River',
  'pere-marquette': 'Pere Marquette River', 'muskegon': 'Muskegon River',
  'boardman': 'Boardman River', 'jordan': 'Jordan River',
  'pigeon': 'Pigeon River', 'rifle-river': 'Rifle River',
  'little-manistee': 'Little Manistee River', 'betsie-river': 'Betsie River',
  'pine-river': 'Pine River', 'platte-river': 'Platte River',
  'rogue-river': 'Rogue River', 'white-river': 'White River',
  'sturgeon-river-nlp': 'Sturgeon River', 'looking-glass-river': 'Looking Glass River',
  'tahquamenon-river': 'Tahquamenon River', 'black-river-up': 'Black River (UP)',
  'paint-river': 'Paint River', 'iron-river': 'Iron River',
  'brule-river': 'Brule River', 'au-train-river': 'Au Train River',
};

const RIVER_SLUGS = {
  'ausable': 'ausable-river', 'manistee': 'manistee-river',
  'pere-marquette': 'pere-marquette-river', 'muskegon': 'muskegon-river',
  'boardman': 'boardman-river', 'jordan': 'jordan-river-michigan',
  'pigeon': 'pigeon-river-michigan', 'little-manistee': 'little-manistee-river',
  'betsie-river': 'betsie-river', 'pine-river': 'pine-river-michigan',
  'platte-river': 'platte-river-michigan', 'rogue-river': 'rogue-river-michigan',
};

async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[alerts] RESEND_API_KEY not set: would send to ${to}: ${subject}`);
    return false;
  }
  const resp = await fetch(RESEND_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[alerts] Resend error ${resp.status}: ${err}`);
    return false;
  }
  return true;
}

function buildAlertEmail(email, alertRivers, date) {
  const subject = alertRivers.length === 1
    ? `🎣 ${alertRivers[0].name} is fishing ${alertRivers[0].rating.label} today`
    : `🎣 ${alertRivers.length} of your rivers are fishing well today`;

  const riverRows = alertRivers.map(r => {
    const slug = RIVER_SLUGS[r.id] || r.id;
    const flowLine = r.conditions.flow !== null
      ? `${r.conditions.flow.toLocaleString()} cfs (${r.conditions.flowLabel || ''})`
      : '';
    const tempLine = r.conditions.tempF !== null
      ? `${r.conditions.tempF}°F: ${r.conditions.tempLabel || ''}`
      : '';
    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #f0ece4;">
          <div style="font-size:18px;margin-bottom:4px">
            <span style="color:${r.ratingColor};font-weight:bold">${r.rating.emoji} ${r.rating.label}</span>
            &nbsp;<span style="font-size:14px;color:#888;font-weight:normal">: ${r.rating.tagline}</span>
          </div>
          <div style="font-size:16px;color:#1a3a1a;margin-bottom:6px">${r.name}</div>
          ${flowLine ? `<div style="font-size:13px;color:#666">Flow: ${flowLine}</div>` : ''}
          ${tempLine ? `<div style="font-size:13px;color:#666">Water: ${tempLine}</div>` : ''}
          <div style="margin-top:8px">
            <a href="${BASE_URL}/stream/${slug}.html" style="font-size:12px;color:#2c5f2d;background:#e8f5e9;padding:4px 10px;border-radius:3px;text-decoration:none">Full report →</a>
            &nbsp;
            <a href="${BASE_URL}/map.html" style="font-size:12px;color:#555;background:#f5f2ec;padding:4px 10px;border-radius:3px;text-decoration:none">Map →</a>
          </div>
        </td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ec;font-family:Georgia,'Times New Roman',serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px 16px">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

        <!-- Header -->
        <tr><td style="background:#1a3a1a;padding:18px 24px">
          <div style="color:#f0ede6;font-size:18px;font-weight:normal;letter-spacing:.5px">Michigan Trout Report</div>
          <div style="color:#7ab87a;font-size:12px;margin-top:3px">${date} · Premium Condition Alert</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:20px 24px">
          <p style="font-size:15px;color:#2c2c2c;margin:0 0 18px;line-height:1.6">
            ${alertRivers.length === 1
              ? `<strong>${alertRivers[0].name}</strong> is fishing <strong>${alertRivers[0].rating.label}</strong> today.`
              : `<strong>${alertRivers.length} of your rivers</strong> hit ${alertRivers.some(r => r.rating.label === 'Prime') ? 'Prime' : 'Fishing Well'} conditions today.`}
            Here are the numbers:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${riverRows}
          </table>
        </td></tr>

        <!-- Full report CTA -->
        <tr><td style="padding:0 24px 20px">
          <a href="${BASE_URL}" style="display:block;text-align:center;background:#1a3a1a;color:#fff;padding:12px 20px;border-radius:4px;text-decoration:none;font-size:14px;letter-spacing:.3px">
            View full Michigan conditions →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:14px 24px;border-top:1px solid #f0ece4;font-size:11px;color:#bbb;text-align:center">
          <a href="${BASE_URL}/alerts.html?unsubscribe=${encodeURIComponent(email)}" style="color:#bbb">Unsubscribe</a>
          &nbsp;·&nbsp; Michigan Trout Report &nbsp;·&nbsp;
          <a href="${BASE_URL}/chris-izworski" style="color:#bbb">Built by Chris Izworski</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ── Main: send alerts for today's conditions ──────────────────────────────

const ALERT_RATINGS = new Set(['PRIME', 'FISHING_WELL']); // only alert on good days
const RATING_COLORS = {
  PRIME: '#2e7d32', FISHING_WELL: '#558b2f', FAIR: '#f9a825',
  TOUGH: '#e65100', BLOWN_OUT: '#b71c1c',
};

export async function sendConditionAlerts(riverData, log = []) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.push('[alerts] RESEND_API_KEY not set: skipping alerts');
    return { sent: 0, skipped: 0 };
  }

  // Build quick lookup: riverId -> conditions
  const condMap = {};
  for (const r of riverData) condMap[r.id] = r;

  // Get all active subscribers
  const subscribers = await getAllSubscribers();
  log.push(`[alerts] ${subscribers.length} active subscribers`);

  if (!subscribers.length) return { sent: 0, skipped: 0 };

  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  let sent = 0, skipped = 0;

  for (const sub of subscribers) {
    // Find which of their rivers are in alert-worthy condition today
    const alertRivers = (sub.rivers || [])
      .map(rid => {
        const river = condMap[rid];
        if (!river?.conditions?.ratingKey) return null;
        if (!ALERT_RATINGS.has(river.conditions.ratingKey)) return null;
        const rat = RATINGS[river.conditions.ratingKey];
        return {
          id: rid,
          name: RIVER_NAMES[rid] || rid,
          conditions: river.conditions,
          rating: rat,
          ratingColor: RATING_COLORS[river.conditions.ratingKey] || '#666',
        };
      })
      .filter(Boolean);

    if (!alertRivers.length) { skipped++; continue; }

    const { subject, html } = buildAlertEmail(sub.email, alertRivers, date);
    const ok = await sendEmail(sub.email, subject, html);
    if (ok) {
      sent++;
      // Update alert count in Redis
      const r = makeRedis();
      if (r) {
        const raw = await r.get(`alerts:sub:${sub.email}`);
        if (raw) {
          const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
          data.alertsSent = (data.alertsSent || 0) + 1;
          data.lastAlertSent = new Date().toISOString();
          await r.set(`alerts:sub:${sub.email}`, JSON.stringify(data));
        }
      }
      log.push(`[alerts] sent to ${sub.email} (${alertRivers.map(r => r.id).join(',')})`);
    }
  }

  log.push(`[alerts] done: sent:${sent} skipped:${skipped}`);
  return { sent, skipped };
}

// ── Welcome email ─────────────────────────────────────────────────────────

export async function sendWelcomeEmail(email, rivers) {
  const riverNames = rivers.map(id => RIVER_NAMES[id] || id).join(', ');
  const subject = 'Michigan Trout Report: Alerts activated';
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f2ec;font-family:Georgia,'Times New Roman',serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px 16px">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:6px;overflow:hidden">
        <tr><td style="background:#1a3a1a;padding:18px 24px">
          <div style="color:#f0ede6;font-size:18px">Michigan Trout Report</div>
          <div style="color:#7ab87a;font-size:12px;margin-top:3px">Premium Condition Alerts</div>
        </td></tr>
        <tr><td style="padding:24px">
          <p style="font-size:15px;color:#2c2c2c;line-height:1.7;margin:0 0 16px">
            You're set. When your rivers hit <strong>Prime</strong> or <strong>Fishing Well</strong> conditions,
            you'll get an email with flow, temperature, and a direct link to the full report.
          </p>
          <p style="font-size:13px;color:#666;margin:0 0 16px">
            <strong>Your rivers:</strong> ${riverNames}
          </p>
          <p style="font-size:13px;color:#666;margin:0 0 20px">
            Alerts run once daily after the 8am CT data pull. No alerts on days your rivers aren't fishing well: we only send when it's worth your drive.
          </p>
          <a href="${BASE_URL}" style="display:block;text-align:center;background:#1a3a1a;color:#fff;padding:11px 20px;border-radius:4px;text-decoration:none;font-size:14px">Check today's conditions →</a>
        </td></tr>
        <tr><td style="padding:12px 24px;border-top:1px solid #f0ece4;font-size:11px;color:#bbb;text-align:center">
          <a href="${BASE_URL}/alerts.html?unsubscribe=${encodeURIComponent(email)}" style="color:#bbb">Unsubscribe</a>
          &nbsp;·&nbsp; Questions? Reply to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail(email, subject, html);
}
