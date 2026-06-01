from __future__ import annotations

import csv
import os
import re
import sqlite3
from datetime import datetime, timezone
from io import StringIO
from threading import Lock
from typing import Sequence

from flask import Response


# ---------------- Paths ----------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "fitts.db")

# Serializes concurrent writes and reduces short SQLite lock spikes.
DB_WRITE_LOCK = Lock()


# ---------------- Helpers ----------------

_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9_\-]+")
_SAFE_NAME_MAXLEN = 60


def safe_name(value: str | None, fallback: str) -> str:
    """
    Sanitize user-provided identifiers for safe filesystem and DB usage.
    """
    s = (value or "").strip()
    if not s:
        return fallback

    s = _SAFE_NAME_RE.sub("_", s)
    s = s[:_SAFE_NAME_MAXLEN].strip("_")
    return s or fallback


def html_escape(value: object) -> str:
    """
    Minimal HTML escaping for manually assembled admin pages.
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
    Return a UTC ISO timestamp with seconds precision.
    """
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def db() -> sqlite3.Connection:
    """
    Create a SQLite connection configured for concurrent web usage.
    """
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=5000;")

    return conn

def csv_clean(value):
    if value is None:
        return ""
    if str(value) in ("NaN", "nan", "Infinity", "-Infinity"):
        return ""
    return value

def rows_to_csv_response(rows: Sequence[sqlite3.Row], filename: str) -> Response:
    """
    Convert sqlite3 rows into a downloadable CSV response.
    """
    out = StringIO()
    writer = csv.writer(out, lineterminator="\n")

    if rows:
        header = list(rows[0].keys())
        writer.writerow(header)

        for row in rows:
            writer.writerow([csv_clean(row[h]) for h in header])

    return Response(
        out.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------- DB init ----------------

def init_db() -> None:
    """
    Create the current database schema.

    Important:
      This does not modify existing tables. For an old fitts.db, delete it or
      migrate it manually before using this schema.
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
            CREATE TABLE IF NOT EXISTS protocol (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
        
              protocol_name TEXT NOT NULL UNIQUE,
              protocol_comment TEXT,
              protocol_json TEXT NOT NULL,
        
              a_sampling TEXT,
              w_sampling TEXT,
              id_sampling TEXT,
        
              admin_settings_json TEXT,
        
              monte_carlo_summary_json TEXT,
              monte_carlo_warning_count INTEGER,
              monte_carlo_worst_clamp_pct REAL,
              monte_carlo_worst_diagnostic TEXT,
        
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
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

              session_comment TEXT,
              protocol_name TEXT,
              protocol_comment TEXT,
              protocol_json TEXT,

              a_sampling TEXT,
              w_sampling TEXT,
              id_sampling TEXT,
              admin_settings_json TEXT,

              monte_carlo_summary_json TEXT,
              monte_carlo_warning_count INTEGER,
              monte_carlo_worst_clamp_pct REAL,
              monte_carlo_worst_diagnostic TEXT,
              monte_carlo_mean_clamped_min_pct REAL,
              monte_carlo_mean_clamped_max_pct REAL,

              unit TEXT,
              formula TEXT,
              timeout_ms INTEGER,
              trial_count INTEGER,
              interactions_per_trial INTEGER,

              target_shape TEXT,
              param_mode TEXT,
              required_overlap REAL,
              touch_diameter_px REAL,
              touch_diameter_mm REAL,

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

              interaction_no INTEGER,
              active_target_key TEXT,
              interactions_per_trial INTEGER,
              trial_summary INTEGER DEFAULT 0,

              unit TEXT,
              formula TEXT,
              shape TEXT,
              target_shape TEXT,

              param_mode TEXT,
              random_A INTEGER DEFAULT 0,
              random_W INTEGER DEFAULT 0,
              random_ID INTEGER DEFAULT 0,

              target_x REAL,
              target_y REAL,
              target_width_px REAL,
              target_height_px REAL,

              target_hit_geom_json TEXT,

              A_in REAL,
              W_in REAL,
              ID_in REAL,

              A_px_planned REAL,
              W_px REAL,
              W_axis_planned_px REAL,

              A_mm_planned REAL,
              W_mm REAL,
              W_axis_planned_mm REAL,

              ID_planned REAL,

              axis_planned_c_x REAL,
              axis_planned_c_y REAL,
              axis_planned_d_x REAL,
              axis_planned_d_y REAL,

              D_px_effective REAL,
              D_mm_effective REAL,
              W_axis_effective_px REAL,
              W_axis_effective_mm REAL,
              ID_effective REAL,

              measured_overlap REAL,
              required_overlap REAL,
              hit_valid INTEGER,

              touch_x REAL,
              touch_y REAL,
              touch_diameter_px REAL,
              touch_radius_px REAL,
              touch_diameter_px_session REAL,
              touch_diameter_mm_session REAL,

              prev_x REAL,
              prev_y REAL,
              x REAL,
              y REAL,
              placed TEXT,

              mt_ms REAL,
              errors INTEGER,
              error_reasons TEXT,
              clicks_before_hit INTEGER,

              ua TEXT,
              platform TEXT,
              mobile_ua INTEGER,
              screen_w INTEGER,
              screen_h INTEGER,
              viewport_w INTEGER,
              viewport_h INTEGER,
              dpr REAL,
              touch_support INTEGER,
              max_touch_points INTEGER,
              pointer_coarse INTEGER,
              pointer_fine INTEGER,
              hover_capable INTEGER,
              hardware_concurrency INTEGER,
              device_memory_gb REAL,
              prefers_reduced_motion INTEGER,
              language TEXT,
              timezone TEXT,

              FOREIGN KEY(session_id) REFERENCES session(id)
            )
            """
        )


