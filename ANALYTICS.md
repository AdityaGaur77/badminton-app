# Usage analytics — setup

Anonymous counts of how many people use ShuttleIQ and what they do.
It counts **only** an event name, a random device id, and the date.
It never sends names, scores, video, or anything typed into the app.

## How to open the analytics page

Tap the **ShuttleIQ logo 5 times** (within 5 seconds), then enter the password.
There is no link to this page anywhere in the app.

## What you must do in Vercel (about 3 minutes)

### 1. Add the password
Vercel → your project → **Settings → Environment Variables**

| Name | Value |
|---|---|
| `ANALYTICS_PASSWORD` | any password you choose |

### 2. Add the storage
Vercel → your project → **Storage → Create Database → Upstash for Redis** (free plan).
Click **Connect** to the project. Vercel adds the URL and token variables on its own.

The code accepts either naming:
`KV_REST_API_URL` / `KV_REST_API_TOKEN`, or
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

### 3. Redeploy
Vercel → **Deployments → Redeploy**. Environment variables only apply to new builds.

## Until you finish those steps

- The app works exactly as before.
- Counting silently does nothing.
- The analytics page says the password or the storage is not set up yet.

## What gets counted

| Event | When |
|---|---|
| `app_open` | someone opens the app (once per tab session) |
| `session_coach` / `session_player` | which door they came in |
| `analyze_video` / `analyze_frames` / `analyze_demo` | an AI analysis finished |
| `match_logged` | a match was saved by hand |
| `live_score_saved` | a match was scored courtside |
| `roster_autofill` | auto-suggest was used |
| `ladder_challenge` | a ladder challenge was recorded |
| `tour_started_coach` / `tour_started_player` | the guided tour began |
| `theme_midnight` / `theme_court` / `theme_clean` | the theme was changed |

## Files

| File | Job |
|---|---|
| `js/track.js` | sends one anonymous event, fails silently |
| `api/track.js` | stores the event |
| `api/stats.js` | checks the password, returns the summary |
| `api/_store.js` | shared Redis helper (plain HTTPS, no packages) |
