"""
Metric access functions for Fitts experiment data.

Responsibility:
Provides scientific accessors such as get_A, get_W, get_ID, get_MT and
get_errors based on cleaned trial rows from the SQLite database.

Important:
This module does not talk directly to Flask.
It uses queries.py as the database access layer.

A and W accessors use calibration.py to choose between px/mm values and to
fallback between units when possible.
"""

from __future__ import annotations

import math

from .calibration import choose_unit_value
from .queries import get_trials


def _column_values(rows: list[dict], column: str) -> list[float]:
    """
    Extract finite numeric values from one column.
    """
    values: list[float] = []

    for row in rows:
        value = row.get(column)

        if value is None:
            continue

        try:
            number = float(value)
        except (TypeError, ValueError):
            continue

        if number != number:
            continue

        if number in (float("inf"), float("-inf")):
            continue

        values.append(number)

    return values


def _unit_values(
    rows: list[dict],
    *,
    px_column: str,
    mm_column: str,
    calibrated: bool,
) -> list[float]:
    """
    Extract unit-aware values with px/mm fallback.

    If calibrated=True:
    - prefer mm_column
    - fallback to px_column * mm_per_px when mm_per_px is available

    If calibrated=False:
    - prefer px_column
    - fallback to mm_column / mm_per_px when mm_per_px is available

    Note:
    mm_per_px must be available in the row for fallback conversion.
    """
    values: list[float] = []

    for row in rows:
        value = choose_unit_value(
            px_value=row.get(px_column),
            mm_value=row.get(mm_column),
            mm_per_px=row.get("mm_per_px"),
            calibrated=calibrated,
        )

        if value is None:
            continue

        try:
            number = float(value)
        except (TypeError, ValueError):
            continue

        if number != number:
            continue

        if number in (float("inf"), float("-inf")):
            continue

        values.append(number)

    return values


def _compute_id_from_a_w(
    a_value: float | None,
    w_value: float | None,
) -> float | None:
    """
    Compute Shannon ID from A and W.

    ID = log2(A / W + 1)
    """
    if a_value is None or w_value is None:
        return None

    try:
        a = float(a_value)
        w = float(w_value)
    except (TypeError, ValueError):
        return None

    if w <= 0:
        return None

    return math.log2((a / w) + 1)


def get_A(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    calibrated: bool = False,
    effective: bool = False,
    summary_only: bool = True,
) -> list[float]:
    """
    Return amplitude values A.

    calibrated=False -> px
    calibrated=True  -> mm

    effective=False -> planned A
    effective=True  -> effective movement distance D
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    if effective:
        return _unit_values(
            rows,
            px_column="D_px_effective",
            mm_column="D_mm_effective",
            calibrated=calibrated,
        )

    return _unit_values(
        rows,
        px_column="A_px_planned",
        mm_column="A_mm_planned",
        calibrated=calibrated,
    )


def get_W(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    calibrated: bool = False,
    effective: bool = False,
    summary_only: bool = True,
) -> list[float]:
    """
    Return target width values W.

    calibrated=False -> px
    calibrated=True  -> mm

    effective=False -> planned W on movement axis
    effective=True  -> effective W on movement axis
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    if effective:
        return _unit_values(
            rows,
            px_column="W_axis_effective_px",
            mm_column="W_axis_effective_mm",
            calibrated=calibrated,
        )

    return _unit_values(
        rows,
        px_column="W_axis_planned_px",
        mm_column="W_axis_planned_mm",
        calibrated=calibrated,
    )


def get_ID(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective: bool = True,
    summary_only: bool = True,
) -> list[float]:
    """
    Return index of difficulty values.

    effective=True returns ID_effective.
    If ID_effective is missing, it is recomputed from:
    D_px_effective and W_axis_effective_px.

    effective=False returns ID_planned.
    If ID_planned is missing, it is recomputed from:
    A_px_planned and W_axis_planned_px.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    column = "ID_effective" if effective else "ID_planned"
    values = _column_values(rows, column)

    if values:
        return values

    computed: list[float] = []

    for row in rows:
        if effective:
            id_value = _compute_id_from_a_w(
                row.get("D_px_effective"),
                row.get("W_axis_effective_px"),
            )
        else:
            id_value = _compute_id_from_a_w(
                row.get("A_px_planned"),
                row.get("W_axis_planned_px"),
            )

        if id_value is not None:
            computed.append(id_value)

    return computed


def get_MT(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
) -> list[float]:
    """
    Return movement times in milliseconds.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    return _column_values(rows, "mt_ms")


def get_errors(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
) -> list[int]:
    """
    Return error counts.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    return [
        int(value)
        for value in _column_values(rows, "errors")
    ]


def get_throughput(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective: bool = True,
    summary_only: bool = True,
) -> list[float]:
    """
    Return throughput values.

    Throughput = ID / MT_seconds
    """
    ids = get_ID(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=effective,
        summary_only=summary_only,
    )

    mts = get_MT(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    values: list[float] = []

    for id_value, mt_ms in zip(ids, mts):
        if mt_ms <= 0:
            continue

        values.append(id_value / (mt_ms / 1000.0))

    return values