"""
Monte Carlo dashboard database queries.

Organigram reference:
- Persistence & Backend
  -> Admin Dashboard
     -> Monte Carlo Analysis
     -> Session Query

Responsibility:
Loads session data required by the Monte Carlo dashboard.

Important:
This module only reads data from SQLite.
It does not render HTML and does not perform Monte Carlo simulation.
"""

from __future__ import annotations

from app.db import db


def load_recent_sessions(limit: int = 50) -> list[dict]:
    """
    Load recent saved sessions with stored Monte Carlo metadata

    Args:
        limit (int): Maximum number of sessions to return. Defaults to 50

    Returns:
        list[dict]: Recent session rows ordered by started_at descending. Each
        row contains session identifiers, protocol metadata and stored Monte
        Carlo summary fields

    Database access:
        Reads from the session table only

    Side effects:
        None. This function only opens a database connection and reads data

    Important:
        The protocol_json snapshot is included so the dashboard can reopen or
        inspect the exact protocol configuration that belonged to the saved
        session. This function does not perform a new Monte Carlo simulation
    """
    with db() as conn:
        cur = conn.cursor()

        # Load only session-level Monte Carlo fields.
        # The dashboard uses these stored values for overview and navigation,
        # not for recalculating the Monte Carlo simulation.
        cur.execute(
            """
            SELECT
              s.id AS session_id,
              s.participant_id,
              s.session_code,
              s.started_at,
              s.protocol_name,
              s.protocol_json,
              s.monte_carlo_warning_count,
              s.monte_carlo_worst_clamp_pct,
              s.monte_carlo_worst_diagnostic
            FROM session s
            ORDER BY s.started_at DESC
            LIMIT ?
            """,
            (limit,),
        )

        return [
            dict(row)
            for row in cur.fetchall()
        ]