"""
Regression helpers for Fitts experiment data.

Responsibility:
    Provides simple linear regression utilities for Fitts' Law analysis.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Regression Layer

Important:
    This module uses only the Python standard library.
    No NumPy or Pandas dependency is required.

    Regression is computed from aligned trial rows. This avoids a common
    problem where ID and MT values are extracted as separate filtered lists
    and may no longer refer to the same trials.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from .queries import get_trials


@dataclass(frozen=True)
class LinearRegressionResult:
    """
    Result of a simple linear regression.

    Model:
        y = intercept + slope * x

    In the Fitts' Law context:
        MT = a + b * ID

    Attributes:
        intercept:
            Regression intercept. In Fitts' Law, this corresponds to parameter a.
        slope:
            Regression slope. In Fitts' Law, this corresponds to parameter b.
        r_squared:
            Coefficient of determination.
        n:
            Number of valid data points used for the regression.
    """

    intercept: float | None
    slope: float | None
    r_squared: float | None
    n: int

    @property
    def is_valid(self) -> bool:
        """
        Return True if the regression produced usable coefficients.
        """
        return self.intercept is not None and self.slope is not None

    @property
    def throughput_bits_per_s(self) -> float | None:
        """
        Return slope-based throughput in bits per second.

        This value is derived from the regression slope.

        Notes:
            If the slope is expressed in milliseconds per bit, throughput is:

                throughput = 1000 / slope

            This is a slope-based estimate and should not be confused with
            row-wise throughput values computed in metrics.py.
        """
        if self.slope is None:
            return None

        if self.slope <= 0:
            return None

        return 1000.0 / self.slope

    def predict(self, x_value: float) -> float | None:
        """
        Predict y for one x value.

        Args:
            x_value:
                Input value, for example an ID value.

        Returns:
            Predicted y value, or None if the regression is invalid.
        """
        if self.intercept is None or self.slope is None:
            return None

        return self.intercept + self.slope * x_value

    def as_dict(self) -> dict[str, Any]:
        """
        Convert the regression result to a JSON-friendly dictionary.
        """
        return {
            "intercept": self.intercept,
            "slope": self.slope,
            "r_squared": self.r_squared,
            "n": self.n,
            "throughput_bits_per_s": self.throughput_bits_per_s,
        }


def _as_finite_float(value: Any) -> float | None:
    """
    Convert a raw value to a finite float.

    Args:
        value:
            Raw value from a database row or a computed metric.

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


def _id_from_row(row: dict[str, Any], *, effective: bool) -> float | None:
    """
    Return an ID value for one trial row.

    The function first tries to use the stored ID value. If it is missing,
    it recomputes the ID from the corresponding A/W or D/W values.

    Args:
        row:
            One trial row returned by queries.get_trials().
        effective:
            If True, use effective ID logic.
            If False, use planned ID logic.

    Returns:
        A valid ID value, or None if it cannot be determined.
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


def _regression_pairs_from_rows(
    rows: list[dict[str, Any]],
    *,
    effective_id: bool,
) -> list[tuple[float, float]]:
    """
    Extract aligned ID/MT pairs from trial rows.

    Args:
        rows:
            Trial rows returned by queries.get_trials().
        effective_id:
            If True, use effective ID values.
            If False, use planned ID values.

    Returns:
        A list of valid (ID, MT) pairs.
    """
    pairs: list[tuple[float, float]] = []

    for row in rows:
        id_value = _id_from_row(row, effective=effective_id)
        mt_ms = _as_finite_float(row.get("mt_ms"))

        if id_value is None or mt_ms is None:
            continue

        pairs.append((id_value, mt_ms))

    return pairs


def linear_regression(
    x_values: Sequence[Any],
    y_values: Sequence[Any],
) -> LinearRegressionResult:
    """
    Fit a simple linear regression.

    Model:
        y = intercept + slope * x

    Args:
        x_values:
            Input values.
        y_values:
            Output values.

    Returns:
        A LinearRegressionResult object.

    Notes:
        Values are paired with zip(). If the two sequences have different
        lengths, extra values are ignored.
    """
    pairs: list[tuple[float, float]] = []

    for x_raw, y_raw in zip(x_values, y_values):
        x = _as_finite_float(x_raw)
        y = _as_finite_float(y_raw)

        if x is None or y is None:
            continue

        pairs.append((x, y))

    return linear_regression_from_pairs(pairs)


def linear_regression_from_pairs(
    pairs: Sequence[tuple[float, float]],
) -> LinearRegressionResult:
    """
    Fit a simple linear regression from already aligned x/y pairs.

    Args:
        pairs:
            Sequence of aligned numeric pairs.

    Returns:
        A LinearRegressionResult object.
    """
    clean_pairs = [
        (x, y)
        for x, y in pairs
        if math.isfinite(x) and math.isfinite(y)
    ]

    n = len(clean_pairs)

    if n < 2:
        return LinearRegressionResult(None, None, None, n)

    xs = [pair[0] for pair in clean_pairs]
    ys = [pair[1] for pair in clean_pairs]

    x_mean = sum(xs) / n
    y_mean = sum(ys) / n

    ss_xx = sum(
        (x - x_mean) ** 2
        for x in xs
    )

    ss_xy = sum(
        (x - x_mean) * (y - y_mean)
        for x, y in clean_pairs
    )

    # A regression line cannot be fitted if all x values are identical.
    if ss_xx == 0:
        return LinearRegressionResult(None, None, None, n)

    slope = ss_xy / ss_xx
    intercept = y_mean - slope * x_mean

    predicted_y = [
        intercept + slope * x
        for x in xs
    ]

    ss_res = sum(
        (y - y_hat) ** 2
        for y, y_hat in zip(ys, predicted_y)
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
    valid_only: bool = False,
) -> LinearRegressionResult:
    """
    Fit the Fitts' Law relation for one session.

    Model:
        MT = a + b * ID

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        effective_id:
            If True, use effective ID values.
            If False, use planned ID values.
        summary_only:
            If True, only use trial-summary rows.
        valid_only:
            If True, only use rows marked as valid hits.

    Returns:
        A LinearRegressionResult containing:
            - intercept a
            - slope b
            - r_squared
            - number of valid data points
            - slope-based throughput in bits per second via as_dict()
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    pairs = _regression_pairs_from_rows(
        rows,
        effective_id=effective_id,
    )

    return linear_regression_from_pairs(pairs)

