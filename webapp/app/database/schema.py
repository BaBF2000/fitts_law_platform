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
    Create the current SQLite database schema if the tables do not exist yet

    The tables are created in dependency order:
        1. participant
        2. protocol
        3. session
        4. trial

    Returns:
        None

    Side effects:
        Opens a database connection, creates missing tables and commits the
        schema initialization

    Important:
        CREATE TABLE IF NOT EXISTS does not modify existing table structures
        If an older fitts.db already exists, schema changes require deleting
        the database file or applying a manual migration

    Related modules:
        Called during application startup in app.__init__.create_app()
        Uses app.database.connection.db() to open the SQLite connection
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
    Compatibility placeholder for older startup code

    Returns:
        None

    Side effects:
        None. No ALTER TABLE statements are executed

    Design decision:
        Automatic schema migrations are intentionally not performed here
        During development, schema changes must be handled by deleting the old
        fitts.db file or by running an explicit manual migration

    Related modules:
        Called during application startup in app.__init__.create_app() after
        init_db()
    """

    return None


def create_participant_table(cur) -> None:
    """
    Create the participant table

    Args:
        cur: SQLite cursor used to execute the CREATE TABLE statement

    Returns:
        None.

    Responsibility:
        Stores unique participant identifiers. Other tables reference this
        table to associate sessions with participants

    Side effects:
        Creates the participant table if it does not already exist
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
    Create the reusable protocol template table

    Args:
        cur: SQLite cursor used to execute the CREATE TABLE statement

    Returns:
        None

    Responsibility:
        Stores reusable experiment protocol definitions, including the protocol
        JSON, sampling modes, optional admin settings and precomputed
        Monte Carlo summary values

    Notes:
        Protocols are templates. A session stores its own protocol snapshot so
        later edits of a protocol do not change already recorded sessions

    Side effects:
        Creates the protocol table if it does not already exist
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
    Create the experiment session table

    Args:
        cur: SQLite cursor used to execute the CREATE TABLE statement.

    Returns:
        None

    Responsibility:
        Stores one executed or prepared experiment session for one participant
        Each session contains metadata about the participant, session code,
        protocol snapshot, device context, calibration values and Monte Carlo
        pre-check results

    Reproducibility:
        The session stores a protocol snapshot so the experiment remains
        reproducible even if the reusable protocol template is edited later

    Constraints:
        The combination of participant_id and session_code must be unique

    Side effects:
        Creates the session table if it does not already exist
    """
    # The session table stores a protocol snapshot and device context
    # This keeps saved experiments reproducible even when protocol templates
    # or frontend defaults are changed later

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

    Args:
        cur: SQLite cursor used to execute the CREATE TABLE statement

    Returns:
        None.

    Responsibility:
        Stores the recorded experiment data. The table contains both
        interaction-level rows and trial-summary rows. It captures planned
        parameters, effective parameters, target geometry, touch positions,
        timing values, error information and device metadata

    Row types:
        - interaction-level rows store individual touch interactions
        - trial-summary rows are marked by trial_summary=1 and summarize the
          result of a full trial.

    Related modules:
        Result rows are inserted by backend result routes and are later used by
        dashboards, CSV exports and the Python analysis package fitts_data

    Side effects:
        Creates the trial table if it does not already exist
    """
    # The table intentionally contains many denormalized columns
    # This makes later export and analysis easier because each recorded row
    # already contains the relevant protocol, geometry, timing and device values
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