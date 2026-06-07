"""
Summary functions for Fitts experiment data.

Responsibility:
Computes clean session-level summaries from metric accessors.

Important:
This module uses metrics.py and queries.py.
It does not access Flask routes directly.
Participant-level aggregation is intentionally not included because sessions
may differ in protocol, device, calibration or experimental conditions.
"""

from __future__ import annotations

from statistics import mean

from .metrics import (
    get_A,
    get_W,
    get_ID,
    get_MT,
    get_errors,
    get_throughput,
)

from .models import (SessionSummary, ParticipantSummary)

from .queries import list_sessions


def _safe_mean(values: list[float]) -> float | None:
    """
    Return the mean of a numeric list or None if empty.
    """
    return mean(values) if values else None


def session_summary(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> SessionSummary:
    """
    Return a compact scientific summary for one session.
    """
    mt_values = get_MT(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    id_values = get_ID(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=True,
    )

    a_values = get_A(
        participant=participant,
        session=session,
        session_id=session_id,
        calibrated=False,
        effective=False,
    )

    w_values = get_W(
        participant=participant,
        session=session,
        session_id=session_id,
        calibrated=False,
        effective=False,
    )

    error_values = get_errors(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    throughput_values = get_throughput(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    return SessionSummary(
        participant=participant,
        session=session,
        session_id=session_id,
        trial_count=len(mt_values),
        mean_mt_ms=_safe_mean(mt_values),
        mean_id=_safe_mean(id_values),
        mean_a_px=_safe_mean(a_values),
        mean_w_px=_safe_mean(w_values),
        total_errors=sum(error_values),
        mean_errors=_safe_mean([float(v) for v in error_values]),
        mean_throughput=_safe_mean(throughput_values),
    )


def session_summary_dict(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> dict:
    """
    Return a JSON-friendly session summary dictionary.
    """
    return session_summary(
        participant=participant,
        session=session,
        session_id=session_id,
    ).as_dict()

def participant_summary(
    participant: str,
) -> ParticipantSummary:
    """
    Return all session summaries for one participant.

    Important:
    No global average is computed because sessions may differ in protocol,
    device, calibration or experimental conditions.
    """
    sessions = list_sessions(participant=participant)

    session_summaries = [
        session_summary(
            participant=participant,
            session=session_row["session_code"],
        )
        for session_row in sessions
    ]

    return ParticipantSummary(
        participant=participant,
        session_count=len(sessions),
        sessions=session_summaries,
    )

def participant_summary_dict(
    participant: str,
) -> dict:
    """
    Return a JSON-friendly participant summary dictionary.
    """
    return participant_summary(
        participant=participant,
    ).as_dict()