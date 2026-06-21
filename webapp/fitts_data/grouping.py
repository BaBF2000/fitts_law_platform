"""
Grouping helpers for Fitts experiment data.

Responsibility:
    Groups trial rows by experimental conditions such as ID, A, W, target shape
    or parameter mode.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Grouping Layer

Important:
    Grouping is useful for scientific analysis, for example comparing movement
    times per ID level, amplitude level, target width or target shape.

    Grouping by computed metrics must be done row by row to avoid alignment
    errors between trial rows and separately filtered metric lists.
"""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Callable
from typing import Any

from .calibration import choose_unit_value
from .queries import get_trials
from .statistics import StatisticsSummary, describe


def _as_finite_float(value: Any) -> float | None:
    """
    Convert a raw value to a finite float.

    Args:
        value:
            Raw value from a database row.

    Returns:
        A finite float, or None if the value is missing, invalid, NaN or
        infinite.
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
            Amplitude or effective movement distance.
        w_value:
            Target width on the movement axis.

    Returns:
        Computed ID value, or None if the input values are invalid.
    """
    a = _as_finite_float(a_value)
    w = _as_finite_float(w_value)

    if a is None or w is None:
        return None

    if w <= 0:
        return None

    return math.log2((a / w) + 1)


def _id_from_row(
    row: dict[str, Any],
    *,
    effective: bool,
) -> float | None:
    """
    Return an ID value for one row.

    Stored ID values are preferred. If the stored value is missing, the ID is
    recomputed from the corresponding amplitude/distance and width columns.

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


def _a_from_row(
    row: dict[str, Any],
    *,
    calibrated: bool,
    effective: bool,
) -> float | None:
    """
    Return amplitude or effective movement distance for one row.

    Args:
        row:
            One trial row.
        calibrated:
            If True, return millimetre values.
            If False, return pixel values.
        effective:
            If True, return effective movement distance D.
            If False, return planned amplitude A.

    Returns:
        A numeric value in the requested unit, or None.
    """
    if effective:
        return choose_unit_value(
            px_value=row.get("D_px_effective"),
            mm_value=row.get("D_mm_effective"),
            mm_per_px=row.get("mm_per_px"),
            calibrated=calibrated,
        )

    return choose_unit_value(
        px_value=row.get("A_px_planned"),
        mm_value=row.get("A_mm_planned"),
        mm_per_px=row.get("mm_per_px"),
        calibrated=calibrated,
    )


def _w_from_row(
    row: dict[str, Any],
    *,
    calibrated: bool,
    effective: bool,
) -> float | None:
    """
    Return target width for one row.

    Args:
        row:
            One trial row.
        calibrated:
            If True, return millimetre values.
            If False, return pixel values.
        effective:
            If True, return effective width.
            If False, return planned width.

    Returns:
        A numeric value in the requested unit, or None.
    """
    if effective:
        return choose_unit_value(
            px_value=row.get("W_axis_effective_px"),
            mm_value=row.get("W_axis_effective_mm"),
            mm_per_px=row.get("mm_per_px"),
            calibrated=calibrated,
        )

    return choose_unit_value(
        px_value=row.get("W_axis_planned_px"),
        mm_value=row.get("W_axis_planned_mm"),
        mm_per_px=row.get("mm_per_px"),
        calibrated=calibrated,
    )


def _normalise_group_key(
    value: Any,
    *,
    decimals: int | None = None,
) -> Any:
    """
    Convert a raw grouping value into a stable group key.

    Numeric values can optionally be rounded. Non-numeric values are returned
    unchanged.

    Args:
        value:
            Raw grouping value.
        decimals:
            Number of decimal places for numeric grouping.

    Returns:
        A grouping key, or None if the value is missing or invalid.
    """
    if value is None:
        return None

    if decimals is None:
        return value

    number = _as_finite_float(value)

    if number is None:
        return None

    return round(number, decimals)


def _group_rows_by_value_getter(
    rows: list[dict[str, Any]],
    value_getter: Callable[[dict[str, Any]], Any],
    *,
    decimals: int | None = None,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows using a row-level value getter.

    This helper keeps each computed grouping value aligned with the row from
    which it was derived.

    Args:
        rows:
            Trial rows.
        value_getter:
            Function that extracts or computes the grouping value for one row.
        decimals:
            Optional rounding precision for numeric keys.

    Returns:
        Dictionary mapping group keys to lists of rows.
    """
    groups: dict[Any, list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        value = value_getter(row)
        key = _normalise_group_key(value, decimals=decimals)

        if key is None:
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
    Group rows by one database column.

    Args:
        rows:
            Trial rows.
        column:
            Column name used as group key.
        decimals:
            Optional rounding precision for numeric values.

    Returns:
        Dictionary mapping column values to lists of rows.
    """
    return _group_rows_by_value_getter(
        rows,
        lambda row: row.get(column),
        decimals=decimals,
    )


def group_by_ID(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective: bool = True,
    summary_only: bool = True,
    valid_only: bool = False,
    decimals: int = 2,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by ID value.

    Stored ID values are preferred. If an ID value is missing, it is recomputed
    row by row from A/W or D/W.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        effective:
            If True, group by effective ID.
            If False, group by planned ID.
        summary_only:
            If True, use trial-summary rows.
        valid_only:
            If True, use only valid rows.
        decimals:
            Number of decimal places used for grouping.

    Returns:
        Dictionary mapping ID values to trial rows.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    return _group_rows_by_value_getter(
        rows,
        lambda row: _id_from_row(row, effective=effective),
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
    valid_only: bool = False,
    decimals: int = 2,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by amplitude A or effective movement distance D.

    Behaviour:
        calibrated=False:
            Group by pixel values.
        calibrated=True:
            Group by millimetre values.
        effective=False:
            Group by planned amplitude A.
        effective=True:
            Group by effective movement distance D.

    Returns:
        Dictionary mapping A/D values to trial rows.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    return _group_rows_by_value_getter(
        rows,
        lambda row: _a_from_row(
            row,
            calibrated=calibrated,
            effective=effective,
        ),
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
    valid_only: bool = False,
    decimals: int = 2,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by target width W.

    Behaviour:
        calibrated=False:
            Group by pixel values.
        calibrated=True:
            Group by millimetre values.
        effective=False:
            Group by planned width.
        effective=True:
            Group by effective width.

    Returns:
        Dictionary mapping W values to trial rows.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    return _group_rows_by_value_getter(
        rows,
        lambda row: _w_from_row(
            row,
            calibrated=calibrated,
            effective=effective,
        ),
        decimals=decimals,
    )


def group_by_shape(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
    valid_only: bool = False,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by target shape.

    The function first tries target_shape. If this value is missing, it falls
    back to shape.

    Returns:
        Dictionary mapping target shape values to trial rows.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    return _group_rows_by_value_getter(
        rows,
        lambda row: row.get("target_shape") or row.get("shape"),
    )


def group_by_param_mode(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
    valid_only: bool = False,
) -> dict[Any, list[dict[str, Any]]]:
    """
    Group rows by parameter mode.

    Returns:
        Dictionary mapping parameter modes to trial rows.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    return _group_rows_by_column(
        rows,
        "param_mode",
    )


def describe_MT_by_group(
    groups: dict[Any, list[dict[str, Any]]],
) -> dict[Any, StatisticsSummary]:
    """
    Compute movement-time statistics for each row group.

    Args:
        groups:
            Dictionary mapping group keys to trial rows.

    Returns:
        Dictionary mapping group keys to StatisticsSummary objects.
    """
    result: dict[Any, StatisticsSummary] = {}

    for key, rows in groups.items():
        values = [
            row.get("mt_ms")
            for row in rows
        ]

        result[key] = describe(values)

    return result


def describe_column_by_group(
    groups: dict[Any, list[dict[str, Any]]],
    column: str,
) -> dict[Any, StatisticsSummary]:
    """
    Compute descriptive statistics for one column across row groups.

    Args:
        groups:
            Dictionary mapping group keys to trial rows.
        column:
            Column name to describe.

    Returns:
        Dictionary mapping group keys to StatisticsSummary objects.
    """
    result: dict[Any, StatisticsSummary] = {}

    for key, rows in groups.items():
        values = [
            row.get(column)
            for row in rows
        ]

        result[key] = describe(values)

    return result


def group_counts(
    groups: dict[Any, list[dict[str, Any]]],
) -> dict[Any, int]:
    """
    Return the number of rows in each group.

    Args:
        groups:
            Dictionary mapping group keys to row lists.

    Returns:
        Dictionary mapping group keys to row counts.
    """
    return {
        key: len(rows)
        for key, rows in groups.items()
    }