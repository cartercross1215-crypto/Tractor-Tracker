#!/usr/bin/env python3
"""Runtime password-reset diagnostics for Tractor Tracker.

This wrapper imports the normal server and adds safer, more detailed logging around
forgot-password requests and Resend delivery. It does not log reset tokens,
passwords, API keys, or full authorization secrets.
"""
import json
import os
import secrets
import urllib.error
import urllib.request
from datetime import timedelta
from http import HTTPStatus

import server as app


def mask_email_for_logs(email):
    email = (email or "").strip().lower()
    if "@" not in email:
        return "(invalid-or-missing)"
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        masked_name = name[:1] + "*"
    else:
        masked_name = name[:2] + "*" * min(len(name) - 2, 6)
    return f"{masked_name}@{domain}"


def password_reset_log(stage, message, **details):
    safe_details = {}
    blocked_words = ("token", "password", "secret", "api_key", "apikey", "authorization")
    for key, value in details.items():
        normalized_key = key.lower().replace("-", "_")
        if any(word in normalized_key for word in blocked_words):
            safe_details[key] = "[redacted]"
        else:
            safe_details[key] = value
    payload = {
        "time": app.iso_now(),
        "stage": stage,
        "message": message,
        **safe_details,
    }
    print("PASSWORD_RESET_DIAG " + json.dumps(payload, default=str, sort_keys=True), flush=True)


def resend_from_address():
    configured_from = os.environ.get("RESEND_FROM", "").strip()
    smtp_from = os.environ.get("SMTP_FROM", "").strip()
    return configured_from or smtp_from or f"Tractor Tracker <{app.SUPPORT_EMAIL}>"


def resend_status_payload():
    resend_api_key = os.environ.get("RESEND_API_KEY", "").strip()
    resend_from = resend_from_address()
    return {
        "configured": bool(resend_api_key and resend_from),
        "apiKeySet": bool(resend_api_key),
        "fromSet": bool(resend_from),
        "from": resend_from or None,
        "supportEmail": app.SUPPORT_EMAIL,
        "publicUrlSet": bool(os.environ.get("TRACTOR_TRACKER_PUBLIC_URL", "").strip()),
    }


def email_delivery_configured():
    return bool(resend_status_payload()["configured"] or os.environ.get("SMTP_HOST", "").strip())


def preferred_email_provider():
    if resend_status_payload()["configured"]:
        return "resend"
    if os.environ.get("SMTP_HOST", "").strip():
        return "smtp"
    return None


def patched_send_resend_email(self, to_address, subject, text_body, request_id=None):
    resend_api_key = os.environ.get("RESEND_API_KEY", "").strip()
    resend_from = resend_from_address()
    masked_to = mask_email_for_logs(to_address)

    password_reset_log(
        "resend_config_checked",
        "Checking Resend configuration before sending password reset email.",
        requestId=request_id,
        to=masked_to,
        apiKeySet=bool(resend_api_key),
        fromSet=bool(resend_from),
        resendFrom=resend_from or "(missing)",
        publicUrlSet=bool(os.environ.get("TRACTOR_TRACKER_PUBLIC_URL", "").strip()),
    )

    if not resend_api_key or not resend_from:
        password_reset_log(
            "resend_config_missing",
            "Resend is missing RESEND_API_KEY or RESEND_FROM.",
            requestId=request_id,
            to=masked_to,
            apiKeySet=bool(resend_api_key),
            fromSet=bool(resend_from),
        )
        return False

    html_lines = []
    for line in text_body.splitlines():
        if line.startswith("http"):
            html_lines.append(f'<a href="{line}">{line}</a>')
        else:
            html_lines.append(line)
    html_body = "<br>".join(html_lines)

    payload = json.dumps({
        "from": resend_from,
        "to": [to_address],
        "subject": subject,
        "text": text_body,
        "html": html_body,
        "reply_to": app.SUPPORT_EMAIL,
    }).encode("utf-8")

    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "TractorTracker/1.0 (+https://tractor-tracker-yboz.onrender.com)",
        },
        method="POST",
    )

    try:
        password_reset_log("resend_request_started", "Posting password reset email to Resend.", requestId=request_id, to=masked_to)
        with urllib.request.urlopen(request, timeout=15) as response:
            detail = response.read().decode("utf-8", errors="replace")
            if 200 <= response.status < 300:
                password_reset_log(
                    "resend_request_success",
                    "Resend accepted the password reset email.",
                    requestId=request_id,
                    to=masked_to,
                    status=response.status,
                    detail=detail[:500],
                )
                return True
            password_reset_log(
                "resend_request_failed_status",
                "Resend returned a non-success status.",
                requestId=request_id,
                to=masked_to,
                status=response.status,
                detail=detail[:1000],
            )
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        password_reset_log(
            "resend_http_error",
            "Resend rejected the password reset email request.",
            requestId=request_id,
            to=masked_to,
            status=error.code,
            detail=detail[:1500],
        )
    except Exception as error:
        password_reset_log(
            "resend_unexpected_error",
            "Unexpected error while sending password reset email through Resend.",
            requestId=request_id,
            to=masked_to,
            errorType=type(error).__name__,
            error=str(error)[:1000],
        )

    return False


