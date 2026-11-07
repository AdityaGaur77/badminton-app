/* Tells the page which sign-in methods are switched on.
   Safe to be public: the Google client id is meant to be public, and no
   secret is ever returned. */

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  const phoneReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID
  );
  const aiProxy = Boolean(
    (process.env.NVIDIA_API_KEY || process.env.AI_PROXY_KEY) &&
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)
  );
  res.status(200).json({
    aiProxy,
    aiDailyPerUser: Number(process.env.AI_DAILY_PER_USER) || 10,
    google: Boolean(googleClientId),
    googleClientId,
    phone: phoneReady,
  });
}
