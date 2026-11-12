"""
Outgoing email over SMTP, for messages a chapter sends to its own PNMs.

SMTP rather than one vendor's API: every provider speaks it (Resend, Postmark,
SES, Gmail, a campus relay), so switching is a change of environment variables.

    SMTP_HOST      required to turn sending on
    SMTP_PORT      default 587 (STARTTLS); 465 uses TLS from the first byte
    SMTP_USERNAME  optional
    SMTP_PASSWORD  optional
    EMAIL_FROM     required, e.g. "RushRank <rush@yourdomain.org>"

With SMTP_HOST or EMAIL_FROM unset, is_configured() is False and nothing is sent.
"""

from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from typing import Iterable, List, Optional, Tuple

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("EMAIL_FROM"))


def _build(to: str, subject: str, body: str, reply_to: Optional[str], sender_name: Optional[str]) -> EmailMessage:
    from_name, from_addr = parseaddr(os.environ["EMAIL_FROM"])
    msg = EmailMessage()
    msg["From"] = formataddr((sender_name or from_name or "RushRank", from_addr))
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)
    return msg


def _send_all(messages: List[EmailMessage]) -> Tuple[int, List[str]]:
    """Send every message over one connection. Returns (sent, failed addresses)."""
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    context = ssl.create_default_context()

    sent, failed = 0, []
    if port == 465:
        server = smtplib.SMTP_SSL(host, port, timeout=30, context=context)
    else:
        server = smtplib.SMTP(host, port, timeout=30)
    try:
        if port != 465:
            server.starttls(context=context)
        if username:
            server.login(username, password or "")
        for msg in messages:
            try:
                server.send_message(msg)
                sent += 1
            except smtplib.SMTPException as exc:
                logger.warning("Email to one recipient failed: %s", exc)
                failed.append(msg["To"])
    finally:
        try:
            server.quit()
        except smtplib.SMTPException:
            pass
    return sent, failed


async def send_individually(
    recipients: Iterable[str],
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
    sender_name: Optional[str] = None,
) -> Tuple[int, List[str]]:
    """One message per recipient, so nobody sees anybody else's address.

    smtplib blocks, so the work runs on a thread and the event loop stays free
    for everything else (a live vote, for one).
    """
    if not is_configured():
        raise RuntimeError("Email is not configured")
    messages = [_build(to, subject, body, reply_to, sender_name) for to in recipients]
    if not messages:
        return 0, []
    return await asyncio.to_thread(_send_all, messages)