def patched_send_email(self, to_address, subject, text_body, request_id=None):
    if self.send_resend_email(to_address, subject, text_body, request_id=request_id):
        return True

    if self.send_smtp_email(to_address, subject, text_body):
        password_reset_log("smtp_request_success", "SMTP accepted the password reset email.", requestId=request_id, to=mask_email_for_logs(to_address))
        return True

    if not email_delivery_configured():
        password_reset_log(
            "email_provider_missing",
            "No email provider is configured for password reset.",
            requestId=request_id,
            to=mask_email_for_logs(to_address),
            resendConfigured=resend_status_payload()["configured"],
            smtpConfigured=bool(os.environ.get("SMTP_HOST", "").strip()),
        )
        print(f"Email not sent because no email provider is configured. To: {to_address} Subject: {subject}", flush=True)
        print(text_body, flush=True)

    return False


def patched_handle_forgot_password(self):
    request_id = self.headers.get("Rndr-Id") or secrets.token_hex(6)
    masked_email = "(not-read-yet)"
    try:
        data = self.read_json()
        if data is None:
            password_reset_log("request_invalid_json", "Password reset request had invalid JSON.", requestId=request_id)
            return

        email = (data.get("email") or "").strip().lower()
        masked_email = mask_email_for_logs(email)
        generic_message = "If that email has an account, a reset link will be sent."

        password_reset_log(
            "request_received",
            "Password reset request received.",
            requestId=request_id,
            to=masked_email,
            provider=preferred_email_provider(),
            resendConfigured=resend_status_payload()["configured"],
            publicUrl=self.public_base_url(),
        )

        if "@" not in email:
            password_reset_log("request_invalid_email", "Password reset request had an invalid email format.", requestId=request_id, to=masked_email)
            self.send_json({"message": generic_message, "supportCode": request_id})
            return

        email_sent = False
        user_found = False
        reset_link_host = self.public_base_url()

        with app.connect_db() as db:
            password_reset_log("db_lookup_started", "Looking up account for password reset.", requestId=request_id, to=masked_email)
            user = db.execute("SELECT id, email FROM users WHERE email = ?", (email,)).fetchone()
            if user:
                user_found = True
                password_reset_log("db_user_found", "Account found; creating reset token.", requestId=request_id, to=masked_email)
                db.execute("DELETE FROM password_resets WHERE user_id = ? AND (used_at IS NOT NULL OR expires_at <= ?)", (user["id"], app.iso_now()))
                token = secrets.token_urlsafe(32)
                expires_at = (app.utc_now() + timedelta(minutes=app.RESET_TOKEN_MINUTES)).isoformat()
                db.execute(
                    "INSERT INTO password_resets (token_hash, user_id, expires_at, used_at, created_at) VALUES (?, ?, ?, NULL, ?)",
                    (app.token_hash(token), user["id"], expires_at, app.iso_now()),
                )
                reset_link = f"{reset_link_host}/?reset={token}"
                password_reset_log(
                    "reset_token_saved",
                    "Reset token stored; sending email next.",
                    requestId=request_id,
                    to=masked_email,
                    expiresAt=expires_at,
                    resetHost=reset_link_host,
                    provider=preferred_email_provider(),
                )
                email_sent = self.send_email(
                    user["email"],
                    "Reset your Tractor Tracker password",
                    "\n".join([
                        "Use this link to reset your Tractor Tracker password:",
                        reset_link,
                        "",
                        f"This link expires in {app.RESET_TOKEN_MINUTES} minutes.",
                        f"If you did not ask for this, you can ignore this email or contact {app.SUPPORT_EMAIL}.",
                        "",
                        f"Support code: {request_id}",
                    ]),
                    request_id=request_id,
                )

        if not user_found:
            password_reset_log("db_user_not_found", "No account exists for password reset email. Generic success returned for privacy.", requestId=request_id, to=masked_email)
            self.send_json({"message": generic_message, "emailConfigured": email_delivery_configured(), "supportCode": request_id})
            return

        if email_sent:
            password_reset_log("request_complete_success", "Password reset email sent successfully.", requestId=request_id, to=masked_email)
            self.send_json({"message": generic_message, "emailConfigured": True, "supportCode": request_id})
        elif email_delivery_configured():
            password_reset_log(
                "request_complete_email_failed",
                "Password reset email provider is configured, but email sending failed.",
                requestId=request_id,
                to=masked_email,
                provider=preferred_email_provider(),
                resend=resend_status_payload(),
                smtp=app.smtp_status_payload(),
            )
            self.send_json({
                "message": f"Password reset email could not be sent. Support code: {request_id}. Contact {app.SUPPORT_EMAIL} for help.",
                "emailConfigured": False,
                "supportCode": request_id,
            })
        else:
            password_reset_log("request_complete_no_provider", "Password reset email provider is not configured.", requestId=request_id, to=masked_email)
            self.send_json({
                "message": f"Password reset email is not configured yet. Support code: {request_id}. Contact {app.SUPPORT_EMAIL} for help.",
                "emailConfigured": False,
                "supportCode": request_id,
            })
    except Exception as error:
        password_reset_log(
            "request_unexpected_error",
            "Unexpected server error while handling password reset.",
            requestId=request_id,
            to=masked_email,
            errorType=type(error).__name__,
            error=str(error)[:1500],
        )
        self.send_json({
            "message": f"Password reset failed before email could be sent. Support code: {request_id}. Contact {app.SUPPORT_EMAIL} for help.",
            "emailConfigured": False,
            "supportCode": request_id,
        }, HTTPStatus.INTERNAL_SERVER_ERROR)


app.resend_status_payload = resend_status_payload
app.email_delivery_configured = email_delivery_configured
app.preferred_email_provider = preferred_email_provider
app.TractorTrackerHandler.send_resend_email = patched_send_resend_email
app.TractorTrackerHandler.send_email = patched_send_email
app.TractorTrackerHandler.handle_forgot_password = patched_handle_forgot_password

if __name__ == "__main__":
    app.main()
