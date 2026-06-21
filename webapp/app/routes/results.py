"""
Result and session API routes.

Organigram reference:
- Experiment Runtime
  -> Result Collection
- Persistence & Backend
  -> Session Save
  -> Session Query

Responsibility:
Provides backend endpoints for experiment sessions and result rows.

This module handles:
- checking participant/session ID availability
- saving one completed experiment run
- listing sessions for one participant

Important:
A saved session contains a protocol snapshot.
This guarantees reproducibility even if the original protocol template
is later edited or deleted.
"""

from __future__ import annotations

from flask import jsonify, request

from app.db import (
    db,
    DB_WRITE_LOCK,
    safe_name,
    now_iso_seconds,
)

from app.routes import bp

from .helpers import (
    as_int_bool,
    get_field,
    insert_dict,
)


@bp.get("/check_ids")
def check_ids():
    """
    Check whether a participant ID or participant/session pair already exists

    Query parameters:
        participant_id: Raw participant identifier entered in the frontend
        session_id: Raw session identifier entered in the frontend

    Returns:
        flask.Response: JSON response containing the sanitized identifiers and
        boolean flags for participant_exists and session_exists

    Side effects:
        None. This endpoint only reads from the participant and session tables

    Related usage:
        Used by the frontend before starting or saving a run to warn about
        duplicate participant/session combinations
    """
    participant_id = safe_name(
        request.args.get("participant_id"),
        "P",
    )

    session_code = safe_name(
        request.args.get("session_id"),
        "S",
    )

    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            "SELECT 1 FROM participant WHERE participant_id = ? LIMIT 1",
            (participant_id,),
        )
        participant_exists = cur.fetchone() is not None

        cur.execute(
            """
            SELECT 1
            FROM session
            WHERE participant_id = ? AND session_code = ?
            LIMIT 1
            """,
            (participant_id, session_code),
        )
        session_exists = cur.fetchone() is not None

    return jsonify(
        {
            "ok": True,
            "participant_id": participant_id,
            "session_id": session_code,
            "participant_exists": participant_exists,
            "session_exists": session_exists,
        }
    )


@bp.post("/save_results")
def save_results():
    """
    Persist one completed experiment run

    Expected JSON payload:
        rows (list[dict]): Interaction-level and/or trial-summary result rows
        meta (dict): Session metadata, protocol snapshot, device context,
            calibration values and Monte Carlo pre-check information

    Stored database levels:
        - participant: Created if the participant ID does not exist yet
        - session: Stores one experiment run and its protocol snapshot
        - trial: Stores all received result rows for the session

    Returns:
        flask.Response:
            - 200 with ok=True and session_row_id when saving succeeds
            - 400 if the result rows are missing or malformed
            - 409 if the participant/session pair already exists
            - 500 if the session row could not be created

    Side effects:
        Inserts one participant if needed, inserts one session row, inserts all
        trial rows and commits the transaction

    Concurrency:
        Uses DB_WRITE_LOCK to serialize write access and reduce SQLite write
        conflicts during overlapping save requests

    Reproducibility:
        The session row stores a protocol snapshot so later changes to protocol
        templates do not affect already saved experiment sessions
    """
    payload = request.get_json(silent=True) or {}

    rows = payload.get("rows") or []
    meta = payload.get("meta") or {}

    invalid = validate_result_payload(rows)
    if invalid:
      return invalid

    participant_id = safe_name(
        meta.get("participant_id"),
        "P",
    )

    session_code = safe_name(
        meta.get("session_id"),
        "S",
    )

    started_at = now_iso_seconds()

    session_data = build_session_data(
        meta=meta,
        participant_id=participant_id,
        session_code=session_code,
        started_at=started_at,
    )

    with DB_WRITE_LOCK:
        with db() as conn:
            cur = conn.cursor()

            if session_exists(cur, participant_id, session_code):
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": "Session already exists",
                        }
                    ),
                    409,
                )

            cur.execute(
                "INSERT OR IGNORE INTO participant(participant_id) VALUES (?)",
                (participant_id,),
            )

            insert_dict(
                cur,
                "session",
                session_data,
            )

            session_db_id = cur.lastrowid

            if session_db_id is None:
                conn.rollback()
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": "Session could not be created",
                        }
                    ),
                    500,
                )
            
            # Store all frontend result rows under the newly created session.
            # Each row may represent either one interaction or one trial summary,
            # depending on the trial_summary flag.
            for row in rows:
                trial_data = build_trial_data(
                    row=row,
                    session_db_id= session_db_id,
                )

                insert_dict(
                    cur,
                    "trial",
                    trial_data,
                )

            conn.commit()

    return (
        jsonify(
            {
                "ok": True,
                "saved_to": "data/fitts.db",
                "session_row_id": session_db_id,
            }
        ),
        200,
    )


