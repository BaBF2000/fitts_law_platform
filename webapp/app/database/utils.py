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


_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9_\-]+")
_SAFE_NAME_MAXLEN = 60


def safe_name(value: str | None, fallback: str) -> str:
    """
    Sanitize user-provided identifiers for safe filesystem and database usage.
    """
    text = (value or "").strip()

    if not text:
        return fallback

    text = _SAFE_NAME_RE.sub("_", text)
    text = text[:_SAFE_NAME_MAXLEN].strip("_")

    return text or fallback


def html_escape(value: object) -> str:
    """
    Minimal HTML escaping for manually assembled admin pages.
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
    Return a UTC ISO timestamp with seconds precision.
    """
    return datetime.now(timezone.utc).isoformat(timespec="seconds")