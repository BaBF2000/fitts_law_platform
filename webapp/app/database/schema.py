"""
Database schema initialization.

Organigram reference:
- Persistence & Backend
  -> SQLite Database
  -> Schema Initialization

Responsibility:
Creates the SQLite tables required by the application.

This module defines:
- participant table
- protocol table
- session table
- trial table

Important:
init_db() creates missing tables only.
It does not migrate existing tables.

If the schema changes during development:
- delete the old fitts.db, or
- create a manual migration.
"""

from __future__ import annotations

from .connection import db


def init_db() -> None:
    """
    Create the current database schema.

    Important:
    This does not modify existing tables. For an old fitts.db, delete it or
    migrate it manually before using this schema.
    """
    with db() as conn:
        cur = conn.cursor()

        create_participant_table(cur)
        create_protocol_table(cur)
        create_session_table(cur)
        create_trial_table(cur)

        conn.commit()


def ensure_columns() -> None:
    """
    Kept for compatibility with app startup.

    No automatic ALTER TABLE migration is performed here by design.
    Use a fresh database or run a manual migration when the schema changes.
    """
    return None


def create_participant_table(cur) -> None:
    """
    Create the participant table.
    """
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS participant (
          participant_id TEXT PRIMARY KEY
        )
        """
    )


def create_protocol_table(cur) -> None:
    """
    Create the reusable protocol template table.
    """
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


def create_session_table(cur) -> None:
    """
    Create the experiment session table.

    Each session stores a protocol snapshot so the experiment remains
    reproducible even if the protocol template is edited later.
    """
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


def create_trial_table(cur) -> None:
    """
    Create the trial/result table.

    This table stores both interaction-level and trial-summary rows.
    """
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