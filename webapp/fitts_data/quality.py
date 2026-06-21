"""
Quality metrics for Fitts experiment data.

Responsibility:
    Provides quality and error-related metrics for experiment sessions.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Quality Layer

This module focuses on:
    - valid hit rate
    - invalid hit rate
    - error rate
    - total errors
    - overlap statistics

Important:
    Quality metrics help interpret Fitts' Law results.

    Fast movement times are only meaningful together with error behaviour.
    A session with low movement times but many invalid hits or high error rates
    should not be interpreted as good performance without further inspection.
"""

from __future__ import annotations

from typing import Any

from .queries import get_trials
from .statistics import StatisticsSummary, describe


def _as_int(value: Any, default: int = 0) -> int:
    """
    Convert a raw value to int.

    Args:
        value:
            Raw value from a database row.
        default:
            Value returned if conversion is not possible.

    Returns:
        Converted integer value, or the default value.
    """
    if value is None:
        return default

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _is_valid_hit(row: dict) -> bool:
    """
    Return True if a row is marked as a valid hit.

    The database usually stores hit_valid as 0 or 1. This helper also handles
    string representations such as "1".
    """
    return _as_int(row.get("hit_valid"), default=0) == 1


def get_error_rate(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
) -> float | None:
    """
    Return the mean error count per row.

    For summary rows, this represents the average number of errors per trial.
    For interaction rows, interpretation depends on how errors are stored in
    the database.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        summary_only:
            If True, use trial-summary rows.
            If False, use interaction-level rows.
            If None, use all rows.

    Returns:
        Mean error count per returned row, or None if no rows exist.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    if not rows:
        return None

    errors = [
        _as_int(row.get("errors"), default=0)
        for row in rows
    ]

    return sum(errors) / len(rows)


def get_total_errors(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
) -> int:
    """
    Return the total number of errors.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        summary_only:
            If True, use trial-summary rows.
            If False, use interaction-level rows.
            If None, use all rows.

    Returns:
        Total number of errors.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    return sum(
        _as_int(row.get("errors"), default=0)
        for row in rows
    )


def get_valid_hit_rate(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> float | None:
    """
    Return the ratio of valid interaction hits.

    This function uses interaction rows only.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Ratio of valid interaction rows, or None if no interaction rows exist.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=False,
    )

    if not rows:
        return None

    valid_count = sum(
        1
        for row in rows
        if _is_valid_hit(row)
    )

    return valid_count / len(rows)


def get_invalid_hit_rate(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> float | None:
    """
    Return the ratio of invalid interaction hits.

    This is the complement of the valid hit rate.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Ratio of invalid interaction rows, or None if no interaction rows exist.
    """
    valid_rate = get_valid_hit_rate(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if valid_rate is None:
        return None

    return 1.0 - valid_rate


def get_valid_hit_count(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> int:
    """
    Return the number of valid interaction hits.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Number of valid interaction rows.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=False,
    )

    return sum(
        1
        for row in rows
        if _is_valid_hit(row)
    )


def get_invalid_hit_count(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> int:
    """
    Return the number of invalid interaction hits.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Number of invalid interaction rows.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=False,
    )

    return sum(
        1
        for row in rows
        if not _is_valid_hit(row)
    )


def describe_overlap(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = False,
) -> StatisticsSummary:
    """
    Return descriptive statistics for measured overlap values.

    Overlap values are useful for checking whether the actual interaction
    position sufficiently overlapped with the target area.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        summary_only:
            If True, use trial-summary rows.
            If False, use interaction-level rows.
            If None, use all rows.

    Returns:
        A StatisticsSummary object describing the measured overlap values.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    values = [
        row.get("measured_overlap")
        for row in rows
    ]

    return describe(values)

def _as_float(value: Any) -> float | None:
    """
    Convert a raw value to float if possible.
    """
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _compute_row_id(
    row: dict[str, Any],
    *,
    effective: bool = True,
) -> float | None:
    """
    Return ID value from one row.

    Stored ID values are preferred. This helper does not recompute ID if the
    stored value is missing, because quality grouping should stay simple.
    """
    column = "ID_effective" if effective else "ID_planned"
    return _as_float(row.get(column))


def error_rate_by_ID(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective: bool = True,
    decimals: int = 2,
    summary_only: bool = True,
) -> dict[float, float]:
    """
    Return mean error count grouped by ID.

    This helps analyse the speed-accuracy tradeoff.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    groups: dict[float, list[int]] = {}

    for row in rows:
        id_value = _compute_row_id(row, effective=effective)

        if id_value is None:
            continue

        key = round(id_value, decimals)
        error_count = _as_int(row.get("errors"), default=0)

        groups.setdefault(key, []).append(error_count)

    return {
        key: sum(values) / len(values)
        for key, values in groups.items()
        if values
    }


def valid_hit_rate_by_ID(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective: bool = True,
    decimals: int = 2,
) -> dict[float, float]:
    """
    Return valid hit rate grouped by ID.

    This uses interaction rows only.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=False,
    )

    groups: dict[float, list[int]] = {}

    for row in rows:
        id_value = _compute_row_id(row, effective=effective)

        if id_value is None:
            continue

        key = round(id_value, decimals)
        hit_valid = 1 if _is_valid_hit(row) else 0

        groups.setdefault(key, []).append(hit_valid)

    return {
        key: sum(values) / len(values)
        for key, values in groups.items()
        if values
    }


def mean_MT_by_error_count(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
) -> dict[int, StatisticsSummary]:
    """
    Return MT statistics grouped by error count.

    This helps check whether faster or slower trials are related to errors.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    groups: dict[int, list[Any]] = {}

    for row in rows:
        error_count = _as_int(row.get("errors"), default=0)
        groups.setdefault(error_count, []).append(row.get("mt_ms"))

    return {
        error_count: describe(values)
        for error_count, values in groups.items()
    }


def speed_accuracy_summary(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> dict[str, Any]:
    """
    Return a compact speed-accuracy summary for one session.
    """
    return {
        "error_rate": get_error_rate(
            participant=participant,
            session=session,
            session_id=session_id,
        ),
        "total_errors": get_total_errors(
            participant=participant,
            session=session,
            session_id=session_id,
        ),
        "valid_hit_rate": get_valid_hit_rate(
            participant=participant,
            session=session,
            session_id=session_id,
        ),
        "error_rate_by_ID": error_rate_by_ID(
            participant=participant,
            session=session,
            session_id=session_id,
        ),
        "valid_hit_rate_by_ID": valid_hit_rate_by_ID(
            participant=participant,
            session=session,
            session_id=session_id,
        ),
        "MT_by_error_count": {
            error_count: summary.as_dict()
            for error_count, summary in mean_MT_by_error_count(
                participant=participant,
                session=session,
                session_id=session_id,
            ).items()
        },
    }