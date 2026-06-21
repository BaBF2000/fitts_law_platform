"""
Database utility helpers.

Organigram reference:
- Persistence & Backend
  -> SQLite Database
  -> Utility Helpers

Responsibility:
Provides small shared helpers used by route modules and database logic.

This module handles:
- safe identifier normalization
- minimal HTML escaping for manually generated dashboard pages
- UTC timestamp generation

Important:
These helpers are intentionally dependency-light so they can be reused across
routes, exports and dashboard pages.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

# Matches all characters that should not be used in safe identifiers
_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9_\-]+")
# Maximum length for sanitized names to avoid overly long filenames or labels
_SAFE_NAME_MAXLEN = 60


def safe_name(value: str | None, fallback: str) -> str:
    """
    Normalize a user-provided identifier for safe filesystem and database usage

    Args:
        value (str | None): Raw input value, for example a participant ID,
            session code or export-related name
        fallback (str): Value returned when the input is empty or becomes empty
            after sanitization

    Returns:
        str: Sanitized identifier containing only letters, digits, underscores
        and hyphens. The result is limited to _SAFE_NAME_MAXLEN characters

    Side effects:
        None. The function only transforms the provided string

    Notes:
        This function does not validate semantic correctness. It only reduces
        unsafe characters for filenames, URLs or database-related identifiers
    """
    text = (value or "").strip()

    if not text:
        return fallback

    text = _SAFE_NAME_RE.sub("_", text)
    text = text[:_SAFE_NAME_MAXLEN].strip("_")

    return text or fallback


def html_escape(value: object) -> str:
    """
    Escape a value for insertion into manually assembled HTML fragments

    Args:
        value (object): Value to convert to text and escape. None is converted
            to an empty string

    Returns:
        str: Escaped text where &, <, > and double quotes are replaced by their
        corresponding HTML entities

    Side effects:
        None.

    Related modules:
        Used by manually generated backend dashboard or export pages to reduce
        the risk of broken HTML or unintended markup injection

    Limitations:
        This is a minimal escaping helper. For complex HTML rendering, Flask/Jinja
        template escaping should be preferred
    """
    text = "" if value is None else str(value)

    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def now_iso_seconds() -> str:
    """
    Return the current UTC time as an ISO 8601 timestamp with seconds precision

    Returns:
        str: Timezone-aware UTC timestamp, for example
        '2026-06-14T10:30:45+00:00'

    Side effects:
        None.

    Related usage:
        Used for created_at, updated_at or started_at values in database records
        and exported metadata

    Notes:
        UTC is used to keep timestamps independent of the local device timezone
    """
    return datetime.now(timezone.utc).isoformat(timespec="seconds")