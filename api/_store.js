/* Shared helper for the analytics functions.
   Talks to Upstash Redis over plain HTTPS, so there are no npm packages and
   the project keeps its "no build step" rule. */

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

