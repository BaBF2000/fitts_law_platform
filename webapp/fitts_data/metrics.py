"""
Metric access functions for Fitts experiment data.

Responsibility:
    Provides scientific accessors such as get_A, get_W, get_ID, get_MT,
    get_errors and get_throughput based on cleaned trial rows from the
    SQLite database.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Metric Layer

Important:
    This module does not communicate directly with Flask or with the database
    connection layer. It uses queries.py as the database access layer.

    A and W accessors use calibration.py to choose between pixel and millimetre
    values and to fall back between units when possible.

    This module should only provide metric-level access. More complex
    aggregation should remain in summaries.py, quality.py or regression.py.
"""

from __future__ import annotations
from typing import Any

import math

from .calibration import choose_unit_value
from .queries import get_trials


def _as_finite_float(value: Any) -> float | None:
    """
    Convert a value to float and reject invalid numeric values.

    This helper removes:
    - None values
    - non-numeric values
    - NaN values
    - positive and negative infinity
    """
    if value is None:
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(number):
        return None

    return number


def _column_values(rows: list[dict], column: str) -> list[float]:
    """
    Extract finite numeric values from one column.

    Args:
        rows:
            Trial rows returned by queries.get_trials().
        column:
            Name of the column to extract.

    Returns:
        A list containing only valid finite numeric values.
    """
    values: list[float] = []

    for row in rows:
        number = _as_finite_float(row.get(column))

        if number is None:
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
    Extract unit-aware values with pixel/millimetre fallback.

    Unit logic:
        calibrated=False:
            Prefer pixel values.
            If no pixel value is available, fall back to millimetres converted
            to pixels using mm_per_px.

        calibrated=True:
            Prefer millimetre values.
            If no millimetre value is available, fall back to pixels converted
            to millimetres using mm_per_px.

    Args:
        rows:
            Trial rows returned by queries.get_trials().
        px_column:
            Column containing the pixel-based value.
        mm_column:
            Column containing the millimetre-based value.
        calibrated:
            If True, return millimetre values.
            If False, return pixel values.

    Returns:
        A list of valid numeric values in the requested unit.

    Notes:
        Fallback conversion requires mm_per_px to be available in the row.
    """
    values: list[float] = []

    for row in rows:
        value = choose_unit_value(
            px_value=row.get(px_column),
            mm_value=row.get(mm_column),
            mm_per_px=row.get("mm_per_px"),
            calibrated=calibrated,
        )

        number = _as_finite_float(value)

        if number is None:
            continue

        values.append(number)

    return values


def _compute_id_from_a_w(
    a_value: Any,
    w_value: Any,
) -> float | None:
    """
    Compute the Shannon index of difficulty from A and W.

    Formula:
        ID = log2(A / W + 1)

    Args:
        a_value:
            Movement amplitude or effective movement distance.
        w_value:
            Target width on the movement axis.

    Returns:
        The computed ID value, or None if the input values are invalid.
    """
    a = _as_finite_float(a_value)
    w = _as_finite_float(w_value)

    if a is None or w is None:
        return None

    if w <= 0:
        return None

    return math.log2((a / w) + 1)


def _id_from_row(row: dict, *, effective: bool) -> float | None:
    """
    Return an ID value for one row.

    The function first tries to use the stored ID value from the database.
    If it is missing or invalid, it recomputes the ID from A/W or D/W.

    Args:
        row:
            One trial row.
        effective:
            If True, use effective ID logic.
            If False, use planned ID logic.

    Returns:
        A valid ID value, or None if it cannot be computed.
    """
    if effective:
        stored_id = _as_finite_float(row.get("ID_effective"))

        if stored_id is not None:
            return stored_id

        return _compute_id_from_a_w(
            row.get("D_px_effective"),
            row.get("W_axis_effective_px"),
        )

    stored_id = _as_finite_float(row.get("ID_planned"))

    if stored_id is not None:
        return stored_id

    return _compute_id_from_a_w(
        row.get("A_px_planned"),
        row.get("W_axis_planned_px"),
    )


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

    Unit behaviour:
        calibrated=False:
            Return values in pixels.
        calibrated=True:
            Return values in millimetres.

    Metric behaviour:
        effective=False:
            Return planned amplitude A.
        effective=True:
            Return effective movement distance D.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        calibrated:
            Select millimetre values instead of pixel values.
        effective:
            Select effective movement distance instead of planned amplitude.
        summary_only:
            If True, only use trial-summary rows.

    Returns:
        A list of amplitude or effective-distance values.
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

    Unit behaviour:
        calibrated=False:
            Return values in pixels.
        calibrated=True:
            Return values in millimetres.

    Metric behaviour:
        effective=False:
            Return planned target width on the movement axis.
        effective=True:
            Return effective target width on the movement axis.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        calibrated:
            Select millimetre values instead of pixel values.
        effective:
            Select effective width instead of planned width.
        summary_only:
            If True, only use trial-summary rows.

    Returns:
        A list of target width values.
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

    Behaviour:
        effective=True:
            Prefer ID_effective.
            If missing, recompute from D_px_effective and
            W_axis_effective_px.

        effective=False:
            Prefer ID_planned.
            If missing, recompute from A_px_planned and W_axis_planned_px.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        effective:
            Select effective ID instead of planned ID.
        summary_only:
            If True, only use trial-summary rows.

    Returns:
        A list of valid ID values.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    values: list[float] = []

    for row in rows:
        id_value = _id_from_row(row, effective=effective)

        if id_value is None:
            continue

        values.append(id_value)

    return values


def get_MT(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
) -> list[float]:
    """
    Return movement times in milliseconds.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        summary_only:
            If True, only use trial-summary rows.

    Returns:
        A list of movement time values in milliseconds.
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

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        summary_only:
            If True, only use trial-summary rows.

    Returns:
        A list of integer error counts.
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

    Formula:
        Throughput = ID / MT_seconds

    The computation is performed row by row to keep ID and MT aligned.
    This is safer than computing ID and MT as two independently filtered lists
    and then zipping them together.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        effective:
            If True, use effective ID values.
            If False, use planned ID values.
        summary_only:
            If True, only use trial-summary rows.

    Returns:
        A list of throughput values.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    values: list[float] = []

    for row in rows:
        id_value = _id_from_row(row, effective=effective)
        mt_ms = _as_finite_float(row.get("mt_ms"))

        if id_value is None or mt_ms is None:
            continue

        if mt_ms <= 0:
            continue

        values.append(id_value / (mt_ms / 1000.0))

    return values