# Body tracking (on device)

Measures real numbers from the clip and hands them to the AI as **facts**,
so it stops guessing motion from frozen pictures.

**Off by default.** Settings → Body tracking → tick the box.

## What it measures

| Number | Means |
|---|---|
| Court covered | how wide and deep you moved, as % of frame |
| Distance moved | total travel, in screen widths |
| Direction changes | how often you reversed direction |
| Time near your base | % of the clip spent back in the middle |
| Knee bend | degrees at the knee. **Lower = deeper bend** |
| Arm extension | degrees at the elbow. **Higher = straighter** |
| Stance width | gap between ankles, as % of frame |
| Body tracked in | % of sampled frames a body was found |

The AI is told these are measurements and that it must not contradict them.

## Where it runs

**In your browser. No video is sent anywhere for this part.** The model
file sits on your own site.

## The costs, honestly

- **About 15MB downloads the first time.** It is then cached and never
  downloaded again. It is *not* part of the normal offline cache, so the app
  itself stays small.
- **Adds roughly 10-30 seconds per clip.** Work is capped: 60 sample points
  no matter how long the clip, and a 35-second hard stop. If it runs out of
  time it uses what it has.
- Needs at least **8 good frames**. Below that it returns nothing rather
  than guess.

## When it will not work

- Nobody found in frame (filming the court with no player in it)
- Player too small, too dark, or cut off at the edges
- An old phone with no usable graphics path (it falls back to the slower CPU
  path automatically)

**Every one of those fails quietly.** The analysis still runs exactly as it
did before, just without the numbers.

If your body is found in **under 60%** of frames, the results page says so
and tells you to film from the back corner with your whole body in shot.

## What is tested, and what is not

**Tested:** the maths (angles verified against textbook values: 180, 90, 0,
135 degrees), that a deeper knee really gives a lower number, the loader,
the progress display, the no-person path, the off path, and that 15 pages
still render.

**Not tested: real badminton footage.** I have no clip of a real player, so
I cannot promise the numbers describe good or bad technique *well* — only
that they are measured correctly and consistently.

**Check it yourself with one clip:** film a rally, run it with tracking on,
and look at the measured panel. If a number looks wrong (for example, a deep
lunge reported as 170 degrees), tell me the number and what you saw, and I
will fix the measurement.

## Files

| File | Job |
|---|---|
| `js/pose.js` | loads the tracker, samples the clip, computes the numbers |
| `vendor/pose/` | the tracker and model, served from your own site |
