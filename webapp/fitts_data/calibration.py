"""
Calibration helpers for Fitts experiment data.

Responsibility:
Provides conversion helpers between pixel-based and millimeter-based values.

Important:
The database stores both planned/effective pixel and millimeter values when
available. These helpers centralize fallback behavior when one unit is missing.
"""

from __future__ import annotations


def px_to_mm(
    value_px: float | None,
    mm_per_px: float | None,
) -> float | None:
    """
    Convert pixels to millimeters.

    Returns None if the value or calibration factor is missing.
    """
    if value_px is None or mm_per_px is None:
        return None

    try:
        return float(value_px) * float(mm_per_px)
    except (TypeError, ValueError):
        return None


def mm_to_px(
    value_mm: float | None,
    mm_per_px: float | None,
) -> float | None:
    """
    Convert millimeters to pixels.

    Returns None if the value or calibration factor is missing.
    """
    if value_mm is None or mm_per_px in (None, 0):
        return None

    try:
        return float(value_mm) / float(mm_per_px)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def choose_unit_value(
    *,
    px_value: float | None,
    mm_value: float | None,
    mm_per_px: float | None,
    calibrated: bool,
) -> float | None:
    """
    Return the requested unit value.

    If calibrated=True:
    - prefer mm_value
    - otherwise derive from px_value using mm_per_px

    If calibrated=False:
    - prefer px_value
    - otherwise derive from mm_value using mm_per_px
    """
    if calibrated:
        if mm_value is not None:
            return float(mm_value)

        return px_to_mm(
            value_px=px_value,
            mm_per_px=mm_per_px,
        )

    if px_value is not None:
        return float(px_value)

    return mm_to_px(
        value_mm=mm_value,
        mm_per_px=mm_per_px,
    )