"""
Statistical helpers for the Fitts data framework.

Responsibility:
Provides reusable descriptive statistics for metric values.

Important:
This module does not know about participants, sessions or SQLite.
It only receives numeric lists and returns clean statistical summaries.
"""

from __future__ import annotations
from collections.abc import Sequence
from dataclasses import dataclass
from statistics import mean, median, stdev
from typing import Any


@dataclass(frozen=True)
class StatisticsSummary:
    """
    Descriptive statistics for one numeric series.
    """

    count: int
    mean: float | None
    median: float | None
    std: float | None
    minimum: float | None
    maximum: float | None

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
        }


def clean_numeric_values(
    values: Sequence[float | int | None],
) -> list[float]:
    """
    Keep only valid finite numeric values.
    """
    cleaned: list[float] = []

    for value in values:
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

        cleaned.append(number)

    return cleaned


def describe(
    values: Sequence[float | int | None],
) -> StatisticsSummary:
    """
    Return descriptive statistics for one numeric list.
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
        )

    return StatisticsSummary(
        count=len(cleaned),
        mean=mean(cleaned),
        median=median(cleaned),
        std=stdev(cleaned) if len(cleaned) > 1 else 0.0,
        minimum=min(cleaned),
        maximum=max(cleaned),
    )