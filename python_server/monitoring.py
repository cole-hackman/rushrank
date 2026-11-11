"""
Error reporting to Sentry.

Off unless SENTRY_DSN is set, so local runs, tests and the e2e stack send
nothing. When it is set, unhandled exceptions are reported with the request
that caused them. Personal data is not attached: the app holds PNM contact
details and member emails, and none of that needs to leave the server to
diagnose a crash.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_enabled = False


def init_monitoring() -> bool:
    """Start Sentry if configured. Safe to call more than once."""
    global _enabled
    if _enabled:
        return True
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return False
    try:
        import sentry_sdk
    except ImportError:
        logger.warning("SENTRY_DSN is set but sentry-sdk is not installed; error reporting is off")
        return False

    sentry_sdk.init(
        dsn=dsn,
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        release=os.getenv("RENDER_GIT_COMMIT") or None,
        send_default_pii=False,
        # Errors only. Performance tracing is a separate decision with its own
        # cost; turn it on with SENTRY_TRACES_SAMPLE_RATE when wanted.
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0") or 0),
    )
    _enabled = True
    logger.info("Sentry error reporting enabled")
    return True


def capture_exception(exc: BaseException) -> None:
    """Report an exception the app handled itself (and so Sentry would not see)."""
    if not _enabled:
        return
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)
    except Exception:  # pragma: no cover - reporting must never break a response
        logger.debug("Failed to report exception to Sentry", exc_info=True)
