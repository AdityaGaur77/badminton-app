/* Verifies a Google ID token with Google, then returns a plain account.
   Verification happens here, never in the browser, so a hand-made token
   cannot claim someone else's streak. */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Use POST' }); return; }

  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!clientId) { res.status(503).json({ ok: false, error: 'Google sign-in is not set up on the server.' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const credential = String(body.credential || '');
    if (!credential) { res.status(400).json({ ok: false, error: 'No credential sent.' }); return; }

    const check = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!check.ok) { res.status(401).json({ ok: false, error: 'Google rejected that sign-in.' }); return; }
    const info = await check.json();

    if (info.aud !== clientId) { res.status(401).json({ ok: false, error: 'That sign-in was for a different app.' }); return; }
    if (info.iss && !/accounts\.google\.com$/.test(String(info.iss).replace(/^https?:\/\//, ''))) {
      res.status(401).json({ ok: false, error: 'Unexpected token issuer.' }); return;
    }
    if (info.exp && Number(info.exp) * 1000 < Date.now()) {
      res.status(401).json({ ok: false, error: 'That sign-in expired. Try again.' }); return;
    }

    res.status(200).json({
      ok: true,
      account: {
        provider: 'google',
        id: 'g:' + info.sub,
        name: info.name || info.given_name || '',
        verified: true,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Sign-in check failed.' });
  }
};
