"""
CSV export routes.

Organigram reference:
- Persistence & Backend
  -> CSV Export
- Dashboard
  -> Participant Export
  -> Session Export

Responsibility:
Provides admin-protected CSV exports for saved experiment data.

This module handles:
- exporting all sessions of one participant
- exporting one session by participant/session code
- exporting one session by internal database id

Important:
Exports use the shared CSV_SELECT query from db.py.
Filtered exports insert WHERE clauses before the shared ORDER BY block.
"""

from __future__ import annotations

from flask import Response, jsonify

from app.db import (
    db,
    safe_name,
    rows_to_csv_response,
)

from app.routes import bp

from .helpers import (
    require_admin,
    csv_select_base,
)


@bp.get("/export/participant/<participant_id>.csv")
def export_participant_csv(participant_id: str):
    """
    Export all sessions for one participant as CSV.
    """
    if not require_admin():
        return forbidden_admin_response()

    participant_id = safe_name(
        participant_id,
        "P",
    )

    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            csv_select_base()
            + """
            WHERE p.participant_id = ?
            ORDER BY s.started_at ASC, t.trial_no ASC, t.interaction_no ASC
            """,
            (participant_id,),
        )

        rows = cur.fetchall()

    if not rows:
        return no_data_response()

    return rows_to_csv_response(
        rows,
        f"{participant_id}.csv",
    )


@bp.get("/export/session/<participant_id>/<session_code>.csv")
def export_session_csv(
    participant_id: str,
    session_code: str,
):
    """
    Export one participant/session pair as CSV.
    """
    if not require_admin():
        return forbidden_admin_response()

    participant_id = safe_name(
        participant_id,
        "P",
    )

    session_code = safe_name(
        session_code,
        "S",
    )

    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            csv_select_base()
            + """
            WHERE p.participant_id = ? AND s.session_code = ?
            ORDER BY t.trial_no ASC, t.interaction_no ASC
            """,
            (
                participant_id,
                session_code,
            ),
        )

        rows = cur.fetchall()

    if not rows:
        return no_data_response()

    return rows_to_csv_response(
        rows,
        f"{participant_id}_{session_code}.csv",
    )


@bp.get("/export/session_id/<int:session_id>.csv")
def export_session_by_id_csv(session_id: int):
    """
    Export one session by internal database id as CSV.
    """
    if not require_admin():
        return forbidden_admin_response()

    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            csv_select_base()
            + """
            WHERE s.id = ?
            ORDER BY t.trial_no ASC, t.interaction_no ASC
            """,
            (session_id,),
        )

        rows = cur.fetchall()

    if not rows:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": f"No data for session_id={session_id}",
                }
            ),
            404,
        )

    participant_id = rows[0]["participant_id"]

    filename = f"{participant_id}_{session_id}.csv"

    return rows_to_csv_response(
        rows,
        filename,
    )


def forbidden_admin_response():
    """
    Return a standard admin-forbidden response.
    """
    return Response(
        "Forbidden (admin)",
        status=403,
        mimetype="text/plain",
    )


def no_data_response():
    """
    Return a standard no-data JSON response.
    """
    return (
        jsonify(
            {
                "ok": False,
                "error": "No data",
            }
        ),
        404,
    )