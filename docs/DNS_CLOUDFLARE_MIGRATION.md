# DNS migration: Porkbun → Cloudflare (`tractortracker.farm`)

Goal: move DNS hosting to Cloudflare, then connect the domain to the Render app and verify the
domain in Resend so password-reset email actually authenticates.

Registrar stays **Porkbun**. Only the *nameservers* move. Nothing is transferred or re-purchased.

---

## Why we're doing this

As of 2026-08-07 `tractortracker.farm` is pure Porkbun parking and is **not connected to the app
at all**:

| Record | Current value | Meaning |
|---|---|---|
| `@` A | `207.207.210.229`, `207.207.210.107` | Porkbun parking page |
| `*` CNAME | `pixie.porkbun.com` | Wildcard parking — **catches everything** |
| `www` CNAME | `pixie.porkbun.com` | Parking |
| `@` MX | `fwd1.porkbun.com` (10), `fwd2.porkbun.com` (20) | Porkbun email forwarding |
| `@` TXT | `v=spf1 include:_spf.porkbun.com ~all` | Porkbun SPF only |
| NS | `curitiba/maceio/fortaleza/salvador.ns.porkbun.com` | Porkbun DNS |

Two consequences:

1. **Customers can't reach the app by name.** The app only answers at
   `tractor-tracker-yboz.onrender.com`.
2. **Resend email is unauthenticated.** `RESEND_FROM` is set to
   `support@tractortracker.farm`, but there is no Resend DKIM, no Resend SPF include, and no
   DMARC. Password-reset mail will be spam-foldered or rejected. **This is the root cause of the
   password-reset problem — it is a DNS problem, not a `server.py` problem.**

> ### ⚠️ The wildcard lies to you
> That `*` CNAME answers for **every** name you look up. `dig _dmarc.tractortracker.farm` and
> `dig resend._domainkey.tractortracker.farm` both return `pixie.porkbun.com` — which looks like
> a record exists when nothing does. Never conclude "the record is there" from a non-empty
> answer while the wildcard is live. **Do not recreate the `*` record in Cloudflare.**

---

## Phase 1 — Add the zone to Cloudflare

1. Cloudflare dashboard → **Add a site** → `tractortracker.farm` → Free plan.
2. Cloudflare scans existing records. **Review what it imports and delete the parking junk:**
   - ❌ delete the two `@` A records (`207.207.210.*`)
   - ❌ delete the `*` wildcard CNAME
   - ❌ delete the `www` CNAME to `pixie.porkbun.com`
   - ✅ **keep** both `@` MX records (`fwd1`/`fwd2.porkbun.com`) — these are Porkbun email
     forwarding and are what makes `support@tractortracker.farm` receive mail
   - ✅ keep the `@` SPF TXT for now; it gets replaced in Phase 4
3. Cloudflare assigns **two nameservers** (e.g. `xxx.ns.cloudflare.com`). Copy them.
4. **Delete any `AAAA` records.** Render does not support IPv6 and they break the site.

## Phase 2 — Flip nameservers at Porkbun

Porkbun → Domain Management → `tractortracker.farm` → **NS / Nameservers** → replace all four
Porkbun nameservers with the two Cloudflare ones → save.

Propagation is typically minutes to a few hours. Verify:

```bash
dig +short tractortracker.farm NS
```

Wait until that returns the Cloudflare nameservers before continuing. Cloudflare will also email
when the zone goes **Active**.

Sanity check that the wildcard is gone:

```bash
dig +short zzz-nonexistent.tractortracker.farm
```

Empty output = correct. Any answer means the wildcard survived the import.

## Phase 3 — Connect the domain to Render

Render service: `Tractor-Tracker` (`srv-d8tioptckfvc73el9ue0`).

1. Render dashboard → the service → **Settings → Custom Domains** → add both
   `tractortracker.farm` and `www.tractortracker.farm`.
