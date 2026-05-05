// POST /api/webhook-stripe
// Handles Stripe checkout.session.completed events
// Activates alert subscriber in Redis and sends welcome email

import { addSubscriber, sendWelcomeEmail } from '../lib/alerts.js';

// Stripe signature verification (no SDK needed: manual HMAC)
async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = sigHeader.split(',');
  const tPart = parts.find(p => p.startsWith('t='));
  const v1Part = parts.find(p => p.startsWith('v1='));
  if (!tPart || !v1Part) return false;

  const timestamp = tPart.slice(2);
  const signature = v1Part.slice(3);
  const signedPayload = `${timestamp}.${payload}`;

  // Web Crypto API (available in Node.js 18+ and Vercel Edge)
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, '0')).join('');

  return expected === signature;
}

// One year from now
function oneYearFromNow() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

export const config = {
  api: { bodyParser: false }, // need raw body for Stripe signature verification
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).end();
  }

  // Read raw body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');

  // Verify signature
  const sigHeader = req.headers['stripe-signature'] || '';
  const verified = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!verified) {
    console.error('[webhook] Invalid Stripe signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.metadata?.email || session.customer_email;
    const riversRaw = session.metadata?.rivers || '';
    const rivers = riversRaw.split(',').map(r => r.trim()).filter(Boolean);
    const customerId = session.customer || '';
    const paidThrough = oneYearFromNow();

    if (!email || !rivers.length) {
      console.error('[webhook] Missing email or rivers in session metadata');
      return res.status(200).end(); // 200 so Stripe doesn't retry
    }

    try {
      await addSubscriber(email, rivers, customerId, paidThrough);
      await sendWelcomeEmail(email, rivers);
      console.log(`[webhook] Activated subscriber: ${email} rivers=${rivers.join(',')}`);
    } catch(e) {
      console.error('[webhook] Failed to activate subscriber:', e.message);
      // Still return 200 so Stripe doesn't retry: log the failure
    }
  }

  return res.status(200).json({ received: true });
}
