import { redisConfig, bump, clientIp, phoneId } from './_store.js';

/* Checks the 6-digit code with Twilio Verify. Only Twilio can approve it,
   so guessing in the browser gets you nowhere - but every check costs an
   API call, so attempts are counted and capped. */

function twilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  return sid && token && service ? { sid, token, service } : null;
}

/* Rate-limit keys use a one-way phone id from _store.js - never the full
   number. */

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Use POST' }); return; }

  const cfg = twilioConfig();
  if (!cfg) { res.status(503).json({ ok: false, error: 'Phone sign-in is not set up on the server.' }); return; }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    res.status(400).json({ ok: false, error: 'Bad request body.' });
    return;
  }
  const phone = String(body.phone || '').replace(/[^\d+]/g, '');
  const code = String(body.code || '').replace(/\D/g, '');
  if (!phone || code.length < 4) { res.status(400).json({ ok: false, error: 'Type the 6-digit code.' }); return; }

  // No store, no guessing game: without counting, one script can brute-force
  // against Twilio on our bill.
  const store = redisConfig();
  if (!store) {
    res.status(503).json({ ok: false, error: 'Phone sign-in needs the usage store connected (Upstash Redis) before codes can be checked.' });
    return;
  }
  try {
    const ip = clientIp(req);
    const win = Math.floor(Date.now() / 600000); // 10-minute windows
    const ipTries = await bump(store, `otpcheck:ip:${ip}:${win}`, 700);
    const phoneTries = await bump(store, `otpcheck:ph:${phoneId(phone)}:${win}`, 700);
    if (ipTries > 30 || phoneTries > 8) { res.status(429).json({ ok: false, error: 'Too many attempts. Wait ten minutes.' }); return; }
  } catch {
    res.status(503).json({ ok: false, error: 'Could not check the limit. Try again shortly.' });
    return;
  }

  try {
    const url = 'https://verify.twilio.com/v2/Services/' + cfg.service + '/VerificationCheck';
    const out = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(cfg.sid + ':' + cfg.token).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, Code: code }).toString(),
    });
    const data = await out.json().catch(() => ({}));
    if (!out.ok || data.status !== 'approved') {
      res.status(401).json({ ok: false, error: 'That code did not match. Try again.' });
      return;
    }

    res.status(200).json({
      ok: true,
      account: { provider: 'phone', id: phoneId(phone), name: '', verified: true },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Could not check the code.' });
  }
}
