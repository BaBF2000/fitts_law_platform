"""
Low-level database queries for the Fitts data framework.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Query Layer

Responsibility:
    Provides clean read-only access to raw SQLite rows used by the analysis
    framework.

Important:
    This module should stay close to the database schema. It should not compute
    scientific metrics directly.

    Higher-level modules such as metrics.py, summaries.py, quality.py and
    regression.py build on top of these query functions.
"""

from __future__ import annotations

from app.db import db, safe_name


def list_participants() -> list[dict]:
    """
    Return all participants together with basic session information.

    The query returns one row per participant. For each participant, the number
    of saved sessions and the timestamp of the most recent session are added.

    Returns:
        A list of dictionaries with:
            - participant_id
            - session_count
            - last_session_at
    """
    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
              p.participant_id,
              COUNT(s.id) AS session_count,
              MAX(s.started_at) AS last_session_at
            FROM participant p
            LEFT JOIN session s
              ON s.participant_id = p.participant_id
            GROUP BY p.participant_id
            ORDER BY p.participant_id ASC
            """
        )

        return [dict(row) for row in cur.fetchall()]


def list_sessions(
    participant: str | None = None,
) -> list[dict]:
    """
    Return saved experiment sessions.

    If a participant identifier is provided, only sessions belonging to that
    participant are returned. The participant identifier is normalised with
    safe_name() before it is used in the database query.

    Args:
        participant:
            Optional participant identifier.

    Returns:
        A list of session records as dictionaries.
    """
    with db() as conn:
        cur = conn.cursor()

        if participant:
            participant_id = safe_name(participant, "P")

            cur.execute(
                """
                SELECT
                  id,
                  participant_id,
                  session_code,
                  started_at,
                  is_demo,
                  session_comment,
                  protocol_name,
                  protocol_comment,
                  trial_count,
                  interactions_per_trial,
                  target_shape,
                  param_mode,
                  unit,
                  formula
                FROM session
                WHERE participant_id = ?
                ORDER BY started_at DESC
                """,
                (participant_id,),
            )
        else:
            cur.execute(
                """
                SELECT
                  id,
                  participant_id,
                  session_code,
                  started_at,
                  is_demo,
                  session_comment,
                  protocol_name,
                  protocol_comment,
                  trial_count,
                  interactions_per_trial,
                  target_shape,
                  param_mode,
                  unit,
                  formula
                FROM session
                ORDER BY started_at DESC
                """
            )

        return [dict(row) for row in cur.fetchall()]


def get_session(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> dict | None:
    """
    Return one session record.

    Lookup priority:
        1. If session_id is provided, the session is selected by database ID.
        2. Otherwise, participant and session code are used together.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database ID of the session.

    Returns:
        The matching session as a dictionary, or None if no matching session
        exists.

    Raises:
        ValueError:
            If neither session_id nor participant + session are provided.
    """
    with db() as conn:
        cur = conn.cursor()

        # Prefer direct database lookup when the internal session ID is known.
        if session_id is not None:
            cur.execute(
                """
                SELECT *
                FROM session
                WHERE id = ?
                LIMIT 1
                """,
                (session_id,),
            )

            row = cur.fetchone()
            return dict(row) if row else None

        # A participant/session pair is required when no session_id is provided.
        if participant is None or session is None:
            raise ValueError(
                "Either session_id or participant + session must be provided."
            )

        participant_id = safe_name(participant, "P")
        session_code = safe_name(session, "S")

        cur.execute(
            """
            SELECT *
            FROM session
            WHERE participant_id = ?
              AND session_code = ?
            LIMIT 1
            """,
            (
                participant_id,
                session_code,
            ),
        )

        row = cur.fetchone()
        return dict(row) if row else None


def get_trials(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool | None = None,
    valid_only: bool = False,
) -> list[dict]:
    """
    Return trial rows for one session.

    This function is the central low-level access point for trial data. It can
    return either trial-summary rows, interaction-level rows, or all stored rows
    depending on the value of summary_only.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database ID of the session.
        summary_only:
            True:
                Return only trial summary rows.
            False:
                Return only interaction-level rows.
            None:
                Return all rows.
        valid_only:
            If True, return only rows marked as valid hits.

    Returns:
        A list of trial rows as dictionaries.

    Notes:
        Session-level calibration and device values are joined into each row.
        This makes downstream analysis easier because modules such as metrics.py
        can access trial values and session context from the same dictionary.
    """
    session_row = get_session(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not session_row:
        return []

    where_clauses = ["t.session_id = ?"]
    params: list[object] = [session_row["id"]]

    # Keep only rows that represent one completed trial.
    if summary_only is True:
        where_clauses.append("t.trial_summary = 1")

    # Keep only interaction-level rows, where each row represents an event
    # within a trial rather than the trial summary itself.
    if summary_only is False:
        where_clauses.append("(t.trial_summary IS NULL OR t.trial_summary = 0)")

    # Keep only rows that correspond to valid target hits.
    if valid_only:
        where_clauses.append("t.hit_valid = 1")

    where_sql = " AND ".join(where_clauses)

    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            f"""
            SELECT
              t.*,

              s.mm_per_px AS mm_per_px,
              s.touch_diameter_px AS session_touch_diameter_px,
              s.touch_diameter_mm AS session_touch_diameter_mm,
              s.viewport_w AS session_viewport_w,
              s.viewport_h AS session_viewport_h,
              s.dpr AS session_dpr,
              s.unit AS session_unit,
              s.formula AS session_formula,
              s.protocol_name AS session_protocol_name,
              s.protocol_comment AS session_protocol_comment
            FROM trial t
            JOIN session s
              ON s.id = t.session_id
            WHERE {where_sql}
            ORDER BY
              t.trial_no ASC,
              t.interaction_no ASC,
              t.id ASC
            """,
            tuple(params),
        )

        return [dict(row) for row in cur.fetchall()]


def get_protocol_snapshot(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> str | None:
    """
    Return the protocol JSON snapshot stored with a session.

    The protocol snapshot contains the experiment configuration that was active
    when the session was saved. It is returned as a raw JSON string here because
    parsing and interpretation belong to the higher-level protocol module.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database ID of the session.

    Returns:
        The stored protocol JSON string, or None if no session exists.
    """
    session_row = get_session(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not session_row:
        return None

    return session_row.get("protocol_json")


def get_device_context(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> str | None:
    """
    Return the stored device context JSON for one session.

    The device context describes technical information about the recording
    environment, such as viewport size, pixel ratio, calibration values or touch
    diameter. It is returned as a raw JSON string because interpretation belongs
    to higher-level analysis modules.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database ID of the session.

    Returns:
        The stored device context JSON string, or None if no session exists.
    """
    session_row = get_session(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not session_row:
        return None

    return session_row.get("device_context_json")