"""
Interaction-level helpers for Fitts experiment data.

Responsibility:
Provides accessors and diagnostics for interaction rows inside trials.

Important:
Interaction rows are rows where trial_summary is NULL or 0.
Trial summary rows are rows where trial_summary = 1.
"""

from __future__ import annotations

from collections import defaultdict

from statistics import mean
from typing import Any

from .queries import get_session, get_trials
from .statistics import describe, StatisticsSummary


def get_interactions(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    trial_no: int | None = None,
    valid_only: bool = False,
) -> list[dict[str, Any]]:
    """
    Return interaction rows for one session.

    If trial_no is provided, only interactions of that trial are returned.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=False,
        valid_only=valid_only,
    )

    if trial_no is None:
        return rows

    return [
        row
        for row in rows
        if row.get("trial_no") == trial_no
    ]


def get_trial_summaries(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> list[dict[str, Any]]:
    """
    Return trial summary rows.
    """
    return get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=True,
    )


def group_interactions_by_trial(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[int, list[dict[str, Any]]]:
    """
    Group interaction rows by trial number.
    """
    rows = get_interactions(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    groups: dict[int, list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        trial_no = row.get("trial_no")

        if trial_no is None:
            continue

        try:
            groups[int(trial_no)].append(row)
        except (TypeError, ValueError):
            continue

    return dict(groups)


def get_interaction_counts_per_trial(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[int, int]:
    """
    Return number of interaction rows per trial.
    """
    groups = group_interactions_by_trial(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    return {
        trial_no: len(rows)
        for trial_no, rows in groups.items()
    }


def mean_interactions_per_trial(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> float | None:
    """
    Return mean number of interactions per trial.
    """
    counts = get_interaction_counts_per_trial(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    if not counts:
        return None

    return mean(counts.values())


def get_expected_interactions_per_trial(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> int | None:
    """
    Return expected interaction count from session metadata.
    """
    session_row = get_session(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not session_row:
        return None

    raw_value = session_row.get("interactions_per_trial")

    if raw_value is None:
        return None

    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return None


def describe_interaction_MT(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> StatisticsSummary:
    """
    Return descriptive statistics for interaction-level MT values.
    """
    rows = get_interactions(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    values = [
        row.get("mt_ms")
        for row in rows
    ]

    return describe(values)


def get_interaction_MT_by_number(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[int, list[float]]:
    """
    Return MT values grouped by interaction number.
    """
    rows = get_interactions(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    groups: dict[int, list[float]] = defaultdict(list)

    for row in rows:
        interaction_no = row.get("interaction_no")
        mt_ms = row.get("mt_ms")

        if interaction_no is None or mt_ms is None:
            continue

        try:
            groups[int(interaction_no)].append(float(mt_ms))
        except (TypeError, ValueError):
            continue

    return dict(groups)


def describe_MT_by_interaction_number(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[int, StatisticsSummary]:
    """
    Return MT statistics for each interaction number.
    """
    groups = get_interaction_MT_by_number(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    return {
        interaction_no: describe(values)
        for interaction_no, values in groups.items()
    }


def verify_interaction_count(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    expected: int | None = None,
) -> dict[str, Any]:
    """
    Check whether trials contain the expected number of interactions.
    """
    if expected is None:
        expected = get_expected_interactions_per_trial(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    counts = get_interaction_counts_per_trial(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not counts:
        return {
            "ok": False,
            "expected": expected,
            "observed": {},
            "warnings": ["No interaction rows found."],
        }

    warnings: list[str] = []

    if expected is not None:
        wrong_trials = [
            trial_no
            for trial_no, count in counts.items()
            if count != expected
        ]

        if wrong_trials:
            warnings.append(
                f"Trials with unexpected interaction count: {wrong_trials}"
            )

    return {
        "ok": not warnings,
        "expected": expected,
        "observed": counts,
        "warnings": warnings,
    }