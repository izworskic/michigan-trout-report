// GET /api/alerts-manage?action=unsubscribe&email=...
// GET /api/alerts-manage?action=count  (protected)

import { removeSubscriber, getSubscriber } from '../lib/alerts.js';
import { ToolState } from '../lib/tool-state.cjs';

function makeState() {
      if (!process.env.TOOL_STATE_URL) return null;
  return new ToolState();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, email } = req.query;

  if (action === 'unsubscribe' && email) {
    try {
      await removeSubscriber(email);
      return res.status(200).json({ success: true, message: 'Unsubscribed successfully' });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (action === 'count') {
    // Protected: requires CRON_SECRET
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const r = makeState();
      const emails = r ? await r.smembers('alerts:emails') : [];
      return res.status(200).json({ count: emails?.length || 0 });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (action === 'check' && email) {
    // Let a subscriber check their own status
    const sub = await getSubscriber(email);
    if (!sub) return res.status(404).json({ found: false });
    return res.status(200).json({
      found: true,
      rivers: sub.rivers,
      paidThrough: sub.paidThrough,
      active: sub.paidThrough && new Date(sub.paidThrough) > new Date(),
    });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
