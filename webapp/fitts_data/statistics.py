"""
Statistical helpers for the Fitts data framework.

Responsibility:
    Provides reusable descriptive statistics for numeric metric values.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Statistical Helpers

Important:
    This module does not know about participants, sessions, SQLite or Flask.

    It only receives value sequences and returns clean statistical summaries.
    Therefore, it can be reused by quality.py, grouping.py, diagnostics.py,
    regression.py or external analysis scripts.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from statistics import mean as statistics_mean
from statistics import median as statistics_median
from statistics import stdev as sample_stdev
from typing import Any


@dataclass(frozen=True)
class StatisticsSummary:
    """
    Descriptive statistics for one numeric series.

    Attributes:
        count:
            Number of valid numeric values.
        mean:
            Arithmetic mean.
        median:
            Median value.
        std:
            Sample standard deviation. For a single value, this is 0.0.
        minimum:
            Smallest valid value.
        maximum:
            Largest valid value.
        q1:
            First quartile.
        q3:
            Third quartile.
        iqr:
            Interquartile range.
        standard_error:
            Standard error of the mean.
        coefficient_of_variation:
            Relative standard deviation, computed as std / mean.
    """

    count: int
    mean: float | None
    median: float | None
    std: float | None
    minimum: float | None
    maximum: float | None
    q1: float | None = None
    q3: float | None = None
    iqr: float | None = None
    standard_error: float | None = None
    coefficient_of_variation: float | None = None

    def as_dict(self) -> dict[str, Any]:
        """
        Convert the summary to a JSON-friendly dictionary.
        """
        return {
            "count": self.count,
            "mean": self.mean,
            "median": self.median,
            "std": self.std,
            "minimum": self.minimum,
            "maximum": self.maximum,
            "q1": self.q1,
            "q3": self.q3,
            "iqr": self.iqr,
            "standard_error": self.standard_error,
            "coefficient_of_variation": self.coefficient_of_variation,
        }


def _as_finite_float(value: Any) -> float | None:
    """
    Convert a raw value to a finite float.
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


def clean_numeric_values(
    values: Sequence[Any],
) -> list[float]:
    """
    Keep only valid finite numeric values.
    """
    cleaned: list[float] = []

    for value in values:
        number = _as_finite_float(value)

        if number is None:
            continue

        cleaned.append(number)

    return cleaned


def percentile(
    values: Sequence[Any],
    p: float,
) -> float | None:
    """
    Return a percentile using linear interpolation.

    Args:
        values:
            Raw numeric values.
        p:
            Percentile as a value between 0.0 and 1.0.
            Example: 0.25 for Q1, 0.75 for Q3.

    Returns:
        Percentile value, or None if no valid values exist.
    """
    cleaned = sorted(clean_numeric_values(values))

    if not cleaned:
        return None

    if len(cleaned) == 1:
        return cleaned[0]

    if p < 0.0 or p > 1.0:
        raise ValueError("p must be between 0.0 and 1.0.")

    position = (len(cleaned) - 1) * p
    lower_index = math.floor(position)
    upper_index = math.ceil(position)

    if lower_index == upper_index:
        return cleaned[lower_index]

    lower_value = cleaned[lower_index]
    upper_value = cleaned[upper_index]
    weight = position - lower_index

    return lower_value + (upper_value - lower_value) * weight


def describe(
    values: Sequence[Any],
) -> StatisticsSummary:
    """
    Return descriptive statistics for one numeric value sequence.

    Invalid values are ignored before the statistics are computed.
    """
    cleaned = clean_numeric_values(values)

    if not cleaned:
        return StatisticsSummary(
            count=0,
            mean=None,
            median=None,
            std=None,
            minimum=None,
            maximum=None,
            q1=None,
            q3=None,
            iqr=None,
            standard_error=None,
            coefficient_of_variation=None,
        )

    count = len(cleaned)
    mean_value = statistics_mean(cleaned)
    median_value = statistics_median(cleaned)
    std_value = sample_stdev(cleaned) if count > 1 else 0.0

    q1 = percentile(cleaned, 0.25)
    q3 = percentile(cleaned, 0.75)
    iqr = None if q1 is None or q3 is None else q3 - q1

    standard_error = (
        std_value / math.sqrt(count)
        if count > 0 and std_value is not None
        else None
    )

    coefficient_of_variation = (
        std_value / mean_value
        if mean_value != 0
        else None
    )

    return StatisticsSummary(
        count=count,
        mean=mean_value,
        median=median_value,
        std=std_value,
        minimum=min(cleaned),
        maximum=max(cleaned),
        q1=q1,
        q3=q3,
        iqr=iqr,
        standard_error=standard_error,
        coefficient_of_variation=coefficient_of_variation,
    )


def iqr_outlier_bounds(
    values: Sequence[Any],
    *,
    multiplier: float = 1.5,
) -> dict[str, float | None]:
    """
    Return lower and upper outlier bounds based on the IQR method.
    """
    cleaned = clean_numeric_values(values)

    if not cleaned:
        return {
            "lower_bound": None,
            "upper_bound": None,
            "q1": None,
            "q3": None,
            "iqr": None,
        }

    q1 = percentile(cleaned, 0.25)
    q3 = percentile(cleaned, 0.75)

    if q1 is None or q3 is None:
        return {
            "lower_bound": None,
            "upper_bound": None,
            "q1": q1,
            "q3": q3,
            "iqr": None,
        }

    iqr = q3 - q1

    return {
        "lower_bound": q1 - multiplier * iqr,
        "upper_bound": q3 + multiplier * iqr,
        "q1": q1,
        "q3": q3,
        "iqr": iqr,
    }


def detect_outliers_iqr(
    values: Sequence[Any],
    *,
    multiplier: float = 1.5,
) -> list[float]:
    """
    Return values classified as outliers using the IQR method.
    """
    cleaned = clean_numeric_values(values)
    bounds = iqr_outlier_bounds(cleaned, multiplier=multiplier)

    lower = bounds["lower_bound"]
    upper = bounds["upper_bound"]

    if lower is None or upper is None:
        return []

    return [
        value
        for value in cleaned
        if value < lower or value > upper
    ]


def count_outliers_iqr(
    values: Sequence[Any],
    *,
    multiplier: float = 1.5,
) -> int:
    """
    Return the number of IQR outliers.
    """
    return len(
        detect_outliers_iqr(
            values,
            multiplier=multiplier,
        )
    )