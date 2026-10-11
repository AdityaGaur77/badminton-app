/* ShuttleIQ - account sign-in (Google, phone OTP, or guest).
   Guest needs nothing. Google and phone need server setup; until that is
   done authConfig() reports them off and the buttons stay disabled. */

const ACCOUNT_KEY = 'siq_account';
let AUTH_CFG = null;

/* What the server has switched on. Cached for the page's lifetime. */
function authConfig() {
  if (AUTH_CFG) return AUTH_CFG;
  AUTH_CFG = fetch('/api/authconfig', { headers: { Accept: 'application/json' } })
    .then(r => (r.ok ? r.json() : { google: false, phone: false }))
    .catch(() => ({ google: false, phone: false }));
  return AUTH_CFG;
}

function currentAccount() {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null'); } catch { return null; }
}

function saveAccount(acct) {
  try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acct)); } catch { /* private mode */ }
}

function signOutAccount() {
  try { localStorage.removeItem(ACCOUNT_KEY); } catch { /* nothing to clear */ }
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[data-ext="' + src + '"]')) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.dataset.ext = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Could not load the Google script. Check your connection.'));
    document.head.appendChild(el);
  });
}

/* Google sign-in. The browser gets an ID token; the SERVER verifies it, so a
   faked token cannot buy a place on the leaderboard. */
async function signInWithGoogle() {
  const cfg = await authConfig();
  if (!cfg.google || !cfg.googleClientId) throw new Error('Google sign-in is not switched on yet.');
  await loadScriptOnce('https://accounts.google.com/gsi/client');
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    throw new Error('Google sign-in did not start. Try again.');
  }

  const credential = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Google sign-in timed out or was dismissed.')), 90000);
    try {
      window.google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: res => { clearTimeout(timer); res && res.credential ? resolve(res.credential) : reject(new Error('No credential returned.')); },
      });
      window.google.accounts.id.prompt(note => {
        if (note && note.isNotDisplayed && note.isNotDisplayed()) {
          clearTimeout(timer);
          reject(new Error('Google blocked the popup. Allow popups for this site, or use your phone number.'));
        }
      });
    } catch (e) { clearTimeout(timer); reject(e); }
  });

  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'google', credential }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Bad reply from the server.' }));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Sign-in failed.');
  saveAccount(data.account);
  return data.account;
}

/* Phone OTP. Needs an SMS provider configured on the server. */
async function startPhoneOtp(phone) {
  const cfg = await authConfig();
  if (!cfg.phone) throw new Error('Phone sign-in is not switched on yet.');
  const res = await fetch('/api/otp-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Bad reply from the server.' }));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Could not send the code.');
  return true;
}

async function verifyPhoneOtp(phone, code) {
  const res = await fetch('/api/otp-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Bad reply from the server.' }));
  if (!res.ok || !data.ok) throw new Error(data.error || 'That code did not work.');
  saveAccount(data.account);
  return data.account;
}
