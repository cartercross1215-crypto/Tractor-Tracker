#!/usr/bin/env python3
import base64
import hashlib
import hmac
import json
import os
import secrets
import smtplib
import sqlite3
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None


APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("TRACTOR_TRACKER_DATA_DIR", "."))
DB_PATH = Path(os.environ.get("TRACTOR_TRACKER_DB", str(DATA_DIR / "tractor_tracker.db")))
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
USE_POSTGRES = bool(DATABASE_URL)
INTEGRITY_ERRORS = (sqlite3.IntegrityError,) + ((psycopg.IntegrityError,) if psycopg else ())
PBKDF2_ITERATIONS = 210_000
SESSION_DAYS = 30
RESET_TOKEN_MINUTES = 45
SUPPORT_EMAIL = os.environ.get("TRACTOR_TRACKER_SUPPORT_EMAIL", "tractortracker.support@gmail.com")
DEFAULT_ADMIN_EMAILS = {SUPPORT_EMAIL.lower(), "tractortracker.support@gmail.com"}


def utc_now():
    return datetime.now(timezone.utc)


def iso_now():
    return utc_now().isoformat()


def hash_password(password, salt=None):
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return base64.b64encode(salt).decode("ascii"), base64.b64encode(digest).decode("ascii")


def verify_password(password, salt_b64, digest_b64):
    salt = base64.b64decode(salt_b64)
    _, candidate = hash_password(password, salt)
    return hmac.compare_digest(candidate, digest_b64)


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def postgres_connect_url():
    if not DATABASE_URL:
        return ""
    userinfo = DATABASE_URL.split("//", 1)[-1].split("@", 1)[0]
    password = userinfo.split(":", 1)[1] if ":" in userinfo else ""
    if "[" in password or "]" in password:
        raise RuntimeError("DATABASE_URL password has square brackets. Remove [ and ] from the password in Render.")
    parsed = urlsplit(DATABASE_URL)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.setdefault("sslmode", "require")
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))


def database_url_summary():
    if not DATABASE_URL:
        return f"SQLite fallback at {DB_PATH}"
    try:
        raw_userinfo = DATABASE_URL.split("//", 1)[-1].split("@", 1)[0]
        raw_username, _, raw_password = raw_userinfo.partition(":")
        if "[" in raw_password or "]" in raw_password:
            return (
                "Supabase/Postgres DATABASE_URL "
                f"user={raw_username or '(missing)'} host=(unreadable) port=(unreadable) "
                f"password_set={'yes' if bool(raw_password) else 'no'} "
                "password_has_brackets=yes placeholder_present=no"
            )
        parsed = urlsplit(DATABASE_URL)
        userinfo, _, hostinfo = parsed.netloc.rpartition("@")
        username, _, password = userinfo.partition(":")
        host = hostinfo.split(":", 1)[0] or "(missing)"
        port = hostinfo.split(":", 1)[1] if ":" in hostinfo else "(missing)"
        has_brackets = "[" in password or "]" in password
        has_placeholder = "YOUR-PASSWORD" in DATABASE_URL
        return (
            "Supabase/Postgres DATABASE_URL "
            f"user={username or '(missing)'} host={host} port={port} "
            f"password_set={'yes' if bool(password) else 'no'} "
            f"password_has_brackets={'yes' if has_brackets else 'no'} "
            f"placeholder_present={'yes' if has_placeholder else 'no'}"
        )
    except ValueError as error:
        return f"DATABASE_URL format problem: {error}"


def smtp_summary():
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_from = os.environ.get("SMTP_FROM", "").strip() or SUPPORT_EMAIL
    smtp_port = os.environ.get("SMTP_PORT", "587").strip()
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() != "false"
    smtp_password = normalized_smtp_password()
    password_value = os.environ.get("SMTP_PASSWORD", "")
    password_multiline = "\n" in password_value or "SMTP_" in password_value
    return (
        "Password reset email "
        f"configured={'yes' if bool(smtp_host) else 'no'} "
        f"host={smtp_host or '(missing)'} "
        f"port={smtp_port or '(missing)'} "
        f"user_set={'yes' if bool(smtp_user) else 'no'} "
        f"password_set={'yes' if bool(smtp_password) else 'no'} "
        f"password_length={len(smtp_password)} "
        f"password_value_problem={'yes' if password_multiline else 'no'} "
        f"from={smtp_from} "
        f"tls={'yes' if use_tls else 'no'}"
    )


