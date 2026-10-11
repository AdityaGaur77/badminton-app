/* Records ONE anonymous event. No names, no player data, no personal data.
   Fails quietly: analytics must never break the app for a player. */

import { redisConfig, pipeline, today } from './_store.js';

const MAX_EVENT_LEN = 40;
const SAFE_EVENT = /^[a-z0-9_]+$/;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Use POST' });
    return;
  }

  const cfg = redisConfig();
  if (!cfg) {
    // Storage not connected yet - accept and drop, so the app still works.
    res.status(200).json({ ok: true, stored: false });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const event = String(body.event || '').toLowerCase().slice(0, MAX_EVENT_LEN);
    const visitor = String(body.visitor || '').slice(0, 64);
    if (!SAFE_EVENT.test(event) || !visitor) {
      res.status(400).json({ ok: false, error: 'Bad event' });
      return;
    }

    const day = today();
    await pipeline(cfg, [
      ['HINCRBY', 'siq:day:' + day, event, 1],
      ['HINCRBY', 'siq:total', event, 1],
      ['PFADD', 'siq:u:' + day, visitor],
      ['PFADD', 'siq:u:all', visitor],
      ['SADD', 'siq:days', day],
      ['SADD', 'siq:events', event],
      ['EXPIRE', 'siq:day:' + day, 60 * 60 * 24 * 400],
      ['EXPIRE', 'siq:u:' + day, 60 * 60 * 24 * 400],
    ]);
    res.status(200).json({ ok: true, stored: true });
  } catch (err) {
    // Never surface storage trouble to a player mid-practice.
    res.status(200).json({ ok: true, stored: false });
  }
}
