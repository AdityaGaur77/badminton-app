/* ShuttleIQ — anonymous usage counter.
   Sends ONLY an event name and a random device id. Never a player name, a
   score, an email, or anything typed into the app. Fails silently: if the
   endpoint is missing (opened from a file, or offline) nothing breaks. */

const TRACK_URL = '/api/track';
const TRACK_ENABLED = location.protocol === 'http:' || location.protocol === 'https:';

function anonVisitorId() {
  try {
    let id = localStorage.getItem('siq_visitor');
    if (!id) {
      id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('siq_visitor', id);
    }
    return id;
  } catch {
    return 'v-nostore';
  }
}

function track(event) {
  if (!TRACK_ENABLED) return;
  try {
    const body = JSON.stringify({ event: String(event), visitor: anonVisitorId() });
    let sent = false;
    if (navigator.sendBeacon) {
      sent = navigator.sendBeacon(TRACK_URL, new Blob([body], { type: 'application/json' }));
    }
    if (!sent) {
      fetch(TRACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* analytics must never interrupt practice */
  }
}

/* Count a thing at most once per browser tab session. */
function trackOnce(event) {
  try {
    const key = 'siq_t_' + event;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* private mode - just send it */
  }
  track(event);
}
