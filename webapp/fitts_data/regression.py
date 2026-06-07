"""
Regression helpers for Fitts experiment data.

Responsibility:
Provides simple linear regression for Fitts' law analysis.

Important:
This module uses only the Python standard library.
No NumPy or Pandas dependency is required.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .metrics import get_ID, get_MT


@dataclass(frozen=True)
class LinearRegressionResult:
    """
    Result of a simple linear regression y = intercept + slope * x.
    """

    intercept: float | None
    slope: float | None
    r_squared: float | None
    n: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "intercept": self.intercept,
            "slope": self.slope,
            "r_squared": self.r_squared,
            "n": self.n,
        }


def linear_regression(
    x_values: list[float],
    y_values: list[float],
) -> LinearRegressionResult:
    """
    Fit y = intercept + slope * x.
    """
    pairs = [
        (float(x), float(y))
        for x, y in zip(x_values, y_values)
        if x is not None and y is not None
    ]

    n = len(pairs)

    if n < 2:
        return LinearRegressionResult(None, None, None, n)

    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]

    x_mean = sum(xs) / n
    y_mean = sum(ys) / n

    ss_xx = sum((x - x_mean) ** 2 for x in xs)
    ss_xy = sum((x - x_mean) * (y - y_mean) for x, y in pairs)

    if ss_xx == 0:
        return LinearRegressionResult(None, None, None, n)

    slope = ss_xy / ss_xx
    intercept = y_mean - slope * x_mean

    y_pred = [
        intercept + slope * x
        for x in xs
    ]

    ss_res = sum(
        (y - yp) ** 2
        for y, yp in zip(ys, y_pred)
    )

    ss_tot = sum(
        (y - y_mean) ** 2
        for y in ys
    )

    r_squared = None if ss_tot == 0 else 1 - (ss_res / ss_tot)

    return LinearRegressionResult(
        intercept=intercept,
        slope=slope,
        r_squared=r_squared,
        n=n,
    )


def fit_fitts_law(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective_id: bool = True,
    summary_only: bool = True,
) -> LinearRegressionResult:
    """
    Fit the Fitts' law relation:

    MT = a + b * ID

    Returns:
    - intercept a
    - slope b
    - r_squared
    - number of points
    """
    ids = get_ID(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=effective_id,
        summary_only=summary_only,
    )

    mts = get_MT(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    return linear_regression(
        x_values=ids,
        y_values=mts,
    )