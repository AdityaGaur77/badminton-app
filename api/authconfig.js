/* Tells the page which sign-in methods are switched on.
   Safe to be public: the Google client id is meant to be public, and no
   secret is ever returned. */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  const phoneReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID
  );
  res.status(200).json({
    google: Boolean(googleClientId),
    googleClientId,
    phone: phoneReady,
  });
};