def regression_residuals_from_pairs(
    pairs: Sequence[tuple[float, float]],
) -> list[dict[str, float]]:
    """
    Return residuals for aligned x/y pairs.

    Residual:
        residual = observed_y - predicted_y

    Args:
        pairs:
            Sequence of aligned numeric pairs.

    Returns:
        List of dictionaries containing x, observed_y, predicted_y and residual.
    """
    fit = linear_regression_from_pairs(pairs)

    if fit.intercept is None or fit.slope is None:
        return []

    residuals: list[dict[str, float]] = []

    for x_value, observed_y in pairs:
        predicted_y = fit.intercept + fit.slope * x_value
        residual = observed_y - predicted_y

        residuals.append(
            {
                "x": x_value,
                "observed_y": observed_y,
                "predicted_y": predicted_y,
                "residual": residual,
            }
        )

    return residuals


def regression_error_metrics_from_pairs(
    pairs: Sequence[tuple[float, float]],
) -> dict[str, float | int | None]:
    """
    Return regression error metrics for aligned x/y pairs.

    Metrics:
        MAE:
            Mean absolute error.
        RMSE:
            Root mean squared error.
        mean_residual:
            Average signed residual.
    """
    residual_rows = regression_residuals_from_pairs(pairs)

    if not residual_rows:
        return {
            "n": 0,
            "mae": None,
            "rmse": None,
            "mean_residual": None,
            "residual_std": None,
        }

    residuals = [
        row["residual"]
        for row in residual_rows
    ]

    n = len(residuals)

    mae = sum(
        abs(value)
        for value in residuals
    ) / n

    rmse = math.sqrt(
        sum(
            value**2
            for value in residuals
        ) / n
    )

    mean_residual = sum(residuals) / n

    if n > 1:
        residual_mean = mean_residual
        residual_std = math.sqrt(
            sum(
                (value - residual_mean) ** 2
                for value in residuals
            ) / (n - 1)
        )
    else:
        residual_std = 0.0

    return {
        "n": n,
        "mae": mae,
        "rmse": rmse,
        "mean_residual": mean_residual,
        "residual_std": residual_std,
    }


def fitts_law_residuals(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective_id: bool = True,
    summary_only: bool = True,
    valid_only: bool = False,
) -> list[dict[str, float]]:
    """
    Return residuals for the Fitts' Law model.

    Model:
        MT = a + b * ID

    Returns:
        List of residual rows containing ID, observed MT, predicted MT and
        residual MT.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    pairs = _regression_pairs_from_rows(
        rows,
        effective_id=effective_id,
    )

    residual_rows = regression_residuals_from_pairs(pairs)

    return [
        {
            "ID": row["x"],
            "observed_MT_ms": row["observed_y"],
            "predicted_MT_ms": row["predicted_y"],
            "residual_MT_ms": row["residual"],
        }
        for row in residual_rows
    ]


def fitts_law_error_metrics(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective_id: bool = True,
    summary_only: bool = True,
    valid_only: bool = False,
) -> dict[str, float | int | None]:
    """
    Return error metrics for the Fitts' Law regression.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    pairs = _regression_pairs_from_rows(
        rows,
        effective_id=effective_id,
    )

    return regression_error_metrics_from_pairs(pairs)