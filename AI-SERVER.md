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



## A default key, so anyone can just open the app and play

You cannot put a key in the app itself. The app is a static site, so a key
inside it is public - anyone can read it and spend your quota.

The safe version is the same proxy: put **your** key on the server, and
players need nothing at all.

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | your Gemini key |
| `AI_PROXY_MODEL` | `gemini-flash-lite-latest` |

Then Vercel → Redeploy, and in the app pick **Settings → AI coach → Free
team model**. Players just open the app and film. The limits in this file
protect the key.

Gemini is tried first, NVIDIA second, so whichever key you set is used.

### One limit of the shared key
The proxy sends **still frames, not whole video**, because a Vercel function
cannot take a large upload. A coach using their **own** key in the browser
still gets full video, which reads footwork better.

## Picking a free model — the numbers that actually matter

Two limits decide everything. Requests per day (RPD), and tokens per minute
(TPM). For video, TPM is usually the one that bites.

### Gemini free tier, from the real limits page

| Model family | Requests per minute | Requests per DAY |
|---|---|---|
| `flash-lite` | 15 | **about 500** |
| `flash` | 5 | **about 20** |
| `pro` | 0 | 0 (not on free) |

Same free tier. **25 times the capacity.** Always pick the lite model unless
you have paid credit. The app now defaults to `gemini-flash-lite-latest`
for exactly this reason.

### Why short clips beat long ones

Video burns tokens by the second. A 4-minute clip costs roughly four times a
1-minute clip, and TPM is 250K a minute. So:

- A 1-minute clip: you can send plenty per minute.
- A 4-minute clip: only a couple before TPM stops you.

It is not just a quota thing. **Four minutes of footage is mostly standing
around.** The app already picks the busiest moments, so a minute of real
rallies gives better coaching than four minutes of walking between points.
Keep the 60-second cap.

### Cap by requests, not by people

30 players times 3 clips is 90 analyses a day. That fits inside 500 with room
to spare. So set `AI_DAILY_TOTAL` to what the quota can take, and let the
player count follow. The limits in this file already do that.

## Privacy warning — read this before launching

**Free tiers log your inputs and may train on them.** Your inputs are videos
of school students. That applies to Gemini free tier and to NVIDIA free tier.
NVIDIA's free tier is also described as for study and development, not
production — check the terms yourself before you launch.

Two things help:
- Send **key frames instead of full video** where you can.
- Tell players and parents plainly what is sent and to whom.

If that is not acceptable, a paid tier (which usually does not train on
inputs) is the honest answer, not a different free provider.

## Keep in mind

This is the **other** way round from a personal key: here *you* pay the
quota for the whole team. That is what the limits are for. If the team grows,
raise `AI_DAILY_TOTAL` only when you know the quota can take it.
