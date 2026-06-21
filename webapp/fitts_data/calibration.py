"""
Calibration helpers for Fitts experiment data.

Responsibility:
    Provides conversion helpers between pixel-based and millimetre-based values.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Calibration Helpers

Important:
    The database can store both pixel-based and millimetre-based values for
    planned and effective experiment parameters.

    These helpers centralise the fallback behaviour when one unit is missing.
    This keeps metric modules such as metrics.py simple and avoids duplicated
    conversion logic.
"""

from __future__ import annotations

import math
from typing import Any


def _as_finite_float(value: Any) -> float | None:
    """
    Convert a raw value to a finite float.

    Args:
        value:
            Raw value from the database or from a computed metric.

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


def px_to_mm(
    value_px: Any,
    mm_per_px: Any,
) -> float | None:
    """
    Convert pixels to millimetres.

    Args:
        value_px:
            Pixel-based value.
        mm_per_px:
            Calibration factor in millimetres per pixel.

    Returns:
        The converted value in millimetres, or None if the conversion cannot
        be performed.
    """
    px = _as_finite_float(value_px)
    factor = _as_finite_float(mm_per_px)

    if px is None or factor is None:
        return None

    return px * factor


def mm_to_px(
    value_mm: Any,
    mm_per_px: Any,
) -> float | None:
    """
    Convert millimetres to pixels.

    Args:
        value_mm:
            Millimetre-based value.
        mm_per_px:
            Calibration factor in millimetres per pixel.

    Returns:
        The converted value in pixels, or None if the conversion cannot be
        performed.
    """
    mm = _as_finite_float(value_mm)
    factor = _as_finite_float(mm_per_px)

    if mm is None or factor is None:
        return None

    if factor <= 0:
        return None

    return mm / factor


def choose_unit_value(
    *,
    px_value: Any,
    mm_value: Any,
    mm_per_px: Any,
    calibrated: bool,
) -> float | None:
    """
    Return the requested unit value with fallback conversion.

    Behaviour:
        calibrated=True:
            Prefer the millimetre value.
            If it is missing, derive it from the pixel value using mm_per_px.

        calibrated=False:
            Prefer the pixel value.
            If it is missing, derive it from the millimetre value using
            mm_per_px.

    Args:
        px_value:
            Pixel-based value.
        mm_value:
            Millimetre-based value.
        mm_per_px:
            Calibration factor in millimetres per pixel.
        calibrated:
            If True, return millimetre values.
            If False, return pixel values.

    Returns:
        A value in the requested unit, or None if neither the direct value nor
        the fallback conversion is available.
    """
    px = _as_finite_float(px_value)
    mm = _as_finite_float(mm_value)

    if calibrated:
        if mm is not None:
            return mm

        return px_to_mm(
            value_px=px,
            mm_per_px=mm_per_px,
        )

    if px is not None:
        return px

    return mm_to_px(
        value_mm=mm,
        mm_per_px=mm_per_px,
    )