2. In Cloudflare DNS, create **two CNAME records**, both pointing at
   `tractor-tracker-yboz.onrender.com`:

   | Type | Name | Target | Proxy |
   |---|---|---|---|
   | CNAME | `@` | `tractor-tracker-yboz.onrender.com` | **DNS only** (grey cloud) |
   | CNAME | `www` | `tractor-tracker-yboz.onrender.com` | **DNS only** (grey cloud) |

   (A CNAME at the apex works because Cloudflare flattens it automatically.)
3. Cloudflare → **SSL/TLS → Overview → set encryption mode to `Full`.**
4. **Leave proxy as DNS only until Render shows the certificate as issued and valid.** Requests
   must reach Render directly so it can verify the domain and issue the cert. Turning the orange
   cloud on too early is the classic way to get stuck in a redirect loop with no certificate.
5. Once Render confirms the cert, you may optionally flip both records to **Proxied**.

## Phase 4 — Verify the domain in Resend (fixes password reset)

1. Resend dashboard → **Domains → Add Domain** → `tractortracker.farm`.
2. Resend generates three records. Add them in Cloudflare exactly as given — and note that
   Resend shows fully-qualified names, but **Cloudflare wants only the subdomain part**
   (`send`, not `send.tractortracker.farm`):

   | Type | Name | Value | Proxy |
   |---|---|---|---|
   | MX | `send` | Resend's SES host, priority `10` | DNS only |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` | DNS only |
   | TXT | `resend._domainkey` | the DKIM key Resend shows | **DNS only — required** |

   These live on the `send` subdomain, so they do **not** collide with the apex MX records that
   power Porkbun email forwarding. Both keep working.
3. Click **Verify** in Resend and wait for green.
4. Add DMARC once DKIM/SPF pass:

   | Type | Name | Value |
   |---|---|---|
   | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:tractortracker.support@gmail.com` |

   Start at `p=none` (monitor only). Tighten to `quarantine` then `reject` after a couple of
   weeks of clean reports. Going straight to `reject` will silently drop real mail.

## Phase 5 — Verify end to end

```bash
# Nameservers moved
dig +short tractortracker.farm NS

# Wildcard is gone (must be EMPTY)
dig +short zzz-nonexistent.tractortracker.farm

# App answers on the real domain
curl -sS https://tractortracker.farm/api/health

# Email auth is real now (must be non-empty, and NOT pixie.porkbun.com)
dig +short resend._domainkey.tractortracker.farm TXT
dig +short send.tractortracker.farm TXT
dig +short _dmarc.tractortracker.farm TXT
```

Then the real test: trigger a password reset from the live app to a Gmail address and confirm it
lands in the inbox, not spam. In Gmail use **Show original** and check `SPF: PASS`,
`DKIM: PASS`, `DMARC: PASS`.

Finally, update Render env vars if needed:

- `TRACTOR_TRACKER_PUBLIC_URL=https://tractortracker.farm` (currently the `.onrender.com` URL —
  reset links are built from this, so stale value = links pointing at the old host)
- `RESEND_FROM=Tractor Tracker <support@tractortracker.farm>` (already set)

---

## Gotchas

- **Porkbun email forwarding must keep working.** It depends on the apex MX records pointing at
  `fwd1`/`fwd2.porkbun.com`. Carry them into Cloudflare verbatim, and after cutover send a test
  mail to `support@tractortracker.farm` to confirm forwarding survived.
- **Render is on the free plan with no disk** (`render.yaml` claims `starter` + a 1GB disk — it
  lies). Free services sleep when idle, so the first request after a quiet spell takes ~50s. Move
  to Starter before pointing a customer-facing domain at it.
- **Don't proxy the DKIM record.** Cloudflare's orange cloud on a TXT record isn't possible, but
  it is on anything Resend asks you to CNAME — keep all Resend records DNS only.
- **Two devs push to `main`.** See rule #0 in `CLAUDE.md`; `git fetch` before editing.
