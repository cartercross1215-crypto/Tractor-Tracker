# CLAUDE.md — Tractor Tracker project brief

Read this first. Orientation for every Claude/agent session in this repo.

> This is a **separate project from miqro-web**. None of the miqroweb rules (deploy queue,
> release train, agent fleet, `/ship`) apply here. Deep/evolving knowledge lives in auto-memory
> (`~/.claude/projects/-Users-rileynewell-Documents-tractor-tracker/memory/MEMORY.md`).

---

## What this is

**Tractor Tracker** — a local-first PWA for farmers and independent contractors to track
equipment, jobs, fuel, maintenance, and contractor billing. Pre-revenue MVP / free unlimited beta.

- **Owner/repo:** `github.com/cartercross1215-crypto/Tractor-Tracker` (branch: `main`)
- **Live:** https://tractor-tracker-yboz.onrender.com
- **Support email:** tractortracker.support@gmail.com (also the `ADMIN_EMAILS` account)
- **Paid direction:** Unlimited plan ~$9.99/mo. Checkout/webhooks **not built yet**.

## The stack (deliberately tiny — keep it that way unless there's a reason)

| Piece | What |
|---|---|
| `index.html` / `app.js` / `styles.css` | The whole frontend. Vanilla JS, no framework, no build step. `app.js` is ~4.5k lines / 164KB. |
| `sw.js` + `manifest.webmanifest` | Service worker + PWA install (iOS home-screen icons in `icons/`). |
| `server.py` | The **entire** backend. Python stdlib `http.server` (`SimpleHTTPRequestHandler`) — no FastAPI/Flask. Serves the static app *and* the `/api/*` account+sync API from one origin. |
| `requirements.txt` | One dep: `psycopg[binary]`. |
| `Dockerfile` | python:3.12-slim, `CMD python3 server.py`, port 10000. |
| `render.yaml` | Render blueprint (the deploy config). |

## Hosting — **Render is this project's Railway**

Render web service `tractor-tracker`, Docker runtime, starter plan, health check `/api/health`,
1GB disk at `/data` (SQLite fallback only).

- **Deploy = push to `main`.** Render auto-builds from the connected GitHub repo.
- **Env vars** are set in the Render dashboard/API. `render.yaml` declares them; `sync: false`
  ones (`DATABASE_URL`, `RESEND_API_KEY`, SMTP creds) are secrets set in Render, not in the repo.
- `/api/health` is the source of truth after any deploy — it reports database mode, email
  provider config, and static-file presence. Check it every time.

## Database — Supabase Postgres

- Project: `bvpxvkqiaplyiejpmhtj` (https://supabase.com/dashboard/project/bvpxvkqiaplyiejpmhtj)
- Connected via `DATABASE_URL` (Supabase **Session-mode shared pooler** — required for
  Render's IPv4-only hosting). Not the direct `db.<ref>.supabase.co` host.
- **Schema is created in code, not migrations.** `init_postgres_db()` in `server.py` runs
  `CREATE TABLE IF NOT EXISTS` on boot: `users`, `farms`, `sessions`, `password_resets`,
  `support_audit`. Changing the schema = editing that function (and it must stay
  `IF NOT EXISTS`-safe, since it re-runs on every boot).
- **SQLite fallback:** if `DATABASE_URL` is unset the server silently falls back to
  `tractor_tracker.db` on the `/data` disk. A missing/broken `DATABASE_URL` therefore looks
  "healthy" while writing to ephemeral local storage — always confirm `"database": "postgres"`
  in `/api/health`.
- This is **not** a Supabase-client app: no PostgREST, no RLS, no anon key. All access is
  server-side Postgres over the pooler. Auth is homegrown (salted SHA hash + bearer session
  tokens in the `sessions` table), *not* Supabase Auth.

## Email

Resend preferred (HTTPS, works on Render), SMTP/Gmail app-password as fallback. Used for
password-reset links only. Currently sending from `onboarding@resend.dev` — a verified domain
is needed before real launch.

## Hard rules

0. **Two devs share this repo — `git fetch` before you touch anything.** Carter
   (`cartercross1215-crypto`, who owns the repo *and* the Render account) pushes to `main`
   directly and often. On 2026-08-07 a fresh clone went **11 commits stale in ~40 minutes**, and
   GitHub's `pushed_at` read a month old while he was mid-stream. There is no branch protection
   and no staging, so both devs are writing straight to production.
   - Every session, before editing or reasoning about "current" code:
     `git fetch origin && git rev-list --count HEAD..origin/main`
   - Prefer a branch + PR over pushing `main` while the other dev is active. Coordinate first.
   - Riley (`rnewell07`) has **push but not admin** on the repo.
1. **`main` is production.** Pushing to `main` deploys to real users. Verify locally first
   (`python3 server.py`, open http://127.0.0.1:8000), then push, then check `/api/health`.
2. **Don't commit databases or secrets.** `tractor_tracker.db*` files were committed and later
   deleted from history's tip — they must stay out. No `DATABASE_URL`, API keys, or app
   passwords in the repo; secrets live in Render env vars only.
3. **One origin, one server.** The app and API are served from the same process. Don't split
   them or introduce CORS unless there's a real reason.
4. **No build step.** Edits to `app.js`/`styles.css` ship as-is. If you change cached assets,
   bump the cache name in `sw.js` or users get stale files.
5. **Local-first is the product.** The app must keep working signed-out and offline; sync is
   additive. Don't make a feature require the server unless it genuinely needs an account.
6. **Support-admin tools are privileged.** `ADMIN_EMAILS` accounts can read/replace any
   customer's cloud data. Every use writes to `support_audit` — keep it that way.

## Run it

```sh
# Full app + API (SQLite locally unless DATABASE_URL is exported)
cd ~/Documents/tractor-tracker && python3 server.py   # -> http://127.0.0.1:8000

# Static-only / PWA testing
python3 -m http.server 8000
```

## Open items

- Payments: no Stripe checkout, subscriptions, or webhooks yet.
- No automated tests, no linter, no CI.
- Resend sender domain not verified (test sender in use).
- Render API access not yet wired for this session — see memory for status.
