# ShuttleIQ — AI Badminton Coaching & Team Management

An AI-powered badminton tool for players **and** coaches: analyze gameplay footage with AI, track every player's matches and form, score tryout prospects, get position recommendations, and build rosters.

---

## v6 (current) — Team Edition, clean UI

A single-page webapp. Open `index.html` in a browser (or serve the folder with any static server, e.g. `npx http-server`). Everything is saved locally in the browser; no backend.

**What changed from v5:** the cinematic dark theme was replaced with a simple, light design (system fonts, one accent color, no ceremony); the AI layer now supports **multiple providers** (Anthropic Claude, Google Gemini, or any OpenAI-compatible endpoint); recorded videos can be **saved to a clip library** (IndexedDB) per player; and there's a browsable **drill library** plus a **pro study list** on the Compare page.

### Structure & access
- **Landing page** — two doors: **Enter as player** or **Coach login**.
- **Player** — picks their name from the roster (or continues as a guest). Gets a personal dashboard (form, skill radar, focus areas, latest AI feedback), the read-only Team view, Analyze, Compare, and Drills.
- **Coach** — protected by a passcode (4+ digits, hashed, stored only on that device; first run creates it). The role is per-tab; "Log out" clears it. The passcode can be changed from Settings.

### For players
- **Analyze** — Record up to 60 seconds from your camera (auto-stops) or upload a clip. The AI returns timestamped coaching cards (critical / suggestion / positive) plus 0–100 scores across Footwork, Smash, Serve, Defense, Net play, and Consistency. Click a card to jump to that moment. Clips can be saved to the library. Without an API key you can preview a clearly-labeled sample analysis (never saved).
- **Compare** — Pick a pro from the study list (14 players across all disciplines, each with specific technique points to watch for and a YouTube search link), then either paste a YouTube link to watch them side by side, or load a local pro clip for synced slow-mo/frame-step playback and an AI breakdown of the key differences.
- **Drills** — 18 standard drills (3 per skill, Beginner→Advanced) with concrete descriptions and measurable targets. Linked players see drills recommended from their current weaknesses.

### For coaches
- **Dashboard** — Team pulse: streak/slump alerts, in-form players with sparklines, latest matches, headline stats.
- **Insights** — Season trajectory, **depth chart** (best-fit players per role), **practice plan** (weakest team skills with drills and focus players, printable), **head-to-head** records per opponent, and **doubles chemistry** (win rates of pairs who've played together).
- **Players** — Profiles with skill radar, form trend, position fit (singles / doubles front / doubles back), strengths, weakest skills with drills, saved clips, match history, analysis sessions, and an optional AI-written coach note.
- **Matches** — Log every match per player: discipline, partner, opponent, score, win/loss, quick 1–5 skill ratings. Tryout players' matches are tagged automatically.
- **Tryouts** — Add prospects and tap 1–5 scores across seven drills as they play; the board re-ranks live. Record each prospect on video, log their tryout matches, then promote keepers to the roster or cut.
- **Rosters** — Build lineups (3 singles, 2 doubles, mixed by default — add or remove slots to match your league) with one-click **auto-suggest** from position fit, win rate, and pair chemistry. Warns when a player exceeds 2 events. Copy as text or print a single lineup.
- **Quality-of-life** — add several players/prospects at once ("Alex, Ben, Chris"), private per-player coach notes, and a CSV export of all matches for spreadsheets.

### Setup
- Works fully without an API key (all team management + local analytics).
- For AI features, add a key in Settings — the **Free setups** buttons prefill everything except the key:
  - **Google Gemini** (recommended free option) — key from aistudio.google.com, no card needed; vision-capable out of the box.
  - **OpenRouter** — key from openrouter.ai; pick any vision model tagged `:free`.
  - **Groq** — key from console.groq.com; fast free tier with Llama vision models.
  - Paid/other: **Anthropic Claude** (console.anthropic.com) or any OpenAI-compatible endpoint via a custom base URL.
- **Three themes** in Settings → Appearance (or the moon button in the header): **Midnight** (dark, volt accent — default), **Court** (varsity green), **Clean** (minimal light). The choice is saved on the device.
- Settings also has JSON export/import for backups, a sample-data loader to explore the app, and a storage meter.
- **Works offline & installs like an app** — once opened over http(s), a service worker caches the app (gym wifi won't take it down), and on a phone you can "Add to Home Screen" for a standalone app experience.

### Files
| File | Purpose |
|---|---|
| `index.html` | App shell, CSP, favicon, script loading |
| `manifest.json` / `icon.svg` / `sw.js` | Installable PWA + offline caching (network-first) |
| `styles.css` | Light design system: tokens, cards, tables, forms, print rules |
| `js/data.js` | Drill library (18 drills) + pro study list (14 players) |
| `js/store.js` | localStorage persistence (with v5 migration), roles/passcode, IndexedDB clip library, redacted export/import, sample data |
| `js/analytics.js` | Form, position fit, drills, roster suggestions, pair chemistry, depth chart, practice plan, head-to-head |
| `js/charts.js` | Dependency-free inline SVG charts (skill radar, win-rate sparkline) |
| `js/ai.js` | Frame extraction + multi-provider vision calls (Anthropic / Gemini / OpenAI-compatible), demo analysis |
| `js/app.js` | Views, routing, role gating |

---

## Publishing & safety

This is a **static, local-first** webapp — no server, no database. To publish, drop the folder on any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages) or open `index.html` directly. No build step, no dependencies.

Security choices:
- **Content-Security-Policy** — scripts only from the app's own origin, no inline handlers, no objects/embeds; network calls limited to HTTPS.
- **No secrets in backups** — exported JSON has the API key and passcode stripped, so a shared backup can't leak them. Importing keeps the current device's key/passcode.
- **Strict imports** — backup files are validated field-by-field; unknown keys are dropped rather than merged into app state.
- **XSS-safe rendering** — all user input and AI-returned text is HTML-escaped before touching the DOM.
- **Honest threat model** — the API key lives in the browser and is sent directly to the chosen provider; anyone with devtools access can read it. On a shared device, clear it when done. The coach passcode is a **soft gate** for a shared team device, not hardened auth. For real multi-user security you'd put a backend in front of the API.
- **Videos stay local** — clips live in the browser's IndexedDB and are never uploaded anywhere; AI analysis sends only a handful of downscaled JPEG frames to the provider.

### Why vanilla JS, not TypeScript
A TS build would add a compile step and node toolchain, making this *harder* to publish. As plain scripts the app deploys as-is to any static host and opens straight from `index.html`. The code stays maintainable through small single-responsibility modules (`data` / `store` / `analytics` / `charts` / `ai` / `app`).

---

## Older versions

| Where | Notes |
|---|---|
| `v5/` | v5 "Team Edition" — same feature core with the cinematic monochrome dark theme, Claude-only AI |
| `shuttleiq_v4_publish.html` | Solo analyzer — fixed API calls, import/export, score breakdowns |
| `shuttleiq_v3.html` | Intermediate iteration |
| `shuttleiq_v2.html` | Original version |
| `antigravity/` | Earlier multi-file experiment |
