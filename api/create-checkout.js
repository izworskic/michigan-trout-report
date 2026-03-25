// POST /api/create-checkout
// Creates a Stripe Checkout Session for the Premium Alerts subscription ($19/year)
// Body: { email, rivers: ['ausable', 'manistee', ...] }
// Returns: { url } — redirect to Stripe hosted checkout

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  const priceId = process.env.STRIPE_ALERTS_PRICE_ID;
  if (!priceId) return res.status(500).json({ error: 'Stripe price not configured' });

  const { email, rivers } = req.body || {};
  if (!email || !rivers?.length) {
    return res.status(400).json({ error: 'email and rivers required' });
  }
  if (rivers.length > 8) {
    return res.status(400).json({ error: 'Maximum 8 rivers per subscription' });
  }

  const BASE = 'https://michigan-trout-report.vercel.app';

  try {
    const body = new URLSearchParams({
      mode: 'payment',
      'payment_method_types[]': 'card',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'customer_email': email,
      success_url: `${BASE}/alerts.html?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE}/alerts.html?status=cancel`,
      'metadata[rivers]': rivers.join(','),
      'metadata[email]': email.toLowerCase(),
    });

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const session = await resp.json();
    if (!resp.ok) {
      console.error('[checkout] Stripe error:', session);
      return res.status(500).json({ error: session.error?.message || 'Stripe error' });
    }

    return res.status(200).json({ url: session.url });
  } catch(e) {
    console.error('[checkout] Fatal:', e.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
