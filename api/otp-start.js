/* Sends a 6-digit code by SMS using Twilio Verify.
   Twilio charges per message, so this stays off until the three
   TWILIO_* environment variables are set. */

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

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const phone = String(body.phone || '').replace(/[^\d+]/g, '');
    if (phone.replace(/\D/g, '').length < 7) { res.status(400).json({ ok: false, error: 'That number looks wrong.' }); return; }

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
