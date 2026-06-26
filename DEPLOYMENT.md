# Hosting Tractor Tracker Online

This app is now ready to run on an online host so Tractor Tracker works from any phone, tablet, or computer without your Mac staying on.

## What the host needs

- A Python web service or Docker web service
- HTTPS
- Supabase/Postgres for permanent account and sync data
- A persistent disk or volume only if you are using the fallback SQLite database
- These environment settings:
  - `HOST=0.0.0.0`
  - `PORT` should be the port your host provides
  - `DATABASE_URL` should be the Supabase Postgres connection string
  - `TRACTOR_TRACKER_DATA_DIR` should point to the persistent disk, such as `/data`, if `DATABASE_URL` is not set

## Start command

Use this start command on a Python host:

```sh
python3 server.py
```

Or deploy with the included `Dockerfile` on a Docker host.

## Recommended first host: Render

Render is a good first deploy target for this version because it supports Docker web services and secret environment variables. Supabase should hold the permanent database. The persistent disk is only needed as a fallback when `DATABASE_URL` is not configured.

1. Put this project in a GitHub repo.
2. In Render, choose **New Blueprint**.
3. Connect the GitHub repo.
4. Render will read `render.yaml`.
5. Confirm the `tractor-tracker` web service.
6. Add `DATABASE_URL` using the Supabase shared pooler connection string.
7. Keep the persistent disk mounted at `/data` only if you want SQLite fallback storage.
8. Deploy.
9. Open the `onrender.com` address Render gives you.

The included `render.yaml` sets:

- Docker runtime
- Starter web service
- `/api/health` health check
- `/data` persistent disk
- `TRACTOR_TRACKER_DATA_DIR=/data`
- `DATABASE_URL` secret placeholder for Supabase/Postgres
- SMTP placeholders for password-reset email

## Database

Tractor Tracker stores accounts and synced farm data in Supabase/Postgres when `DATABASE_URL` is set. If `DATABASE_URL` is missing, it falls back to SQLite and must use a persistent disk so the database is not erased when the service restarts.

For Render, use the Supabase shared pooler **Session mode** connection string because it works on IPv4-only hosting for persistent web services. In Supabase, open the project, click **Connect**, choose the Session pooler connection string, paste in the database password, and save it in Render as `DATABASE_URL`.

The local test files below should not be uploaded unless you are intentionally moving test data:

- `tractor_tracker.db`
- `tractor_tracker.db-shm`
- `tractor_tracker.db-wal`

## Health check

Use this path if the host asks for a health check:

```text
/api/health
```

## After deploy

Open the hosted HTTPS address in a browser. The same address serves the app and the sync/account server, so login, cloud sync, backups, and reports stay on one site.

## Password Reset Email

Password reset links are built into the server. To actually send reset emails, add SMTP settings in the host environment:

- `TRACTOR_TRACKER_PUBLIC_URL`
- `TRACTOR_TRACKER_SUPPORT_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `SMTP_USE_TLS`

For a temporary Gmail setup, use an app password, not your normal Gmail password:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=your Gmail address`
- `SMTP_PASSWORD=your 16-character Google app password`
- `SMTP_FROM=your Gmail address`
- `SMTP_USE_TLS=true`

In Render, each SMTP line must be its own environment variable. The `SMTP_PASSWORD` value should be only the Google app password itself, not the whole list of SMTP settings. If Google shows the app password in groups with spaces, the server will remove the spaces for Gmail, but the cleaned password length in the Render logs should still be `16`.

For a more professional production setup, use a transactional email provider such as Postmark, SendGrid, Mailgun, or Amazon SES and enter that provider's SMTP settings instead.

If SMTP is not configured, users will be told to contact the support email instead of receiving a reset email.

After changing SMTP variables in Render, redeploy the service and check the logs for `Password reset email configured=yes`, `password_set=yes`, `password_length=16`, and `password_value_problem=no`.
