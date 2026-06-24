#!/usr/bin/env python3
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


DATA_DIR = Path(os.environ.get("TRACTOR_TRACKER_DATA_DIR", "."))
DB_PATH = Path(os.environ.get("TRACTOR_TRACKER_DB", str(DATA_DIR / "tractor_tracker.db")))
PBKDF2_ITERATIONS = 210_000
SESSION_DAYS = 30


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


def connect_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with connect_db() as db:
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
            """
        )


def empty_farm_data():
    return {
        "equipment": [],
        "fields": [],
        "customers": [],
        "operators": [],
        "implements": [],
        "jobs": [],
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
    def do_GET(self):
        request_path = self.path.split("?", 1)[0]
        if request_path == "/api/health":
            self.send_json({"ok": True, "service": "Tractor Tracker", "time": iso_now()})
            return
        if request_path == "/api/farm":
            self.handle_get_farm()
            return
        super().do_GET()

    def do_POST(self):
        routes = {
            "/api/register": self.handle_register,
            "/api/login": self.handle_login,
            "/api/logout": self.handle_logout,
            "/api/farm": self.handle_save_farm,
            "/api/password/change": self.handle_change_password,
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

    def create_session(self, db, user_id):
        token = secrets.token_urlsafe(32)
        expires_at = (utc_now() + timedelta(days=SESSION_DAYS)).isoformat()
        db.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (token_hash(token), user_id, expires_at, iso_now()),
        )
        return token, expires_at

    def farm_payload(self, db, user_id, email, token=None, expires_at=None):
        farm = db.execute("SELECT id, name, data_json, updated_at FROM farms WHERE user_id = ?", (user_id,)).fetchone()
        payload = {
            "email": email,
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
                user_id = cursor.lastrowid
                db.execute(
                    "INSERT INTO farms (user_id, name, data_json, updated_at) VALUES (?, ?, ?, ?)",
                    (user_id, farm_name, json.dumps(empty_farm_data()), iso_now()),
                )
                token, expires_at = self.create_session(db, user_id)
                payload = self.farm_payload(db, user_id, email, token, expires_at)
        except sqlite3.IntegrityError:
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
    init_db()
    port = int(os.environ.get("PORT") or os.environ.get("TRACTOR_TRACKER_PORT") or "8000")
    host = os.environ.get("HOST") or ("0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
    server = ThreadingHTTPServer((host, port), TractorTrackerHandler)
    print(f"Tractor Tracker server running at http://{host}:{port}")
    print(f"Using database at {DB_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
