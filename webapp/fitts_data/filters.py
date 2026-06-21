"""
Filtering helpers for Fitts experiment data.

Responsibility:
    Provides reusable filtering operations on already loaded trial rows.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Filter Helpers

Important:
    Filters operate on trial dictionaries that have already been loaded.
    They do not perform database queries themselves.

    This makes the functions useful together with SessionDataset, notebooks
    or custom analysis scripts.
"""

from __future__ import annotations

from typing import Any


Row = dict[str, Any]


def _as_int(value: Any) -> int | None:
    """
    Convert a raw value to int if possible.

    Args:
        value:
            Raw value from a trial row.

    Returns:
        Integer value, or None if conversion is not possible.
    """
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_float(value: Any) -> float | None:
    """
    Convert a raw value to float if possible.

    Args:
        value:
            Raw value from a trial row.

    Returns:
        Float value, or None if conversion is not possible.
    """
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def valid_hits(
    rows: list[Row],
) -> list[Row]:
    """
    Keep only valid hit rows.

    A row is considered valid when hit_valid equals 1.
    """
    return [
        row
        for row in rows
        if _as_int(row.get("hit_valid")) == 1
    ]


def invalid_hits(
    rows: list[Row],
) -> list[Row]:
    """
    Keep only invalid hit rows.

    A row is considered invalid when hit_valid is present and not equal to 1.
    """
    return [
        row
        for row in rows
        if row.get("hit_valid") is not None
        and _as_int(row.get("hit_valid")) != 1
    ]


def trial_summaries(
    rows: list[Row],
) -> list[Row]:
    """
    Keep only trial summary rows.

    Trial summary rows are rows where trial_summary equals 1.
    """
    return [
        row
        for row in rows
        if _as_int(row.get("trial_summary")) == 1
    ]


def interactions(
    rows: list[Row],
) -> list[Row]:
    """
    Keep only interaction-level rows.

    Interaction rows are rows where trial_summary is missing, NULL or not equal
    to 1.
    """
    return [
        row
        for row in rows
        if _as_int(row.get("trial_summary")) != 1
    ]


def without_errors(
    rows: list[Row],
) -> list[Row]:
    """
    Keep only rows without recorded errors.

    Missing error values are treated as zero.
    """
    return [
        row
        for row in rows
        if _as_int(row.get("errors")) in (None, 0)
    ]


def with_errors(
    rows: list[Row],
) -> list[Row]:
    """
    Keep only rows with one or more recorded errors.
    """
    return [
        row
        for row in rows
        if (_as_int(row.get("errors")) or 0) > 0
    ]


def by_trial_no(
    rows: list[Row],
    trial_no: int,
) -> list[Row]:
    """
    Keep rows belonging to one trial number.

    Args:
        rows:
            Trial rows or interaction rows.
        trial_no:
            Trial number to keep.
    """
    return [
        row
        for row in rows
        if _as_int(row.get("trial_no")) == trial_no
    ]


def by_interaction_no(
    rows: list[Row],
    interaction_no: int,
) -> list[Row]:
    """
    Keep rows belonging to one interaction number.

    This is useful for comparing, for example, all first interactions across
    trials with all tenth interactions across trials.
    """
    return [
        row
        for row in rows
        if _as_int(row.get("interaction_no")) == interaction_no
    ]


def by_shape(
    rows: list[Row],
    shape: str,
) -> list[Row]:
    """
    Keep rows matching a target shape.

    The function first checks target_shape and falls back to shape.
    """
    return [
        row
        for row in rows
        if (row.get("target_shape") or row.get("shape")) == shape
    ]


def by_param_mode(
    rows: list[Row],
    mode: str,
) -> list[Row]:
    """
    Keep rows matching a parameter mode.
    """
    return [
        row
        for row in rows
        if row.get("param_mode") == mode
    ]


def by_id_range(
    rows: list[Row],
    *,
    minimum: float | None = None,
    maximum: float | None = None,
    effective: bool = True,
) -> list[Row]:
    """
    Keep rows whose ID value lies inside a selected range.

    Args:
        minimum:
            Optional lower bound.
        maximum:
            Optional upper bound.
        effective:
            If True, use ID_effective.
            If False, use ID_planned.
    """
    column = "ID_effective" if effective else "ID_planned"
    result: list[Row] = []

    for row in rows:
        value = _as_float(row.get(column))

        if value is None:
            continue

        if minimum is not None and value < minimum:
            continue

        if maximum is not None and value > maximum:
            continue

        result.append(row)

    return result


def by_mt_range(
    rows: list[Row],
    *,
    minimum_ms: float | None = None,
    maximum_ms: float | None = None,
) -> list[Row]:
    """
    Keep rows whose movement time lies inside a selected range.

    Args:
        minimum_ms:
            Optional lower MT bound in milliseconds.
        maximum_ms:
            Optional upper MT bound in milliseconds.
    """
    result: list[Row] = []

    for row in rows:
        mt_ms = _as_float(row.get("mt_ms"))

        if mt_ms is None:
            continue

        if minimum_ms is not None and mt_ms < minimum_ms:
            continue

        if maximum_ms is not None and mt_ms > maximum_ms:
            continue

        result.append(row)

    return result


def by_column_value(
    rows: list[Row],
    column: str,
    value: Any,
) -> list[Row]:
    """
    Keep rows where one column exactly matches a selected value.

    This is a generic fallback filter for simple custom analyses.
    """
    return [
        row
        for row in rows
        if row.get(column) == value
    ]