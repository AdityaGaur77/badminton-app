# Free team model (NVIDIA) — setup

Lets every player use AI analysis with **no key of their own**.
The key sits on your server. Players never see it and cannot copy it.

## Why it must run on the server

- A key in the browser can be copied by anyone who opens dev tools. Your free
  quota would be gone in a day.
- NVIDIA's API very likely refuses browser calls (CORS) anyway.
- A limit in the browser is not a limit. Anyone can delete it.

So the app calls **your** `/api/ai`, and that calls NVIDIA.

## Setup

### 1. Get a key
Go to **build.nvidia.com**, sign in, pick a **vision** model (it must read
images), and copy the API key.

### 2. Add the usage store
You need Upstash Redis so usage can be counted. If you already set it up for
analytics, it is done. If not: Vercel → **Storage → Create Database → Upstash
for Redis** (free) → **Connect** to the project.

**Without the store the endpoint refuses to run.** That is on purpose: an
uncounted free key is a key that gets drained.

### 3. Add the variables
Vercel → Settings → Environment Variables:

| Name | Value | Needed |
|---|---|---|
| `NVIDIA_API_KEY` | your key | yes |
| `AI_PROXY_MODEL` | the model id you picked | recommended |
| `AI_PROXY_BASE_URL` | `https://integrate.api.nvidia.com/v1` | only to change provider |
| `AI_DAILY_PER_USER` | `10` | optional |
| `AI_DAILY_TOTAL` | `200` | optional |
| `AI_PER_MINUTE` | `3` | optional |

Check the model id on build.nvidia.com. The built-in default may be out of
date — a wrong id gives a clear error in the app, so set it yourself.

### 4. Redeploy, then switch it on
Settings → AI coach → **Free team model**. The line underneath says whether
it is live and how many analyses you have left today.

## The limits

Three at once, all counted on the server:

| Limit | Default | Stops |
|---|---|---|
| Per minute, per person | 3 | one person spamming the button |
| Per day, per person | 10 | one player using the whole quota |
| Per day, whole team | 200 | the free quota running dry |

Counted by **IP first** (hard to fake) and device id second. One player
hitting a limit never blocks anybody else — that is tested.

Each limit has its own plain message, like
*"You have used your 10 free analyses for today. Come back tomorrow."*

## What it can and cannot do

- **Can:** read still frames picked from the busiest parts of your clip.
- **Cannot:** read full video. Only **Gemini** does that, so Gemini still
  gives better footwork and timing feedback.

The app blocks video for this model instead of sending it and failing.

## Keep in mind

This is the **other** way round from a personal key: here *you* pay the
quota for the whole team. That is what the limits are for. If the team grows,
raise `AI_DAILY_TOTAL` only when you know the quota can take it.
