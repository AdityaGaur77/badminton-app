# Sign-in — setup

Three ways in: **Google**, **phone + code**, and **guest**.
Guest works now and needs nothing. The other two need Vercel setup.

## What works right now, with no setup

- Guest sign-in
- Picking your name on a team device
- Coach passcode
- **Daily streaks**, badges, theme unlocks, and the **team leaderboard**

Streaks and the leaderboard read the data already on the device, so they work
today. Signing in matters when you want one streak that follows a player
across their phone, the team tablet, and a laptop.

## Google sign-in — free

1. Go to **console.cloud.google.com** → APIs & Services → Credentials.
2. **Create credentials → OAuth client ID → Web application**.
3. Under *Authorised JavaScript origins* add your site, e.g.
   `https://badminton-app-nu-eight.vercel.app`
4. Copy the **Client ID**.
5. In Vercel → Settings → Environment Variables, add:

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the client id you copied |

6. **Redeploy.**

The browser gets a token. `api/session.js` checks it with Google before
trusting it, so a fake token cannot steal a place on the leaderboard.

## Phone + code — this one costs money

There is no free way to send a text message. This uses **Twilio Verify**,
which charges per message (a few cents each). You need a Twilio account.

1. Twilio console → **Verify → Services → Create**.
2. In Vercel add:

| Name | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | from the Twilio dashboard |
| `TWILIO_AUTH_TOKEN` | from the Twilio dashboard |
| `TWILIO_VERIFY_SERVICE_SID` | the Verify service id |
| `PHONE_ID_SALT` | any long random text |

3. **Redeploy.**

### Think before you switch this on
Your players are school students. A phone number is personal data.
The app never stores the number: `api/otp-verify.js` turns it into a one-way
id using `PHONE_ID_SALT`, so the number cannot be read back out.
Google sign-in avoids collecting numbers at all, so prefer it where you can.

## Until you set them up

Both buttons appear but stay greyed out, and the page says plainly that they
are not switched on. Nothing silently fails.

## How a streak works

- One streak day = one day you ran an **AI video analysis**.
- Filming twice in a day still counts once.
- **Yesterday keeps your run alive**, so you do not lose it part-way through
  today. The card warns you when you are at risk.
- Rewards use your **best streak ever**, so a reward is never taken back.

| Best streak | Reward |
|---|---|
| 3 days | Court theme, 3-day badge |
| 7 days | Clean theme, Full-week badge |
| 14 days | Two-weeks badge |
| 30 days | A-month badge |

## Note on package.json

The repo now has `package.json` with `"type": "module"`, added by the Vercel
Web Analytics pull request. That makes every `.js` an ES module, so the files
in `api/` use `import`/`export default`, not `require`/`module.exports`.
Keep it that way or Vercel will fail to start them.

## Files

| File | Job |
|---|---|
| `js/auth.js` | sign-in from the browser |
| `api/authconfig.js` | says which methods are switched on |
| `api/session.js` | checks the Google token server-side |
| `api/otp-start.js` / `api/otp-verify.js` | sends and checks the SMS code |
