"""
Summary functions for Fitts experiment data.

Responsibility:
    Computes clean session-level and participant-level summaries from
    metric accessors.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Summary Layer

Important:
    This module uses metrics.py and queries.py.
    It does not access Flask routes directly.

    Participant-level aggregation is intentionally limited to collecting
    session summaries. No global average is computed because sessions may
    differ in protocol, device, calibration or experimental conditions.
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

from .models import (
    ParticipantSummary,
    SessionSummary,
)

from .queries import (
    get_trials,
    list_sessions,
)


def _safe_mean(values: list[float]) -> float | None:
    """
    Return the arithmetic mean of a numeric list.

    Args:
        values:
            Numeric values to average.

    Returns:
        The mean value, or None if the list is empty.
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

    The summary combines the most important Fitts' Law metrics:
    - movement time
    - index of difficulty
    - amplitude
    - target width
    - errors
    - throughput

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        A SessionSummary object with aggregated session-level metrics.
    """
    # Trial rows are loaded once here to count the number of available
    # summary-level trials. Metric values are still retrieved through
    # metrics.py to keep metric logic centralised.
    trial_rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=True,
    )

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
        trial_count=len(trial_rows),
        mean_mt_ms=_safe_mean(mt_values),
        mean_id=_safe_mean(id_values),
        mean_a_px=_safe_mean(a_values),
        mean_w_px=_safe_mean(w_values),
        total_errors=sum(error_values),
        mean_errors=_safe_mean([float(value) for value in error_values]),
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

    This wrapper is useful for scripts, notebooks or API-like contexts where
    plain dictionaries are easier to serialise than dataclass-style objects.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        A dictionary representation of the SessionSummary object.
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

    Args:
        participant:
            Participant identifier.

    Returns:
        A ParticipantSummary object containing one SessionSummary per session.
    """
    sessions = list_sessions(participant=participant)

    # Use session_id because it uniquely identifies the session in the database.
    # This avoids ambiguity if session codes are reused or normalised.
    session_summaries = [
        session_summary(
            participant=session_row["participant_id"],
            session=session_row["session_code"],
            session_id=session_row["id"],
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

    Args:
        participant:
            Participant identifier.

    Returns:
        A dictionary representation of the ParticipantSummary object.
    """
    return participant_summary(
        participant=participant,
    ).as_dict()