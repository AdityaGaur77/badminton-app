/* Shared helper for the analytics functions.
   Talks to Upstash Redis over plain HTTPS, so there are no npm packages and
   the project keeps its "no build step" rule. */

import crypto from 'crypto';

/* One-way id for a phone number. Rate-limit keys and account ids use this,
   so the raw number never lands in the usage store. Digits are normalised
   first, so "+1 555..." and "1555..." map to the same id. */
export function phoneId(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const salt = process.env.PHONE_ID_SALT || 'shuttleiq-phone';
  return 'p:' + crypto.createHash('sha256').update(salt + digits).digest('hex').slice(0, 24);
}

export function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: String(url).replace(/\/+$/, ''), token } : null;
}

export async function pipeline(cfg, commands) {
  const res = await fetch(cfg.url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error('Storage returned ' + res.status);
  return res.json();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/* Fixed-window rate limiter backed by Redis INCR + EXPIRE.
   key must already include the window slot (e.g. prefix + day, or prefix + minute).
   Returns the running count; callers compare it with their own limit.
   Throws when storage is unreachable — callers decide whether to fail open or closed. */
export async function bump(cfg, key, ttlSeconds) {
  const out = await pipeline(cfg, [
    ['INCR', key],
    ['EXPIRE', key, ttlSeconds],
  ]);
  return Number(out[0] && out[0].result) || 0;
}

/* Best-effort client IP. The platform sets x-forwarded-for; anything the
   page sends is ignored. */
export function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.headers['x-real-ip'] || 'noip';
}