def smtp_status_payload():
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_from = os.environ.get("SMTP_FROM", "").strip() or SUPPORT_EMAIL
    smtp_port = os.environ.get("SMTP_PORT", "587").strip()
    smtp_password = normalized_smtp_password()
    password_value = os.environ.get("SMTP_PASSWORD", "")
    return {
        "configured": bool(smtp_host),
        "host": smtp_host or None,
        "port": smtp_port or None,
        "userSet": bool(smtp_user),
        "from": smtp_from,
        "passwordSet": bool(smtp_password),
        "passwordLength": len(smtp_password),
        "passwordValueProblem": "\n" in password_value or "SMTP_" in password_value,
        "tls": os.environ.get("SMTP_USE_TLS", "true").lower() != "false",
        "publicUrlSet": bool(os.environ.get("TRACTOR_TRACKER_PUBLIC_URL", "").strip()),
    }


def resend_status_payload():
    resend_api_key = os.environ.get("RESEND_API_KEY", "").strip()
    resend_from = os.environ.get("RESEND_FROM", "").strip()
    return {
        "configured": bool(resend_api_key and resend_from),
        "apiKeySet": bool(resend_api_key),
        "fromSet": bool(resend_from),
        "from": resend_from or None,
        "publicUrlSet": bool(os.environ.get("TRACTOR_TRACKER_PUBLIC_URL", "").strip()),
    }


def resend_summary():
    status = resend_status_payload()
    return (
        "Password reset Resend "
        f"configured={'yes' if status['configured'] else 'no'} "
        f"api_key_set={'yes' if status['apiKeySet'] else 'no'} "
        f"from_set={'yes' if status['fromSet'] else 'no'} "
        f"from={status['from'] or '(missing)'}"
    )


def email_delivery_configured():
    return bool(resend_status_payload()["configured"] or os.environ.get("SMTP_HOST", "").strip())


def preferred_email_provider():
    if resend_status_payload()["configured"]:
        return "resend"
    if os.environ.get("SMTP_HOST", "").strip():
        return "smtp"
    return None


def admin_email_set():
    configured = os.environ.get("ADMIN_EMAILS", "")
    values = {email.strip().lower() for email in configured.split(",") if email.strip()}
    return values | DEFAULT_ADMIN_EMAILS


def is_admin_email(email):
    return (email or "").strip().lower() in admin_email_set()


def static_status_payload():
    files = [
        "index.html",
        "app.js",
        "styles.css",
        "manifest.webmanifest",
        "sw.js",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/apple-touch-icon.png",
    ]
    return {filename: (APP_DIR / filename).exists() for filename in files}


def static_status_summary():
    status = static_status_payload()
    missing = [filename for filename, exists in status.items() if not exists]
    if not missing:
        return f"Static files ok in {APP_DIR}"
    return f"Static files missing in {APP_DIR}: {', '.join(missing)}"


def normalized_smtp_password():
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    smtp_host = os.environ.get("SMTP_HOST", "").lower()
    if "gmail.com" in smtp_host:
        password = password.replace(" ", "")
    return password


class Database:
    def __init__(self):
        self.connection = None

    def __enter__(self):
        if USE_POSTGRES:
            if psycopg is None:
                raise RuntimeError("DATABASE_URL is set, but psycopg is not installed.")
            self.connection = psycopg.connect(postgres_connect_url(), row_factory=dict_row)
        else:
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            self.connection = sqlite3.connect(DB_PATH)
            self.connection.row_factory = sqlite3.Row
            self.connection.execute("PRAGMA foreign_keys = ON")
        return self

    def __exit__(self, exc_type, exc, traceback):
        try:
            if exc_type:
                self.connection.rollback()
            else:
                self.connection.commit()
        finally:
            self.connection.close()

    def execute(self, sql, params=()):
        if USE_POSTGRES:
            sql = sql.replace("?", "%s")
        return self.connection.execute(sql, params)

    def executescript(self, script):
        return self.connection.executescript(script)


def connect_db():
    return Database()