@bp.get("/sessions/<participant_id>")
def list_sessions(participant_id: str):
    """
    Return a lightweight JSON list of saved sessions for one participant

    Args:
        participant_id (str): Participant identifier from the URL path

    Returns:
        flask.Response: JSON response containing the sanitized participant ID
        and a list of session metadata rows ordered by started_at descending

    Side effects:
        None. This endpoint only reads from the session table

    Related usage:
        Can be used by frontend views or dashboards to inspect existing sessions
        without loading all trial-level result data
    """
    safe_participant_id = safe_name(participant_id, "P")

    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
              id,
              session_code,
              started_at,
              is_demo,
              session_comment,
              protocol_name,
              protocol_comment,
              unit,
              formula,
              timeout_ms,
              trial_count,
              interactions_per_trial,
              target_shape,
              param_mode
            FROM session
            WHERE participant_id = ?
            ORDER BY started_at DESC
            """,
            (safe_participant_id,),
        )

        rows = [
            dict(row)
            for row in cur.fetchall()
        ]

    return jsonify(
        {
            "ok": True,
            "participant_id": safe_participant_id,
            "sessions": rows,
        }
    )


def validate_result_payload(rows):
    """
    Validate the result row list received from the frontend

    Args:
        rows: Raw rows value from the JSON request payload

    Returns:
        None: The payload is valid
        tuple: Flask JSON error response and HTTP status code when invalid

    Validation rules:
        - rows must be a non-empty list
        - every item in rows must be a dictionary

    Side effects:
        None
    """
    if not isinstance(rows, list) or not rows:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "No rows",
                }
            ),
            400,
        )

    if not all(isinstance(row, dict) for row in rows):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "Rows must be objects",
                }
            ),
            400,
        )

    return None


def session_exists(cur, participant_id: str, session_code: str) -> bool:
    """
    Check whether a participant/session pair already exists

    Args:
        cur: SQLite cursor used for the SELECT query
        participant_id (str): Sanitized participant identifier
        session_code (str): Sanitized session identifier

    Returns:
        bool: True if a matching session row exists, otherwise False

    Side effects:
        Executes a SELECT query using the provided cursor

    Related usage:
        Used by save_results() to prevent accidental overwriting of existing
        experiment sessions
    """
    cur.execute(
        """
        SELECT id
        FROM session
        WHERE participant_id = ? AND session_code = ?
        LIMIT 1
        """,
        (participant_id, session_code),
    )

    return cur.fetchone() is not None


def build_session_data(
    *,
    meta: dict,
    participant_id: str,
    session_code: str,
    started_at: str,
) -> dict:
    """
    Build the session table row from frontend metadata

    Args:
        meta (dict): Metadata object received from the frontend. It may contain
            protocol information, Monte Carlo summaries, calibration values,
            viewport values and device context data
        participant_id (str): Sanitized participant identifier
        session_code (str): Sanitized session identifier
        started_at (str): UTC ISO timestamp assigned when the run is saved

    Returns:
        dict: Column-value mapping compatible with the session table

    Side effects:
        None. This function only maps frontend metadata to database columns

    Important:
        This mapping stores the protocol snapshot and technical context of the
        run. This is required for reproducibility of saved experiment sessions
    """
    return {
        "participant_id": participant_id,
        "session_code": session_code,
        "started_at": started_at,
        "is_demo": 1 if meta.get("is_demo") else 0,

        "session_comment": meta.get("session_comment"),
        "protocol_name": meta.get("protocol_name"),
        "protocol_comment": meta.get("protocol_comment"),
        "protocol_json": meta.get("protocol_json"),
        "admin_settings_json": meta.get("admin_settings_json"),

        "monte_carlo_summary_json": meta.get("monte_carlo_summary_json"),
        "monte_carlo_warning_count": meta.get("monte_carlo_warning_count"),
        "monte_carlo_worst_clamp_pct": meta.get("monte_carlo_worst_clamp_pct"),
        "monte_carlo_worst_diagnostic": meta.get("monte_carlo_worst_diagnostic"),
        "monte_carlo_mean_clamped_min_pct": meta.get("monte_carlo_mean_clamped_min_pct"),
        "monte_carlo_mean_clamped_max_pct": meta.get("monte_carlo_mean_clamped_max_pct"),

        "a_sampling": meta.get("a_sampling"),
        "w_sampling": meta.get("w_sampling"),
        "id_sampling": meta.get("id_sampling"),

        "unit": meta.get("unit"),
        "formula": meta.get("formula"),
        "timeout_ms": meta.get("timeout_ms"),
        "trial_count": meta.get("trial_count"),
        "interactions_per_trial": meta.get("interactions_per_trial"),

        "target_shape": meta.get("target_shape"),
        "param_mode": meta.get("param_mode"),
        "required_overlap": meta.get("required_overlap"),
        "touch_diameter_px": meta.get("touch_diameter_px"),
        "touch_diameter_mm": meta.get("touch_diameter_mm"),

        "mm_per_px": meta.get("mm_per_px"),
        "viewport_w": meta.get("viewport_w"),
        "viewport_h": meta.get("viewport_h"),
        "dpr": meta.get("dpr"),
        "user_agent": meta.get("user_agent"),
        "device_context_json": meta.get("device_context_json"),
    }


# This function intentionally keeps the frontend-to-database field mapping in
# one place. This makes it easier to compare the frontend result schema with the
# SQLite trial table and the CSV export query.
def build_trial_data(
    *,
    row: dict,
    session_db_id: int,
) -> dict:
    """
    Build one trial table row from one frontend result row

    Args:
        row (dict): One result row received from the frontend. It may represent
            an interaction-level row or a trial-summary row
        session_db_id (int): Database primary key of the parent session row

    Returns:
        dict: Column-value mapping compatible with the trial table

    Side effects:
        None. This function only maps frontend result fields to database columns

    Field groups:
        The mapping includes trial identifiers, target geometry, planned Fitts
        parameters, effective Fitts parameters, touch coordinates, timing/error
        values and device metadata

    Related modules:
        The resulting dictionary is inserted by save_results() using insert_dict()
        The same columns are later used by CSV exports, dashboards and the
        fitts_data analysis package
    """
    return {
        "session_id": session_db_id,
        "trial_no": get_field(row, "trial_no"),
        "timestamp_iso": get_field(row, "timestamp_iso"),

        "interaction_no": get_field(row, "interaction_no"),
        "active_target_key": get_field(row, "active_target_key"),
        "interactions_per_trial": get_field(row, "interactions_per_trial"),
        "trial_summary": as_int_bool(get_field(row, "trial_summary")),

        "unit": get_field(row, "unit"),
        "formula": get_field(row, "formula"),
        "shape": get_field(row, "shape"),
        "target_shape": get_field(row, "target_shape"),

        "param_mode": get_field(row, "param_mode"),
        "random_A": as_int_bool(get_field(row, "random_A")),
        "random_W": as_int_bool(get_field(row, "random_W")),
        "random_ID": as_int_bool(get_field(row, "random_ID")),

        "target_x": get_field(row, "target_x"),
        "target_y": get_field(row, "target_y"),
        "target_width_px": get_field(row, "target_width_px"),
        "target_height_px": get_field(row, "target_height_px"),

        "target_hit_geom_json": get_field(row, "target_hit_geom_json"),

        "A_in": get_field(row, "A_in"),
        "W_in": get_field(row, "W_in"),
        "ID_in": get_field(row, "ID_in"),

        "A_px_planned": get_field(row, "A_px_planned"),
        "W_px": get_field(row, "W_px"),
        "W_axis_planned_px": get_field(row, "W_axis_planned_px"),

        "A_mm_planned": get_field(row, "A_mm_planned"),
        "W_mm": get_field(row, "W_mm"),
        "W_axis_planned_mm": get_field(row, "W_axis_planned_mm"),

        "ID_planned": get_field(row, "ID_planned"),

        "axis_planned_c_x": get_field(row, "axis_planned_c_x"),
        "axis_planned_c_y": get_field(row, "axis_planned_c_y"),
        "axis_planned_d_x": get_field(row, "axis_planned_d_x"),
        "axis_planned_d_y": get_field(row, "axis_planned_d_y"),

        "D_px_effective": get_field(row, "D_px_effective"),
        "D_mm_effective": get_field(row, "D_mm_effective"),
        "W_axis_effective_px": get_field(row, "W_axis_effective_px"),
        "W_axis_effective_mm": get_field(row, "W_axis_effective_mm"),
        "ID_effective": get_field(row, "ID_effective"),

        "measured_overlap": get_field(row, "measured_overlap"),
        "required_overlap": get_field(row, "required_overlap"),
        "hit_valid": as_int_bool(get_field(row, "hit_valid")),

        "touch_x": get_field(row, "touch_x"),
        "touch_y": get_field(row, "touch_y"),
        "touch_diameter_px": get_field(row, "touch_diameter_px"),
        "touch_radius_px": get_field(row, "touch_radius_px"),
        "touch_diameter_px_session": get_field(row, "touch_diameter_px_session"),
        "touch_diameter_mm_session": get_field(row, "touch_diameter_mm_session"),

        "prev_x": get_field(row, "prev_x"),
        "prev_y": get_field(row, "prev_y"),
        "x": get_field(row, "x"),
        "y": get_field(row, "y"),
        "placed": get_field(row, "placed"),

        "mt_ms": get_field(row, "mt_ms"),
        "errors": get_field(row, "errors"),
        "error_reasons": get_field(row, "error_reasons"),
        "clicks_before_hit": get_field(row, "clicks_before_hit"),

        "ua": get_field(row, "ua"),
        "platform": get_field(row, "platform"),
        "mobile_ua": as_int_bool(get_field(row, "mobile_ua")),
        "screen_w": get_field(row, "screen_w"),
        "screen_h": get_field(row, "screen_h"),
        "viewport_w": get_field(row, "viewport_w"),
        "viewport_h": get_field(row, "viewport_h"),
        "dpr": get_field(row, "dpr"),
        "touch_support": as_int_bool(get_field(row, "touch_support")),
        "max_touch_points": get_field(row, "max_touch_points"),
        "pointer_coarse": as_int_bool(get_field(row, "pointer_coarse")),
        "pointer_fine": as_int_bool(get_field(row, "pointer_fine")),
        "hover_capable": as_int_bool(get_field(row, "hover_capable")),
        "hardware_concurrency": get_field(row, "hardware_concurrency"),
        "device_memory_gb": get_field(row, "device_memory_gb"),
        "prefers_reduced_motion": as_int_bool(get_field(row, "prefers_reduced_motion")),
        "language": get_field(row, "language"),
        "timezone": get_field(row, "timezone"),
    }