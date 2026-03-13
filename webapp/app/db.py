from __future__ import annotations

import csv
import os
import re
import sqlite3
from datetime import datetime, timezone
from io import StringIO
from threading import Lock
from typing import  Sequence

from flask import Response


# ---------------- Paths ----------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "fitts.db")

# Serializes writes when multiple requests attempt inserts concurrently.
# (SQLite can handle concurrency with WAL, but a write lock avoids "database is locked" spikes.)
DB_WRITE_LOCK = Lock()


# ---------------- Helpers ----------------

_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9_\-]+")
_SAFE_NAME_MAXLEN = 60


def safe_name(value: str | None, fallback: str) -> str:
    """
    Sanitize user-provided identifiers so they are safe for filesystem / DB usage.

    Rules:
      - Trim whitespace
      - Replace any non [a-zA-Z0-9_-] with "_"
      - Cap length to keep filenames manageable
      - Return fallback if empty after sanitation
    """
    s = (value or "").strip()
    if not s:
        return fallback

    s = _SAFE_NAME_RE.sub("_", s)
    s = s[:_SAFE_NAME_MAXLEN].strip("_")
    return s or fallback


def html_escape(value: object) -> str:
    """
    Minimal HTML escaping for server-rendered admin pages.

    Note: Prefer Flask/Jinja auto-escaping when possible. This helper is for cases
    where strings are assembled manually.
    """
    s = "" if value is None else str(value)
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def now_iso_seconds() -> str:
    """
    Return an ISO timestamp (UTC) with seconds precision.

    Using UTC avoids timezone-dependent exports and makes comparisons easier.
    """
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def db() -> sqlite3.Connection:
    """
    Create a SQLite connection configured for concurrent reads/writes.

    Notes:
      - WAL improves read/write concurrency.
      - check_same_thread=False allows usage across threads (Flask + SQLite).
      - busy_timeout reduces transient lock errors.
    """
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    # Pragmas are applied per-connection.
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn


def rows_to_csv_response(rows: Sequence[sqlite3.Row], filename: str) -> Response:
    """
    Convert a list of sqlite3.Row into a downloadable CSV response.

    If rows is empty, a valid CSV with no header is returned.
    """
    out = StringIO()
    writer = csv.writer(out, lineterminator="\n")

    if rows:
        header = list(rows[0].keys())
        writer.writerow(header)
        for r in rows:
            writer.writerow([r[h] for h in header])

    return Response(
        out.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------- DB init / migrations ----------------

def init_db() -> None:
    """
    Create tables if they are missing.

    This is safe to call multiple times.
    """
    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS participant (
              participant_id TEXT PRIMARY KEY
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS session (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              participant_id TEXT NOT NULL,
              session_code TEXT NOT NULL,
              started_at TEXT NOT NULL,

              is_demo INTEGER DEFAULT 0,

              unit TEXT,
              formula TEXT,
              timeout_ms INTEGER,
              trial_count INTEGER,
              target_shape TEXT,

              mm_per_px REAL,
              viewport_w INTEGER,
              viewport_h INTEGER,
              dpr REAL,
              user_agent TEXT,
              device_context_json TEXT,

              FOREIGN KEY(participant_id) REFERENCES participant(participant_id),
              UNIQUE(participant_id, session_code)
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS trial (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id INTEGER NOT NULL,
              trial_no INTEGER,
              timestamp_iso TEXT,

              target_shape TEXT,
              target_bbox_left REAL,
              target_bbox_top REAL,
              target_bbox_w REAL,
              target_bbox_h REAL,
              target_hit_geom_json TEXT,

              A_in REAL, W_in REAL, ID_in REAL,
              A_px_planned REAL, W_px REAL, A_mm_planned REAL, W_mm REAL, ID_planned REAL,
              D_px_effective REAL, D_mm_effective REAL, ID_effective REAL,

              prev_x REAL, prev_y REAL, x REAL, y REAL, placed TEXT,

              mt_ms REAL,
              errors INTEGER,
              error_reasons TEXT,
              clicks_before_hit INTEGER,

              FOREIGN KEY(session_id) REFERENCES session(id)
            )
            """
        )


def ensure_columns() -> None:
    """
    Lightweight migrations: add columns if missing.

    SQLite supports ADD COLUMN but not DROP/ALTER of existing columns.
    This function is intended to keep the schema compatible across iterations.
    """
    with db() as conn:
        cur = conn.cursor()

        # ---- session table migrations ----
        cur.execute("PRAGMA table_info(session)")
        session_cols = {row["name"] for row in cur.fetchall()}
        if "device_context_json" not in session_cols:
            cur.execute("ALTER TABLE session ADD COLUMN device_context_json TEXT")

        # ---- trial table migrations ----
        cur.execute("PRAGMA table_info(trial)")
        trial_cols = {row["name"] for row in cur.fetchall()}

        # Target geometry metadata
        if "target_shape" not in trial_cols:
            cur.execute("ALTER TABLE trial ADD COLUMN target_shape TEXT")
        if "target_bbox_left" not in trial_cols:
            cur.execute("ALTER TABLE trial ADD COLUMN target_bbox_left REAL")
        if "target_bbox_top" not in trial_cols:
            cur.execute("ALTER TABLE trial ADD COLUMN target_bbox_top REAL")
        if "target_bbox_w" not in trial_cols:
            cur.execute("ALTER TABLE trial ADD COLUMN target_bbox_w REAL")
        if "target_bbox_h" not in trial_cols:
            cur.execute("ALTER TABLE trial ADD COLUMN target_bbox_h REAL")
        if "target_hit_geom_json" not in trial_cols:
            cur.execute("ALTER TABLE trial ADD COLUMN target_hit_geom_json TEXT")


# ---------------- Export SQL ----------------

CSV_SELECT = """
  SELECT
    p.participant_id,
    s.session_code,
    s.started_at,
    s.is_demo,
    s.unit,
    s.formula,
    s.timeout_ms,
    s.trial_count,
    s.target_shape,
    s.mm_per_px,
    s.viewport_w,
    s.viewport_h,
    s.dpr,
    s.user_agent,
    s.device_context_json,

    t.trial_no,
    t.timestamp_iso,
    t.target_shape,
    t.target_bbox_left,
    t.target_bbox_top,
    t.target_bbox_w,
    t.target_bbox_h,
    t.target_hit_geom_json,
    t.A_in,
    t.W_in,
    t.ID_in,
    t.A_px_planned,
    t.W_px,
    t.A_mm_planned,
    t.W_mm,
    t.ID_planned,
    t.D_px_effective,
    t.D_mm_effective,
    t.ID_effective,
    t.prev_x,
    t.prev_y,
    t.x,
    t.y,
    t.placed,
    t.mt_ms,
    t.errors,
    t.error_reasons,
    t.clicks_before_hit
  FROM participant p
  JOIN session s ON s.participant_id = p.participant_id
  JOIN trial t ON t.session_id = s.id
  ORDER BY
    p.participant_id ASC,
    s.session_code ASC,
    t.trial_no ASC
"""