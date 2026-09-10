/* Returns the analytics summary. The password lives ONLY here, in a Vercel
   environment variable, so it is never shipped to the browser. */

const { redisConfig, pipeline } = require('./_store');

const MAX_DAYS = 60;

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Use POST' });
    return;
  }

  const expected = process.env.ANALYTICS_PASSWORD || '';
  if (!expected) {
    res.status(503).json({ ok: false, error: 'No ANALYTICS_PASSWORD set in Vercel yet.' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const given = String(body.password || '');
  if (!safeEqual(given, expected)) {
    res.status(401).json({ ok: false, error: 'Wrong password.' });
    return;
  }

  const cfg = redisConfig();
  if (!cfg) {
    res.status(503).json({ ok: false, error: 'Analytics storage is not connected in Vercel yet.' });
    return;
  }

  try {
    const daysOut = await pipeline(cfg, [['SMEMBERS', 'siq:days']]);
    const allDays = (daysOut[0].result || []).sort();
    const days = allDays.slice(-MAX_DAYS);

    const cmds = [['HGETALL', 'siq:total'], ['PFCOUNT', 'siq:u:all']];
    for (const d of days) {
      cmds.push(['HGETALL', 'siq:day:' + d]);
      cmds.push(['PFCOUNT', 'siq:u:' + d]);
    }
    const out = await pipeline(cfg, cmds);

    // Upstash returns HGETALL as a flat [field, value, field, value] list.
    const toObj = flat => {
      const o = {};
      const arr = flat || [];
      for (let i = 0; i < arr.length; i += 2) o[arr[i]] = Number(arr[i + 1]) || 0;
      return o;
    };

    const totals = toObj(out[0].result);
    const uniqueAll = Number(out[1].result) || 0;
    const perDay = days.map((d, i) => {
      const events = toObj(out[2 + i * 2].result);
      const visitors = Number(out[3 + i * 2].result) || 0;
      const actions = Object.values(events).reduce((a, b) => a + b, 0);
      return { date: d, visitors, actions, events };
    });

    res.status(200).json({ ok: true, uniqueAll, totals, perDay, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Could not read analytics: ' + err.message });
  }
};
