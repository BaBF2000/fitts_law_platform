"""
Quality metrics for Fitts experiment data.

Responsibility:
Provides quality and error-related metrics for experiment sessions.

This module focuses on:
- valid hit rate
- error rate
- total errors
- overlap statistics

Important:
Quality metrics help interpret Fitts' law results.
Fast movement times are only meaningful together with error behavior.
"""

from __future__ import annotations

from .queries import get_trials
from .statistics import describe, StatisticsSummary


def get_error_rate(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
) -> float | None:
    """
    Return the mean error rate per row.

    For summary rows, this represents average errors per trial.
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
        int(row.get("errors") or 0)
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
    Return total number of errors.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    return sum(
        int(row.get("errors") or 0)
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

    Uses interaction rows only.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=False,
    )

    if not rows:
        return None

    valid = [
        row
        for row in rows
        if row.get("hit_valid") == 1
    ]

    return len(valid) / len(rows)


def describe_overlap(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = False,
) -> StatisticsSummary:
    """
    Return descriptive statistics for measured overlap values.
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