def init_sqlite_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as db:
        db.execute("PRAGMA foreign_keys = ON")
        db.executescript(
            """
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT NOT NULL UNIQUE,
              password_salt TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS farms (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL UNIQUE,
              name TEXT NOT NULL,
              data_json TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS sessions (
              token_hash TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS password_resets (
              token_hash TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              expires_at TEXT NOT NULL,
              used_at TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS support_audit (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              admin_email TEXT NOT NULL,
              target_email TEXT NOT NULL,
              action TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            """
        )


def init_postgres_db():
    with connect_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              email TEXT NOT NULL UNIQUE,
              password_salt TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS farms (
              id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              data_json TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
              token_hash TEXT PRIMARY KEY,
              user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS password_resets (
              token_hash TEXT PRIMARY KEY,
              user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              expires_at TEXT NOT NULL,
              used_at TEXT,
              created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS support_audit (
              id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              admin_email TEXT NOT NULL,
              target_email TEXT NOT NULL,
              action TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )


def init_db():
    if USE_POSTGRES:
        init_postgres_db()
    else:
        init_sqlite_db()


def empty_farm_data():
    return {
        "equipment": [],
        "fields": [],
        "customers": [],
        "operators": [],
        "implements": [],
        "jobs": [],
        "invoices": [],
        "activeJob": None,
        "maintenance": [],
        "maintenanceHistory": [],
        "settings": {
            "appMode": None,
            "accountPromptComplete": False,
            "setupComplete": False,
            "businessName": "",
            "subscriptionPlan": "free",
            "measurementSystem": "us",
            "currency": "USD",
        },
    }


class TractorTrackerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def do_GET(self):
        request_path = self.path.split("?", 1)[0]
        if request_path == "/api/health":
            self.send_json({
                "ok": True,
                "service": "Tractor Tracker",
                "time": iso_now(),
                "database": "postgres" if USE_POSTGRES else "sqlite",
                "email": {
                    "configured": email_delivery_configured(),
                    "preferredProvider": preferred_email_provider(),
                    "publicUrlSet": bool(os.environ.get("TRACTOR_TRACKER_PUBLIC_URL", "").strip()),
                },
                "resend": resend_status_payload(),
                "smtp": smtp_status_payload(),
                "staticFiles": static_status_payload(),
            })
            return
        if request_path == "/api/farm":
            self.handle_get_farm()
            return
        if request_path == "/api/admin/accounts":
            self.handle_admin_accounts()
            return
        super().do_GET()

    def do_POST(self):
        routes = {
            "/api/register": self.handle_register,
            "/api/login": self.handle_login,
            "/api/logout": self.handle_logout,
            "/api/farm": self.handle_save_farm,
            "/api/password/forgot": self.handle_forgot_password,
            "/api/password/reset": self.handle_reset_password,
            "/api/password/change": self.handle_change_password,
            "/api/logout-all": self.handle_logout_all,
            "/api/farm/delete-cloud": self.handle_delete_cloud_data,
            "/api/account/delete": self.handle_delete_account,
            "/api/admin/account": self.handle_admin_get_account,
            "/api/admin/account/save": self.handle_admin_save_account,
        }
        handler = routes.get(self.path)
        if handler:
            handler()
            return
        self.send_json({"message": "Not found"}, HTTPStatus.NOT_FOUND)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self.send_json({"message": "Invalid JSON"}, HTTPStatus.BAD_REQUEST)
            return None

    def send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authenticated_user(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            self.send_json({"message": "Log in first."}, HTTPStatus.UNAUTHORIZED)
            return None
        hashed = token_hash(auth.removeprefix("Bearer ").strip())
        with connect_db() as db:
            row = db.execute(
                """
                SELECT users.id, users.email
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?
                """,
                (hashed, iso_now()),
            ).fetchone()
        if not row:
            self.send_json({"message": "Session expired. Log in again."}, HTTPStatus.UNAUTHORIZED)
            return None
        return row

    def authenticated_admin(self):
        user = self.authenticated_user()
        if not user:
            return None
        if not is_admin_email(user["email"]):
            self.send_json({"message": "Support access is not enabled for this account."}, HTTPStatus.FORBIDDEN)
            return None
        return user

    def record_support_audit(self, db, admin_email, target_email, action):
        db.execute(
            "INSERT INTO support_audit (admin_email, target_email, action, created_at) VALUES (?, ?, ?, ?)",
            (admin_email, target_email, action, iso_now()),
        )

    def create_session(self, db, user_id):
        token = secrets.token_urlsafe(32)
        expires_at = (utc_now() + timedelta(days=SESSION_DAYS)).isoformat()
        db.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (token_hash(token), user_id, expires_at, iso_now()),
        )
        return token, expires_at

    def public_base_url(self):
        configured_url = os.environ.get("TRACTOR_TRACKER_PUBLIC_URL", "").strip().rstrip("/")
        if configured_url:
            return configured_url
        scheme = self.headers.get("X-Forwarded-Proto", "https" if os.environ.get("PORT") else "http")
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "127.0.0.1:8000"
        return f"{scheme}://{host}".rstrip("/")

    def send_resend_email(self, to_address, subject, text_body):
        resend_api_key = os.environ.get("RESEND_API_KEY", "").strip()
        resend_from = os.environ.get("RESEND_FROM", "").strip()

        if not resend_api_key or not resend_from:
            return False

        payload = json.dumps({
            "from": resend_from,
            "to": [to_address],
            "subject": subject,
            "text": text_body,
        }).encode("utf-8")
        request = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                if 200 <= response.status < 300:
                    return True
                detail = response.read().decode("utf-8", errors="replace")
                print(f"Resend email failed for {to_address}: HTTP {response.status} {detail}", flush=True)
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            print(f"Resend email failed for {to_address}: HTTP {error.code} {detail}", flush=True)
        except Exception as error:
            print(f"Resend email failed for {to_address}: {error}", flush=True)

        return False

    def send_smtp_email(self, to_address, subject, text_body):
        smtp_host = os.environ.get("SMTP_HOST", "").strip()
        smtp_from = os.environ.get("SMTP_FROM", "").strip() or SUPPORT_EMAIL

        if not smtp_host:
            return False

        message = EmailMessage()
        message["From"] = smtp_from
        message["To"] = to_address
        message["Subject"] = subject
        message.set_content(text_body)

        smtp_port = int(os.environ.get("SMTP_PORT", "587").strip())
        smtp_user = os.environ.get("SMTP_USER", "").strip()
        smtp_password = normalized_smtp_password()
        use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() != "false"

        try:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as smtp:
                if use_tls:
                    smtp.starttls()
                if smtp_user and smtp_password:
                    smtp.login(smtp_user, smtp_password)
                smtp.send_message(message)
        except Exception as error:
            print(f"SMTP password reset email failed for {to_address}: {error}", flush=True)
            return False

        return True

    def send_email(self, to_address, subject, text_body):
        if self.send_resend_email(to_address, subject, text_body):
            return True

        if self.send_smtp_email(to_address, subject, text_body):
            return True

        if not email_delivery_configured():
            print(f"Email not sent because no email provider is configured. To: {to_address} Subject: {subject}", flush=True)
            print(text_body, flush=True)

        return False

    def farm_payload(self, db, user_id, email, token=None, expires_at=None):
        farm = db.execute("SELECT id, name, data_json, updated_at FROM farms WHERE user_id = ?", (user_id,)).fetchone()
        payload = {
            "email": email,
            "isAdmin": is_admin_email(email),
            "farm": {
                "id": farm["id"],
                "name": farm["name"],
                "data": json.loads(farm["data_json"]),
                "updatedAt": farm["updated_at"],
            },
        }
        if token:
            payload["token"] = token
            payload["expiresAt"] = expires_at
        return payload

    def verify_current_password_payload(self, db, user_id, password):
        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return bool(row and verify_password(password or "", row["password_salt"], row["password_hash"]))

    def handle_register(self):
        data = self.read_json()
        if data is None:
            return
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        farm_name = (data.get("farmName") or "Home Farm").strip()
        if "@" not in email or len(password) < 8 or not farm_name:
            self.send_json({"message": "Enter a farm name, valid email, and password with at least 8 characters."}, HTTPStatus.BAD_REQUEST)
            return
        salt, digest = hash_password(password)
        try:
            with connect_db() as db:
                cursor = db.execute(
                    "INSERT INTO users (email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?)",
                    (email, salt, digest, iso_now()),
                )
                user_id = cursor.lastrowid if not USE_POSTGRES else db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()["id"]
                db.execute(
                    "INSERT INTO farms (user_id, name, data_json, updated_at) VALUES (?, ?, ?, ?)",
                    (user_id, farm_name, json.dumps(empty_farm_data()), iso_now()),
                )
                token, expires_at = self.create_session(db, user_id)
                payload = self.farm_payload(db, user_id, email, token, expires_at)
        except INTEGRITY_ERRORS:
            self.send_json({"message": "That email already has an account."}, HTTPStatus.CONFLICT)
            return
        self.send_json(payload, HTTPStatus.CREATED)

    def handle_login(self):
        data = self.read_json()
        if data is None:
            return
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        with connect_db() as db:
            user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            if not user or not verify_password(password, user["password_salt"], user["password_hash"]):
                self.send_json({"message": "Email or password is incorrect."}, HTTPStatus.UNAUTHORIZED)
                return
            token, expires_at = self.create_session(db, user["id"])
            payload = self.farm_payload(db, user["id"], user["email"], token, expires_at)
        self.send_json(payload)

    def handle_logout(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            with connect_db() as db:
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(auth.removeprefix("Bearer ").strip()),))
        self.send_json({"ok": True})

    def handle_logout_all(self):
        user = self.authenticated_user()
        if not user:
            return
        with connect_db() as db:
            db.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
        self.send_json({"message": "Logged out of all devices."})

    def handle_forgot_password(self):
        data = self.read_json()
        if data is None:
            return
        email = (data.get("email") or "").strip().lower()
        generic_message = "If that email has an account, a reset link will be sent."
        if "@" not in email:
            self.send_json({"message": generic_message})
            return

        email_sent = False
        user_found = False
        with connect_db() as db:
            user = db.execute("SELECT id, email FROM users WHERE email = ?", (email,)).fetchone()
            if user:
                user_found = True
                db.execute("DELETE FROM password_resets WHERE user_id = ? AND (used_at IS NOT NULL OR expires_at <= ?)", (user["id"], iso_now()))
                token = secrets.token_urlsafe(32)
                expires_at = (utc_now() + timedelta(minutes=RESET_TOKEN_MINUTES)).isoformat()
                db.execute(
                    "INSERT INTO password_resets (token_hash, user_id, expires_at, used_at, created_at) VALUES (?, ?, ?, NULL, ?)",
                    (token_hash(token), user["id"], expires_at, iso_now()),
                )
                reset_link = f"{self.public_base_url()}/?reset={token}"
                email_sent = self.send_email(
                    user["email"],
                    "Reset your Tractor Tracker password",
                    "\n".join([
                        "Use this link to reset your Tractor Tracker password:",
                        reset_link,
                        "",
                        f"This link expires in {RESET_TOKEN_MINUTES} minutes.",
                        f"If you did not ask for this, you can ignore this email or contact {SUPPORT_EMAIL}.",
                    ]),
                )

        if not user_found:
            print(f"Password reset requested for unknown account: {email}", flush=True)
            self.send_json({"message": generic_message, "emailConfigured": email_delivery_configured()})
            return

        if email_sent:
            self.send_json({"message": generic_message, "emailConfigured": True})
        elif email_delivery_configured():
            self.send_json({
                "message": f"Password reset email could not be sent. Contact {SUPPORT_EMAIL} for help.",
                "emailConfigured": False,
            })
        else:
            self.send_json({
                "message": f"Password reset email is not configured yet. Contact {SUPPORT_EMAIL} for help.",
                "emailConfigured": False,
            })

    def handle_reset_password(self):
        data = self.read_json()
        if data is None:
            return
        token = (data.get("token") or "").strip()
        new_password = data.get("newPassword") or ""
        if not token or len(new_password) < 8:
            self.send_json({"message": "Enter a valid reset link and a password with at least 8 characters."}, HTTPStatus.BAD_REQUEST)
            return

        hashed_token = token_hash(token)
        with connect_db() as db:
            reset = db.execute(
                """
                SELECT token_hash, user_id
                FROM password_resets
                WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
                """,
                (hashed_token, iso_now()),
            ).fetchone()
            if not reset:
                self.send_json({"message": "That reset link is expired or invalid."}, HTTPStatus.BAD_REQUEST)
                return

            salt, digest = hash_password(new_password)
            db.execute("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?", (salt, digest, reset["user_id"]))
            db.execute("UPDATE password_resets SET used_at = ? WHERE token_hash = ?", (iso_now(), hashed_token))
            db.execute("DELETE FROM sessions WHERE user_id = ?", (reset["user_id"],))

        self.send_json({"message": "Password changed. Log in with your new password."})

    def handle_get_farm(self):
        user = self.authenticated_user()
        if not user:
            return
        with connect_db() as db:
            self.send_json(self.farm_payload(db, user["id"], user["email"]))

    def handle_save_farm(self):
        user = self.authenticated_user()
        if not user:
            return
        data = self.read_json()
        if data is None:
            return
        farm_name = (data.get("farmName") or "Home Farm").strip()
        farm_data = data.get("data")
        base_updated_at = data.get("baseUpdatedAt")
        if not farm_name or not isinstance(farm_data, dict):
            self.send_json({"message": "Farm sync data is missing."}, HTTPStatus.BAD_REQUEST)
            return
        with connect_db() as db:
            current_farm = db.execute("SELECT id, name, data_json, updated_at FROM farms WHERE user_id = ?", (user["id"],)).fetchone()
            if base_updated_at and current_farm and current_farm["updated_at"] != base_updated_at:
                self.send_json(
                    {
                        "message": "Cloud copy is newer. Download it before uploading this device.",
                        "conflict": True,
                        "farm": {
                            "id": current_farm["id"],
                            "name": current_farm["name"],
                            "data": json.loads(current_farm["data_json"]),
                            "updatedAt": current_farm["updated_at"],
                        },
                    },
                    HTTPStatus.CONFLICT,
                )
                return
            updated_at = iso_now()
            db.execute(
                "UPDATE farms SET name = ?, data_json = ?, updated_at = ? WHERE user_id = ?",
                (farm_name, json.dumps(farm_data), updated_at, user["id"]),
            )
            self.send_json(self.farm_payload(db, user["id"], user["email"]))

    def handle_admin_accounts(self):
        admin = self.authenticated_admin()
        if not admin:
            return
        query = dict(parse_qsl(urlsplit(self.path).query)).get("q", "").strip().lower()
        with connect_db() as db:
            params = ()
            where_clause = ""
            if query:
                like_query = f"%{query}%"
                where_clause = "WHERE lower(users.email) LIKE ? OR lower(farms.name) LIKE ?"
                params = (like_query, like_query)
            rows = db.execute(
                f"""
                SELECT users.email, users.created_at, farms.name, farms.updated_at
                FROM users
                JOIN farms ON farms.user_id = users.id
                {where_clause}
                ORDER BY farms.updated_at DESC
                LIMIT 100
                """,
                params,
            ).fetchall()
        self.send_json({
            "accounts": [
                {
                    "email": row["email"],
                    "farmName": row["name"],
                    "createdAt": row["created_at"],
                    "updatedAt": row["updated_at"],
                }
                for row in rows
            ]
        })

    def handle_admin_get_account(self):
        admin = self.authenticated_admin()
        if not admin:
            return
        data = self.read_json()
        if data is None:
            return
        target_email = (data.get("email") or "").strip().lower()
        if "@" not in target_email:
            self.send_json({"message": "Enter the account email to review."}, HTTPStatus.BAD_REQUEST)
            return
        with connect_db() as db:
            target = db.execute("SELECT id, email FROM users WHERE email = ?", (target_email,)).fetchone()
            if not target:
                self.send_json({"message": "No account found for that email."}, HTTPStatus.NOT_FOUND)
                return
            self.record_support_audit(db, admin["email"], target["email"], "view_account")
            self.send_json(self.farm_payload(db, target["id"], target["email"]))

    def handle_admin_save_account(self):
        admin = self.authenticated_admin()
        if not admin:
            return
        data = self.read_json()
        if data is None:
            return
        target_email = (data.get("email") or "").strip().lower()
        confirm_email = (data.get("confirmEmail") or "").strip().lower()
        farm_name = (data.get("farmName") or "Home Farm").strip()
        farm_data = data.get("data")
        password = data.get("password") or ""
        if not target_email or target_email != confirm_email:
            self.send_json({"message": "Confirm the exact account email before replacing cloud data."}, HTTPStatus.BAD_REQUEST)
            return
        if not farm_name or not isinstance(farm_data, dict):
            self.send_json({"message": "Support replacement data is missing."}, HTTPStatus.BAD_REQUEST)
            return
        with connect_db() as db:
            if not self.verify_current_password_payload(db, admin["id"], password):
                self.send_json({"message": "Support password is incorrect."}, HTTPStatus.UNAUTHORIZED)
                return
            target = db.execute("SELECT id, email FROM users WHERE email = ?", (target_email,)).fetchone()
            if not target:
                self.send_json({"message": "No account found for that email."}, HTTPStatus.NOT_FOUND)
                return
            updated_at = iso_now()
            db.execute(
                "UPDATE farms SET name = ?, data_json = ?, updated_at = ? WHERE user_id = ?",
                (farm_name, json.dumps(farm_data), updated_at, target["id"]),
            )
            self.record_support_audit(db, admin["email"], target["email"], "replace_cloud_data")
            self.send_json(self.farm_payload(db, target["id"], target["email"]))

    def handle_delete_cloud_data(self):
        user = self.authenticated_user()
        if not user:
            return
        data = self.read_json()
        if data is None:
            return
        password = data.get("password") or ""
        with connect_db() as db:
            if not self.verify_current_password_payload(db, user["id"], password):
                self.send_json({"message": "Password is incorrect."}, HTTPStatus.UNAUTHORIZED)
                return
            cleared_data = empty_farm_data()
            cleared_data["settings"]["accountPromptComplete"] = True
            updated_at = iso_now()
            db.execute(
                "UPDATE farms SET name = ?, data_json = ?, updated_at = ? WHERE user_id = ?",
                ("Cleared Account", json.dumps(cleared_data), updated_at, user["id"]),
            )
            self.send_json(self.farm_payload(db, user["id"], user["email"]))

    def handle_delete_account(self):
        user = self.authenticated_user()
        if not user:
            return
        data = self.read_json()
        if data is None:
            return
        password = data.get("password") or ""
        with connect_db() as db:
            if not self.verify_current_password_payload(db, user["id"], password):
                self.send_json({"message": "Password is incorrect."}, HTTPStatus.UNAUTHORIZED)
                return
            db.execute("DELETE FROM password_resets WHERE user_id = ?", (user["id"],))
            db.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
            db.execute("DELETE FROM farms WHERE user_id = ?", (user["id"],))
            db.execute("DELETE FROM users WHERE id = ?", (user["id"],))
        self.send_json({"message": "Account and cloud data deleted."})

    def handle_change_password(self):
        user = self.authenticated_user()
        if not user:
            return
        data = self.read_json()
        if data is None:
            return
        current_password = data.get("currentPassword") or ""
        new_password = data.get("newPassword") or ""
        if len(new_password) < 8:
            self.send_json({"message": "New password must be at least 8 characters."}, HTTPStatus.BAD_REQUEST)
            return
        with connect_db() as db:
            row = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            if not verify_password(current_password, row["password_salt"], row["password_hash"]):
                self.send_json({"message": "Current password is incorrect."}, HTTPStatus.UNAUTHORIZED)
                return
            salt, digest = hash_password(new_password)
            db.execute("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?", (salt, digest, user["id"]))
            db.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
        self.send_json({"message": "Password changed. Log in again."})


def main():
    print(database_url_summary())
    print(resend_summary())
    print(smtp_summary())
    print(static_status_summary(), flush=True)
    init_db()
    port = int(os.environ.get("PORT") or os.environ.get("TRACTOR_TRACKER_PORT") or "8000")
    host = os.environ.get("HOST") or ("0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
    server = ThreadingHTTPServer((host, port), TractorTrackerHandler)
    print(f"Tractor Tracker server running at http://{host}:{port}")
    print("Using Supabase/Postgres database from DATABASE_URL" if USE_POSTGRES else f"Using database at {DB_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
