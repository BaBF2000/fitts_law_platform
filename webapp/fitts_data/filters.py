"""
Filtering helpers for Fitts experiment data.

Responsibility:
Provides reusable filtering operations on trial rows.

Important:
Filters operate on already loaded trial dictionaries and do not perform
database queries themselves.
"""

from __future__ import annotations


def valid_hits(
    rows: list[dict],
) -> list[dict]:
    """
    Keep only valid hits.
    """
    return [
        row
        for row in rows
        if row.get("hit_valid") == 1
    ]


def trial_summaries(
    rows: list[dict],
) -> list[dict]:
    """
    Keep only summary rows.
    """
    return [
        row
        for row in rows
        if row.get("trial_summary") == 1
    ]


def interactions(
    rows: list[dict],
) -> list[dict]:
    """
    Keep only interaction rows.
    """
    return [
        row
        for row in rows
        if row.get("trial_summary") != 1
    ]


def without_errors(
    rows: list[dict],
) -> list[dict]:
    """
    Remove rows containing errors.
    """
    return [
        row
        for row in rows
        if int(row.get("errors", 0)) == 0
    ]


def by_shape(
    rows: list[dict],
    shape: str,
) -> list[dict]:
    """
    Keep rows matching a target shape.
    """
    return [
        row
        for row in rows
        if row.get("target_shape") == shape
    ]


def by_param_mode(
    rows: list[dict],
    mode: str,
) -> list[dict]:
    """
    Keep rows matching a parameter mode.
    """
    return [
        row
        for row in rows
        if row.get("param_mode") == mode
    ]