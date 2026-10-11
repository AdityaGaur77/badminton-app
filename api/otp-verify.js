/* Checks the 6-digit code with Twilio Verify. Only Twilio can approve it,
   so guessing in the browser gets you nowhere. */

function twilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  return sid && token && service ? { sid, token, service } : null;
}

/* Never store or return a full phone number - keep a one-way id instead. */
function phoneId(phone) {
  const crypto = require('crypto');
  const salt = process.env.PHONE_ID_SALT || 'shuttleiq-phone';
  return 'p:' + crypto.createHash('sha256').update(salt + phone).digest('hex').slice(0, 24);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Use POST' }); return; }

  const cfg = twilioConfig();
  if (!cfg) { res.status(503).json({ ok: false, error: 'Phone sign-in is not set up on the server.' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const phone = String(body.phone || '').replace(/[^\d+]/g, '');
    const code = String(body.code || '').replace(/\D/g, '');
    if (!phone || code.length < 4) { res.status(400).json({ ok: false, error: 'Type the 6-digit code.' }); return; }

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
};
