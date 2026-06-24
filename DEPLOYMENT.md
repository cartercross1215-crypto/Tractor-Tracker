# Hosting Tractor Tracker Online

This app is now ready to run on an online host so Tractor Tracker works from any phone, tablet, or computer without your Mac staying on.

## What the host needs

- A Python web service or Docker web service
- HTTPS
- A persistent disk or volume for the database
- These environment settings:
  - `HOST=0.0.0.0`
  - `PORT` should be the port your host provides
  - `TRACTOR_TRACKER_DATA_DIR` should point to the persistent disk, such as `/data`

## Start command

Use this start command on a Python host:

```sh
python3 server.py
```

Or deploy with the included `Dockerfile` on a Docker host.

## Recommended first host: Render

Render is a good first deploy target for this version because it supports Docker web services and persistent disks. Tractor Tracker needs that persistent disk so accounts, sync data, and farm records survive restarts.

1. Put this project in a GitHub repo.
2. In Render, choose **New Blueprint**.
3. Connect the GitHub repo.
4. Render will read `render.yaml`.
5. Confirm the `tractor-tracker` web service.
6. Keep the persistent disk mounted at `/data`.
7. Deploy.
8. Open the `onrender.com` address Render gives you.

The included `render.yaml` sets:

- Docker runtime
- Starter web service
- `/api/health` health check
- `/data` persistent disk
- `TRACTOR_TRACKER_DATA_DIR=/data`

## Database

Tractor Tracker stores accounts and synced farm data in SQLite. Online hosting must use a persistent disk so the database is not erased when the service restarts.

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

If SMTP is not configured, users will be told to contact the support email instead of receiving a reset email.
