/* Sends a 6-digit code by SMS using Twilio Verify.
   Twilio charges per message, so this stays off until the three
   TWILIO_* environment variables are set. When it is on, the usage
   store must also be connected - an SMS endpoint without a counter
   is an SMS endpoint someone can drain. */

import { redisConfig, bump, clientIp } from './_store.js';

function twilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  return sid && token && service ? { sid, token, service } : null;
}

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
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7) { res.status(400).json({ ok: false, error: 'That number looks wrong.' }); return; }

  // No store, no SMS: without counting, there is no limit, and every
  // text costs real money.
  const store = redisConfig();
  if (!store) {
    res.status(503).json({ ok: false, error: 'Phone sign-in needs the usage store connected (Upstash Redis) before it can send texts.' });
    return;
  }

  try {
    const ip = clientIp(req);
    const hour = Math.floor(Date.now() / 3600000);
    const day = new Date().toISOString().slice(0, 10);
    const ipHour = await bump(store, `otp:ip:${ip}:${hour}`, 3700);
    const ipDay = await bump(store, `otp:ipd:${ip}:${day}`, 172800);
    const phoneHour = await bump(store, `otp:ph:${phoneDigits}:${hour}`, 3700);
    if (ipHour > 5 || ipDay > 20) { res.status(429).json({ ok: false, error: 'Too many codes from this connection. Try again later.' }); return; }
    if (phoneHour > 3) { res.status(429).json({ ok: false, error: 'That number has been sent three codes this hour. Try again later.' }); return; }
  } catch {
    res.status(503).json({ ok: false, error: 'Could not check the limit. Try again shortly.' });
    return;
  }

  try {
    const url = 'https://verify.twilio.com/v2/Services/' + cfg.service + '/Verifications';
    const out = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(cfg.sid + ':' + cfg.token).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, Channel: 'sms' }).toString(),
    });
    if (!out.ok) {
      const detail = await out.json().catch(() => ({}));
      res.status(400).json({ ok: false, error: detail.message || 'Could not send the code.' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Could not send the code.' });
  }
}
