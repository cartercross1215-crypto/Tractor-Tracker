# Tractor Tracker

Tractor Tracker is a browser-based MVP for farmers and independent contractors who want simple equipment, job, fuel, and billing records.

## What is included

- One-machine free plan workflow
- Free Unlimited Beta plan label for public testing
- Free Unlimited Beta access: unlimited machines, fields/job sites, operators, cloud backup, syncing, advanced reports, exports, backups, and full export tools
- Local-first automatic sync with Saved locally, Synced, Offline, and conflict-safe status messages
- Startup mode choice for Farm Work or Contracting
- First-use setup flow for farm/business name, units, currency, first equipment, first operator, and first field or job site
- Live dashboard using saved fields/job sites, weekly work totals, active jobs, maintenance, distance, loads, and estimated revenue
- Mode can be changed later in Settings without deleting saved records
- Equipment list foundation with add, edit, and delete controls
- Operator, implement/attachment, field, and job-site setup
- Edit controls for jobs, fields, operators, implements, equipment, and maintenance reminders
- Fieldwork job logging
- Active job timer with Start Job and Finish Job controls
- Optional GPS distance tracking while an active job timer is running
- Manual start and finish times
- Acres, fuel, weather, field conditions, and notes
- Distance tracking for hauling records
- Contractor records for customers/job sites, work hours, loads hauled, material type, billing totals, and cost per hour or mile/kilometer
- Contracting customer records with company, phone, email, billing address, job sites, outstanding balance, and job history
- Miles/kilometers and gallons/liters settings
- Fuel capacity can be recorded in gallons or liters
- Fuel economy reports for MPG, kilometers/liter, and liters/100km
- Cost per mile and cost per kilometer reporting
- Automatic equipment-hour updates
- Machine-specific maintenance reminders by engine hours
- Basic reports and cost-per-acre calculations
- CSV export for job history
- Separate CSV export for completed maintenance history
- JSON farm backup download and restore
- Installable offline app support
- iPhone/iPad home-screen icon support with Apple touch icons
- Account and sync foundation with a local secure database server
- Startup cloud account prompt for existing account login, new account creation, or local-only use
- Login automatically downloads the account's cloud records onto the device
- Forgot password and reset-link foundation with expiring tokens and SMTP email hooks
- Logged-in password change with confirmation and session logout
- Privacy Policy, Terms of Service, and data deletion instructions inside the Account section
- Account controls for data download, cloud-data deletion, account deletion, and logging out all devices
- Clearer sync controls with last-saved time, last-synced time, retry sync, offline/unsynced warnings, and conflict choices
- Contractor invoices with customer/job-site work, hours, equipment, distance, loads, materials, rates, tax, paid/unpaid status, and printable invoice output
- Temporary support and app-update contact email: carterc.issa@gmail.com
- Sample data button for quick testing
- Local browser storage

## Run it

Open `index.html` in a browser for local-only use.

For installable/offline app testing, serve the folder from localhost with Live Server or:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

For accounts and sync, run the included server instead:

```sh
python3 server.py
```

Then open `http://127.0.0.1:8000`. Without `DATABASE_URL`, the server stores accounts and farm data in `tractor_tracker.db` using SQLite, password hashing, and session tokens. With `DATABASE_URL`, it stores account and sync data in Supabase/Postgres.

## Host it online

Tractor Tracker can now run on an online Python or Docker web host so the app works without this Mac running. Use the included `Dockerfile`, `render.yaml`, or start command `python3 server.py`, set `HOST=0.0.0.0`, and add Supabase/Postgres as `DATABASE_URL`. If `DATABASE_URL` is missing, it falls back to SQLite and needs a persistent disk.

See `DEPLOYMENT.md` for the hosting checklist.

## Current limitations

This is still a prototype. It now includes an account/sync server, automatic sync logic, hosted cloud account flow, hosting-ready server settings, Supabase/Postgres database support, Free Unlimited Beta plan access, password reset hooks, clearer sync controls, contractor invoice records, and optional GPS distance tracking, but real payment processing, production email provider configuration, photos, and documents are not added yet. Data is saved in the browser immediately and syncs later when the sync server is available.

## Paid plan direction

The paid version is modeled as the Unlimited plan at about $9.99/month. Real payment checkout, subscription webhooks, and hosted customer billing still need to be connected before public launch.
