// GET /api/directory
// Returns the full outfitter directory as JSON

import { DIRECTORY } from '../lib/directory.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
  return res.status(200).json({
    success: true,
    listings: DIRECTORY,
    count: DIRECTORY.length,
    featured: DIRECTORY.filter(d => d.featured).length,
  });
}