def ensure_columns() -> None:
    """
    Kept for compatibility with app startup.

    No automatic ALTER TABLE migration is performed here by design.
    Use a fresh database or run a manual migration when the schema changes.
    """
    return None


# ---------------- Export SQL ----------------

CSV_SELECT = """
  SELECT
    p.participant_id,

    s.session_code,
    s.started_at,
    s.is_demo,
    s.session_comment,
    s.protocol_name,
    s.protocol_comment,
    s.protocol_json,

    s.monte_carlo_summary_json,
    s.monte_carlo_warning_count,
    s.monte_carlo_worst_clamp_pct,
    s.monte_carlo_worst_diagnostic,
    s.monte_carlo_mean_clamped_min_pct,
    s.monte_carlo_mean_clamped_max_pct,

    s.unit,
    s.formula,
    s.timeout_ms,
    s.trial_count,
    s.interactions_per_trial,
    s.admin_settings_json,
    s.a_sampling,
    s.w_sampling,
    s.id_sampling,

    s.target_shape,
    s.param_mode,
    s.required_overlap,
    s.touch_diameter_px,
    s.touch_diameter_mm,

    s.mm_per_px,
    s.viewport_w,
    s.viewport_h,
    s.dpr,
    s.user_agent,
    s.device_context_json,

    t.trial_no,
    t.timestamp_iso,
    t.interaction_no,
    t.active_target_key,
    t.interactions_per_trial,
    t.trial_summary,

    t.unit,
    t.formula,
    t.shape,
    t.target_shape,

    t.param_mode,
    t.random_A,
    t.random_W,
    t.random_ID,

    t.target_x,
    t.target_y,
    t.target_width_px,
    t.target_height_px,

    t.target_hit_geom_json,

    t.A_in,
    t.W_in,
    t.ID_in,

    t.A_px_planned,
    t.W_px,
    t.W_axis_planned_px,

    t.A_mm_planned,
    t.W_mm,
    t.W_axis_planned_mm,

    t.ID_planned,

    t.axis_planned_c_x,
    t.axis_planned_c_y,
    t.axis_planned_d_x,
    t.axis_planned_d_y,

    t.D_px_effective,
    t.D_mm_effective,
    t.W_axis_effective_px,
    t.W_axis_effective_mm,
    t.ID_effective,

    t.measured_overlap,
    t.required_overlap,
    t.hit_valid,

    t.touch_x,
    t.touch_y,
    t.touch_diameter_px,
    t.touch_radius_px,
    t.touch_diameter_px_session,
    t.touch_diameter_mm_session,

    t.prev_x,
    t.prev_y,
    t.x,
    t.y,
    t.placed,

    t.mt_ms,
    t.errors,
    t.error_reasons,
    t.clicks_before_hit,

    t.ua,
    t.platform,
    t.mobile_ua,
    t.screen_w,
    t.screen_h,
    t.viewport_w,
    t.viewport_h,
    t.dpr,
    t.touch_support,
    t.max_touch_points,
    t.pointer_coarse,
    t.pointer_fine,
    t.hover_capable,
    t.hardware_concurrency,
    t.device_memory_gb,
    t.prefers_reduced_motion,
    t.language,
    t.timezone

  FROM participant p
  JOIN session s ON s.participant_id = p.participant_id
  JOIN trial t ON t.session_id = s.id
  ORDER BY
    p.participant_id ASC,
    s.session_code ASC,
    t.trial_no ASC,
    t.interaction_no ASC
"""