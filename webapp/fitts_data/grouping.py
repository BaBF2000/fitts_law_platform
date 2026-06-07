"""
Grouping helpers for Fitts experiment data.

Responsibility:
Groups trial rows by experimental conditions such as ID, A, W, target shape
or parameter mode.

Important:
Grouping is useful for scientific analysis, for example comparing movement
times per ID level or per target shape.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .queries import get_trials
from .statistics import describe, StatisticsSummary
from .metrics import (
    get_A,
    get_W,
    get_ID,
)

def _group_rows_by_metric_values(
    rows: list[dict[str, Any]],
    values: list[float],
    *,
    decimals: int | None = None,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by externally computed metric values.

    This is useful when the metric may be computed from multiple database
    columns, for example ID computed from A and W when ID is missing.
    """
    groups: dict[Any, list[dict[str, Any]]] = defaultdict(list)

    for row, value in zip(rows, values):
        if value is None:
            continue

        key: Any = value

        if decimals is not None:
            try:
                key = round(float(value), decimals)
            except (TypeError, ValueError):
                continue

        groups[key].append(row)

    return dict(groups)

def _group_rows_by_column(
    rows: list[dict[str, Any]],
    column: str,
    *,
    decimals: int | None = None,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by one column.

    If decimals is provided, numeric values are rounded before grouping.
    """
    groups: dict[Any, list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        value = row.get(column)

        if value is None:
            continue

        if decimals is not None:
            try:
                value = round(float(value), decimals)
            except (TypeError, ValueError):
                continue

        groups[value].append(row)

    return dict(groups)


def group_by_ID(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective: bool = True,
    summary_only: bool = True,
    decimals: int = 2,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by ID value.

    Uses metrics.get_ID(), so ID can be read from the database or recomputed
    from A and W if missing.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    values = get_ID(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=effective,
        summary_only=summary_only,
    )

    return _group_rows_by_metric_values(
        rows,
        values,
        decimals=decimals,
    )


def group_by_A(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    calibrated: bool = False,
    effective: bool = False,
    summary_only: bool = True,
    decimals: int = 2,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by amplitude A.

    calibrated=False -> px
    calibrated=True  -> mm
    effective=False -> planned A
    effective=True  -> effective movement distance
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    if effective:
        column = "D_mm_effective" if calibrated else "D_px_effective"
    else:
        column = "A_mm_planned" if calibrated else "A_px_planned"

    return _group_rows_by_column(
        rows,
        column,
        decimals=decimals,
    )


def group_by_W(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    calibrated: bool = False,
    effective: bool = False,
    summary_only: bool = True,
    decimals: int = 2,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by width W.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    if effective:
        column = "W_axis_effective_mm" if calibrated else "W_axis_effective_px"
    else:
        column = "W_axis_planned_mm" if calibrated else "W_axis_planned_px"

    return _group_rows_by_column(
        rows,
        column,
        decimals=decimals,
    )


def group_by_shape(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by target shape.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    return _group_rows_by_column(
        rows,
        "target_shape",
    )


def group_by_param_mode(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by parameter mode.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    return _group_rows_by_column(
        rows,
        "param_mode",
    )


def describe_MT_by_group(
    groups: dict[Any, list[dict[str, Any]]],
) -> dict[Any, StatisticsSummary]:
    """
    Compute MT statistics for each row group.
    """
    result: dict[Any, StatisticsSummary] = {}

    for key, rows in groups.items():
        values = [
            row.get("mt_ms")
            for row in rows
        ]

        result[key] = describe(values)

    return result