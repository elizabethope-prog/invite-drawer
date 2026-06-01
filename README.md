# The Invite Drawer

A mobile-first tracker for your kids' birthday-party invites. Screenshot an invite,
the app reads the details, and you filter by kid (Bradley / Lilah), mark Going / Not going,
add it to Google Calendar, and view everything as a list or a month calendar.

The screenshot reading runs on a Netlify serverless function so it's reliable and your
Anthropic API key never touches the browser.

---

## What you need first
1. A free **Netlify** account.
2. An **Anthropic API key** from https://console.anthropic.com (this requires a billing
   account). Each screenshot read is a small vision-model call — typically well under a
   cent or two per invite. This is the one real cost of running it.
3. A **GitHub** account (recommended deploy path).

## Deploy (GitHub → Netlify, recommended)
1. Create a new GitHub repo and push these files to it.
2. In Netlify: **Add new site → Import an existing project →** pick the repo.
   Build settings auto-fill from `netlify.toml` (build `npm run build`, publish `dist`).
3. In Netlify: **Site settings → Environment variables → Add a variable**
   - Key: `ANTHROPIC_API_KEY`
   - Value: your Anthropic key
4. **Deploy.** When it's live, open the URL on your phone, then in Safari tap
   **Share → Add to Home Screen** for an app-like icon.

## Deploy (Netlify CLI alternative)
```
npm install -g netlify-cli
netlify deploy --build        # preview
netlify deploy --build --prod # go live
```
Set the `ANTHROPIC_API_KEY` env var in the Netlify dashboard either way.

## Run locally
```
npm install
npm install -g netlify-cli
netlify dev          # serves the app AND the function at http://localhost:8888
```
(`npm run dev` alone runs only the front-end — the screenshot reader needs `netlify dev`
so the function is available. Create a `.env` with `ANTHROPIC_API_KEY=...` for local reads.)

---

## Good to know
- **Where your data lives:** invites are stored in your browser's localStorage on the
  device you add them on. It persists across visits, but it does **not** sync between
  devices (your phone and laptop would each have their own list). Cross-device sync would
  need a small database + login — a later upgrade if you want it.
- **Undated invites** appear in the List (as "Date TBD") but not on the Calendar, since
  there's no day to place them on. Add a date and they'll show up on the grid.
- **Calendar button** prefills a Google Calendar event; you tap save. Messy time text may
  guess the window wrong — fix it on the calendar screen before saving.

## Files
- `src/App.jsx` — the whole app UI
- `netlify/functions/read-invite.mjs` — server-side screenshot reader
- `netlify.toml` — build + functions config
