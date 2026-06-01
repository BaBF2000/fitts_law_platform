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
    Load recent sessions with Monte-Carlo metadata.

    The protocol snapshot is included so the frontend dashboard can reload
    the exact protocol used during the saved session.
    """
    with db() as conn:
        cur = conn.cursor()

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