"""
Interaction-level helpers for Fitts experiment data.

Responsibility:
    Provides accessors, descriptive statistics and diagnostics for interaction
    rows inside trials.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Interaction Layer

Important:
    Interaction rows are rows where trial_summary is NULL or 0.
    Trial summary rows are rows where trial_summary = 1.

    Interaction-level analysis is useful for studying learning, habituation,
    repetition effects and possible fatigue. For example, if each trial contains
    multiple repeated interactions, the framework can compare movement time
    between interaction 1 and interaction 10.

Interpretation note:
    Decreasing MT over repeated interactions can indicate habituation or motor
    learning. Increasing MT over time can indicate fatigue, loss of attention or
    increased difficulty. These interpretations should always be checked
    together with error rate and valid hit rate.
"""

from __future__ import annotations

import math
from collections import defaultdict
from statistics import mean
from typing import Any

from .queries import get_session, get_trials
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


def _as_int(value: Any) -> int | None:
    """
    Convert a raw value to int if possible.

    Args:
        value:
            Raw value from a database row.

    Returns:
        Integer value, or None if conversion is not possible.
    """
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_mean(values: list[float]) -> float | None:
    """
    Return the arithmetic mean of a list, or None if the list is empty.
    """
    return mean(values) if values else None


def _percentage_change(
    first_value: float | None,
    last_value: float | None,
) -> float | None:
    """
    Compute percentage change from first value to last value.

    Negative values mean that the last value is smaller than the first value.

    Args:
        first_value:
            Initial value.
        last_value:
            Final value.

    Returns:
        Percentage change, or None if it cannot be computed.
    """
    if first_value is None or last_value is None:
        return None

    if first_value <= 0:
        return None

    return ((last_value - first_value) / first_value) * 100.0


def _linear_slope(
    pairs: list[tuple[float, float]],
) -> float | None:
    """
    Compute the slope of y over x using simple linear regression.

    Args:
        pairs:
            List of aligned (x, y) pairs.

    Returns:
        Slope value, or None if it cannot be computed.
    """
    clean_pairs = [
        (x, y)
        for x, y in pairs
        if math.isfinite(x) and math.isfinite(y)
    ]

    n = len(clean_pairs)

    if n < 2:
        return None

    xs = [pair[0] for pair in clean_pairs]
    ys = [pair[1] for pair in clean_pairs]

    x_mean = sum(xs) / n
    y_mean = sum(ys) / n

    ss_xx = sum(
        (x - x_mean) ** 2
        for x in xs
    )

    if ss_xx == 0:
        return None

    ss_xy = sum(
        (x - x_mean) * (y - y_mean)
        for x, y in clean_pairs
    )

    return ss_xy / ss_xx


def get_interactions(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    trial_no: int | None = None,
    valid_only: bool = False,
) -> list[dict[str, Any]]:
    """
    Return interaction rows for one session.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.
        trial_no:
            Optional trial number. If provided, only interactions belonging to
            this trial are returned.
        valid_only:
            If True, only valid hit rows are returned.

    Returns:
        A list of interaction rows.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=False,
        valid_only=valid_only,
    )

    if trial_no is None:
        return rows

    return [
        row
        for row in rows
        if _as_int(row.get("trial_no")) == trial_no
    ]


def get_trial_summaries(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> list[dict[str, Any]]:
    """
    Return trial summary rows.

    Trial summary rows contain one aggregated row per trial.
    """
    return get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=True,
    )


def group_interactions_by_trial(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[int, list[dict[str, Any]]]:
    """
    Group interaction rows by trial number.

    Returns:
        Dictionary mapping trial numbers to interaction rows.
    """
    rows = get_interactions(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    groups: dict[int, list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        trial_no = _as_int(row.get("trial_no"))

        if trial_no is None:
            continue

        groups[trial_no].append(row)

    return dict(groups)


def get_interaction_counts_per_trial(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[int, int]:
    """
    Return the number of interaction rows per trial.
    """
    groups = group_interactions_by_trial(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    return {
        trial_no: len(rows)
        for trial_no, rows in groups.items()
    }


def mean_interactions_per_trial(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> float | None:
    """
    Return the mean number of interactions per trial.
    """
    counts = get_interaction_counts_per_trial(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    if not counts:
        return None

    return mean(counts.values())


def get_expected_interactions_per_trial(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> int | None:
    """
    Return the expected interaction count from session metadata.
    """
    session_row = get_session(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not session_row:
        return None

    return _as_int(session_row.get("interactions_per_trial"))


def describe_interaction_MT(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> StatisticsSummary:
    """
    Return descriptive statistics for interaction-level movement times.
    """
    rows = get_interactions(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    values = [
        row.get("mt_ms")
        for row in rows
    ]

    return describe(values)


def get_interaction_MT_by_number(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[int, list[float]]:
    """
    Return movement-time values grouped by interaction number.

    This is useful for checking whether repeated interactions become faster.
    For example, interaction 1 can be compared with interaction 10.
    """
    rows = get_interactions(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    groups: dict[int, list[float]] = defaultdict(list)

    for row in rows:
        interaction_no = _as_int(row.get("interaction_no"))
        mt_ms = _as_finite_float(row.get("mt_ms"))

        if interaction_no is None or mt_ms is None:
            continue

        groups[interaction_no].append(mt_ms)

    return dict(groups)


def get_mean_MT_by_interaction_number(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[int, float | None]:
    """
    Return mean MT for each interaction number.

    Example:
        {
            1: 820.4,
            2: 770.1,
            ...
            10: 690.5
        }

    Interpretation:
        A decreasing sequence can indicate habituation or motor learning.
    """
    groups = get_interaction_MT_by_number(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    return {
        interaction_no: _safe_mean(values)
        for interaction_no, values in groups.items()
    }


def describe_MT_by_interaction_number(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[int, StatisticsSummary]:
    """
    Return MT statistics for each interaction number.
    """
    groups = get_interaction_MT_by_number(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    return {
        interaction_no: describe(values)
        for interaction_no, values in groups.items()
    }


def interaction_learning_effect(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    first_interaction: int = 1,
    last_interaction: int | None = None,
    valid_only: bool = False,
) -> dict[str, Any]:
    """
    Compare early and late interaction movement times.

    This function is designed to detect a simple repetition effect inside
    trials. For example, it can compare interaction 1 with interaction 10.

    Args:
        first_interaction:
            Interaction number used as the start point.
        last_interaction:
            Interaction number used as the end point. If None, the highest
            available interaction number is used.
        valid_only:
            If True, only valid hits are considered.

    Returns:
        Dictionary with absolute and relative MT change.
    """
    means = get_mean_MT_by_interaction_number(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    if not means:
        return {
            "ok": False,
            "reason": "No interaction MT values found.",
            "first_interaction": first_interaction,
            "last_interaction": last_interaction,
        }

    if last_interaction is None:
        last_interaction = max(means)

    first_mean = means.get(first_interaction)
    last_mean = means.get(last_interaction)

    change_pct = _percentage_change(first_mean, last_mean)

    if first_mean is None or last_mean is None or change_pct is None:
        return {
            "ok": False,
            "reason": "Missing first or last interaction mean.",
            "first_interaction": first_interaction,
            "last_interaction": last_interaction,
            "first_mean_mt_ms": first_mean,
            "last_mean_mt_ms": last_mean,
        }

    absolute_change = last_mean - first_mean

    if change_pct < -5:
        interpretation = "faster_late_interactions"
    elif change_pct > 5:
        interpretation = "slower_late_interactions"
    else:
        interpretation = "stable_interaction_times"

    return {
        "ok": True,
        "first_interaction": first_interaction,
        "last_interaction": last_interaction,
        "first_mean_mt_ms": first_mean,
        "last_mean_mt_ms": last_mean,
        "absolute_change_ms": absolute_change,
        "percent_change": change_pct,
        "interpretation": interpretation,
    }


def describe_interaction_learning_trend(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[str, Any]:
    """
    Describe the MT trend across interaction numbers.

    The trend is computed from mean MT per interaction number.

    Returns:
        Dictionary containing:
            - mean MT by interaction number
            - slope in ms per interaction
            - first-to-last percentage change
            - interpretation
    """
    means = get_mean_MT_by_interaction_number(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    pairs: list[tuple[float, float]] = []

    for interaction_no, mt_ms in means.items():
        if mt_ms is None:
            continue

        pairs.append((float(interaction_no), mt_ms))

    slope = _linear_slope(pairs)

    if not means or slope is None:
        return {
            "ok": False,
            "reason": "Not enough interaction levels for trend analysis.",
            "mean_mt_by_interaction_number": means,
            "slope_ms_per_interaction": slope,
        }

    first_no = min(means)
    last_no = max(means)

    first_mean = means.get(first_no)
    last_mean = means.get(last_no)
    change_pct = _percentage_change(first_mean, last_mean)

    if slope < -1:
        interpretation = "movement_time_decreases_over_repetitions"
    elif slope > 1:
        interpretation = "movement_time_increases_over_repetitions"
    else:
        interpretation = "movement_time_is_stable_over_repetitions"

    return {
        "ok": True,
        "mean_mt_by_interaction_number": means,
        "first_interaction": first_no,
        "last_interaction": last_no,
        "first_mean_mt_ms": first_mean,
        "last_mean_mt_ms": last_mean,
        "percent_change": change_pct,
        "slope_ms_per_interaction": slope,
        "interpretation": interpretation,
    }


def detect_drastic_MT_drop_within_trials(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
    drop_threshold_pct: float = 30.0,
) -> dict[str, Any]:
    """
    Detect drastic MT decreases inside individual trials.

    This function checks whether movement time becomes much smaller within the
    same trial, for example from interaction 1 to interaction 10.

    Args:
        drop_threshold_pct:
            Minimum percentage decrease required to flag a trial.
            Example: 30.0 means that MT must drop by at least 30 percent.

    Returns:
        Dictionary containing flagged trials and summary information.
    """
    groups = group_interactions_by_trial(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    flagged_trials: list[dict[str, Any]] = []
    analysed_trials = 0

    for trial_no, rows in groups.items():
        ordered_rows = sorted(
            rows,
            key=lambda row: (
                _as_int(row.get("interaction_no")) or 0,
                _as_int(row.get("id")) or 0,
            ),
        )

        sequence: list[tuple[int, float]] = []

        for row in ordered_rows:
            interaction_no = _as_int(row.get("interaction_no"))
            mt_ms = _as_finite_float(row.get("mt_ms"))

            if interaction_no is None or mt_ms is None:
                continue

            sequence.append((interaction_no, mt_ms))

        if len(sequence) < 2:
            continue

        analysed_trials += 1

        first_interaction, first_mt = sequence[0]
        last_interaction, last_mt = sequence[-1]

        total_change_pct = _percentage_change(first_mt, last_mt)

        max_step_drop_pct: float | None = None
        max_step_from: int | None = None
        max_step_to: int | None = None

        for (prev_no, prev_mt), (next_no, next_mt) in zip(
            sequence,
            sequence[1:],
        ):
            step_change_pct = _percentage_change(prev_mt, next_mt)

            if step_change_pct is None:
                continue

            if max_step_drop_pct is None or step_change_pct < max_step_drop_pct:
                max_step_drop_pct = step_change_pct
                max_step_from = prev_no
                max_step_to = next_no

        drastic_total_drop = (
            total_change_pct is not None
            and total_change_pct <= -abs(drop_threshold_pct)
        )

        drastic_step_drop = (
            max_step_drop_pct is not None
            and max_step_drop_pct <= -abs(drop_threshold_pct)
        )

        if drastic_total_drop or drastic_step_drop:
            flagged_trials.append(
                {
                    "trial_no": trial_no,
                    "first_interaction": first_interaction,
                    "last_interaction": last_interaction,
                    "first_mt_ms": first_mt,
                    "last_mt_ms": last_mt,
                    "total_change_pct": total_change_pct,
                    "max_step_drop_pct": max_step_drop_pct,
                    "max_step_from_interaction": max_step_from,
                    "max_step_to_interaction": max_step_to,
                    "drastic_total_drop": drastic_total_drop,
                    "drastic_step_drop": drastic_step_drop,
                }
            )

    return {
        "ok": True,
        "drop_threshold_pct": drop_threshold_pct,
        "analysed_trials": analysed_trials,
        "flagged_trial_count": len(flagged_trials),
        "flagged_trials": flagged_trials,
    }


def describe_MT_trend_across_trials(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
) -> dict[str, Any]:
    """
    Describe whether interaction MT changes over the course of the session.

    This is useful for detecting possible learning or fatigue across trials.

    Interpretation:
        Negative slope:
            MT tends to decrease over trials. This can indicate learning or
            habituation.
        Positive slope:
            MT tends to increase over trials. This can indicate fatigue,
            reduced attention or increasing task difficulty.
    """
    groups = group_interactions_by_trial(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    pairs: list[tuple[float, float]] = []
    mean_mt_by_trial: dict[int, float | None] = {}

    for trial_no, rows in groups.items():
        values: list[float] = []

        for row in rows:
            mt_ms = _as_finite_float(row.get("mt_ms"))

            if mt_ms is None:
                continue

            values.append(mt_ms)

        mean_mt = _safe_mean(values)
        mean_mt_by_trial[trial_no] = mean_mt

        if mean_mt is not None:
            pairs.append((float(trial_no), mean_mt))

    slope = _linear_slope(pairs)

    if slope is None:
        return {
            "ok": False,
            "reason": "Not enough trials for trend analysis.",
            "mean_mt_by_trial": mean_mt_by_trial,
            "slope_ms_per_trial": slope,
        }

    if slope < -1:
        interpretation = "movement_time_decreases_over_trials"
    elif slope > 1:
        interpretation = "movement_time_increases_over_trials"
    else:
        interpretation = "movement_time_is_stable_over_trials"

    return {
        "ok": True,
        "mean_mt_by_trial": mean_mt_by_trial,
        "slope_ms_per_trial": slope,
        "interpretation": interpretation,
    }


def verify_interaction_count(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    expected: int | None = None,
) -> dict[str, Any]:
    """
    Check whether trials contain the expected number of interactions.

    Args:
        expected:
            Expected number of interactions per trial. If None, the value is
            read from session metadata.

    Returns:
        Dictionary with observed interaction counts and warnings.
    """
    if expected is None:
        expected = get_expected_interactions_per_trial(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    counts = get_interaction_counts_per_trial(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not counts:
        return {
            "ok": False,
            "expected": expected,
            "observed": {},
            "warnings": ["No interaction rows found."],
        }

    warnings: list[str] = []

    if expected is not None:
        wrong_trials = [
            trial_no
            for trial_no, count in counts.items()
            if count != expected
        ]

        if wrong_trials:
            warnings.append(
                f"Trials with unexpected interaction count: {wrong_trials}"
            )

    return {
        "ok": not warnings,
        "expected": expected,
        "observed": counts,
        "warnings": warnings,
    }


def robust_interaction_learning_effect(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
    outlier_method: str = "iqr",
    iqr_multiplier: float = 1.5,
) -> dict[str, Any]:
    """
    Analyse interaction-level learning with robust statistics.

    This function compares movement time across interaction numbers using:
        - raw means
        - medians
        - IQR-filtered means

    Interpretation:
        A decrease across interaction numbers can indicate habituation,
        repetition effects or motor learning.

    Important:
        Outliers are not removed silently. The function reports how many
        values were excluded per interaction number.
    """
    groups = get_interaction_MT_by_number(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    if not groups:
        return {
            "ok": False,
            "reason": "No interaction movement-time values found.",
        }

    raw_stats: dict[int, dict[str, Any]] = {}
    cleaned_stats: dict[int, dict[str, Any]] = {}
    outlier_report: dict[int, dict[str, Any]] = {}

    for interaction_no, values in groups.items():
        clean_values = [
            value
            for value in values
            if _as_finite_float(value) is not None
        ]

        raw_summary = describe(clean_values)

        if outlier_method == "iqr":
            q1 = raw_summary.q1
            q3 = raw_summary.q3
            iqr = raw_summary.iqr

            if q1 is None or q3 is None or iqr is None:
                filtered_values = clean_values
                outliers: list[float] = []
                lower = None
                upper = None
            else:
                lower = q1 - iqr_multiplier * iqr
                upper = q3 + iqr_multiplier * iqr

                filtered_values = [
                    value
                    for value in clean_values
                    if lower <= value <= upper
                ]

                outliers = [
                    value
                    for value in clean_values
                    if value < lower or value > upper
                ]
        else:
            filtered_values = clean_values
            outliers = []
            lower = None
            upper = None

        raw_stats[interaction_no] = raw_summary.as_dict()
        cleaned_stats[interaction_no] = describe(filtered_values).as_dict()

        outlier_report[interaction_no] = {
            "raw_count": len(clean_values),
            "cleaned_count": len(filtered_values),
            "outlier_count": len(outliers),
            "lower_bound": lower,
            "upper_bound": upper,
            "outliers": outliers,
        }

    first_interaction = min(groups)
    last_interaction = max(groups)

    raw_first = raw_stats[first_interaction]["mean"]
    raw_last = raw_stats[last_interaction]["mean"]

    cleaned_first = cleaned_stats[first_interaction]["mean"]
    cleaned_last = cleaned_stats[last_interaction]["mean"]

    median_first = raw_stats[first_interaction]["median"]
    median_last = raw_stats[last_interaction]["median"]

    return {
        "ok": True,
        "method": outlier_method,
        "iqr_multiplier": iqr_multiplier,
        "first_interaction": first_interaction,
        "last_interaction": last_interaction,
        "raw_mean_change_pct": _percentage_change(raw_first, raw_last),
        "cleaned_mean_change_pct": _percentage_change(cleaned_first, cleaned_last),
        "median_change_pct": _percentage_change(median_first, median_last),
        "raw_stats": raw_stats,
        "cleaned_stats": cleaned_stats,
        "outlier_report": outlier_report,
    }


def normalised_interaction_learning_effect(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
    baseline: str = "trial_median",
) -> dict[str, Any]:
    """
    Analyse interaction learning after normalising each interaction by its trial.

    This reduces bias caused by globally slower or harder trials.

    Normalisation:
        relative_mt = interaction_mt / baseline_mt_of_same_trial

    Supported baselines:
        trial_median:
            Uses the median MT of the same trial.
        trial_mean:
            Uses the mean MT of the same trial.

    Interpretation:
        Values above 1.0 are slower than the typical interaction in that trial.
        Values below 1.0 are faster than the typical interaction in that trial.
    """
    if baseline not in {"trial_median", "trial_mean"}:
        raise ValueError(
            "baseline must be either 'trial_median' or 'trial_mean'."
        )

    groups = group_interactions_by_trial(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    normalised_by_interaction: dict[int, list[float]] = defaultdict(list)

    for rows in groups.values():
        trial_values: list[float] = []

        for row in rows:
            mt_ms = _as_finite_float(row.get("mt_ms"))

            if mt_ms is not None:
                trial_values.append(mt_ms)

        if not trial_values:
            continue

        if baseline == "trial_mean":
            trial_baseline = sum(trial_values) / len(trial_values)
        else:
            sorted_values = sorted(trial_values)
            middle = len(sorted_values) // 2

            if len(sorted_values) % 2 == 1:
                trial_baseline = sorted_values[middle]
            else:
                trial_baseline = (
                    sorted_values[middle - 1] + sorted_values[middle]
                ) / 2.0

        if trial_baseline <= 0:
            continue

        for row in rows:
            interaction_no = _as_int(row.get("interaction_no"))
            mt_ms = _as_finite_float(row.get("mt_ms"))

            if interaction_no is None or mt_ms is None:
                continue

            normalised_by_interaction[interaction_no].append(
                mt_ms / trial_baseline
            )

    stats = {
        interaction_no: describe(values).as_dict()
        for interaction_no, values in normalised_by_interaction.items()
    }

    if not stats:
        return {
            "ok": False,
            "reason": "No normalised interaction values available.",
        }

    first_interaction = min(stats)
    last_interaction = max(stats)

    first_mean = stats[first_interaction]["mean"]
    last_mean = stats[last_interaction]["mean"]

    first_median = stats[first_interaction]["median"]
    last_median = stats[last_interaction]["median"]

    return {
        "ok": True,
        "baseline": baseline,
        "first_interaction": first_interaction,
        "last_interaction": last_interaction,
        "normalised_stats": stats,
        "first_mean_relative_mt": first_mean,
        "last_mean_relative_mt": last_mean,
        "mean_relative_change_pct": _percentage_change(first_mean, last_mean),
        "first_median_relative_mt": first_median,
        "last_median_relative_mt": last_median,
        "median_relative_change_pct": _percentage_change(first_median, last_median),
    }


def interaction_habituation_report(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
    drop_threshold_pct: float = 30.0,
) -> dict[str, Any]:
    """
    Return a compact report about interaction-level habituation.

    This report combines:
        - interaction count verification
        - raw MT statistics by interaction number
        - raw first-to-last interaction comparison
        - robust first-to-last comparison with outlier reporting
        - trial-normalised interaction comparison
        - drastic MT drop detection within individual trials
        - MT trend across trials

    Returns:
        Dictionary with structured diagnostic information.
    """
    return {
        "interaction_count": verify_interaction_count(
            participant=participant,
            session=session,
            session_id=session_id,
        ),
        "mt_by_interaction_number": {
            key: value.as_dict()
            for key, value in describe_MT_by_interaction_number(
                participant=participant,
                session=session,
                session_id=session_id,
                valid_only=valid_only,
            ).items()
        },
        "learning_effect": interaction_learning_effect(
            participant=participant,
            session=session,
            session_id=session_id,
            valid_only=valid_only,
        ),
        "robust_learning_effect": robust_interaction_learning_effect(
            participant=participant,
            session=session,
            session_id=session_id,
            valid_only=valid_only,
        ),
        "normalised_learning_effect": normalised_interaction_learning_effect(
            participant=participant,
            session=session,
            session_id=session_id,
            valid_only=valid_only,
            baseline="trial_median",
        ),
        "interaction_trend": describe_interaction_learning_trend(
            participant=participant,
            session=session,
            session_id=session_id,
            valid_only=valid_only,
        ),
        "drastic_drops_within_trials": detect_drastic_MT_drop_within_trials(
            participant=participant,
            session=session,
            session_id=session_id,
            valid_only=valid_only,
            drop_threshold_pct=drop_threshold_pct,
        ),
        "trend_across_trials": describe_MT_trend_across_trials(
            participant=participant,
            session=session,
            session_id=session_id,
            valid_only=valid_only,
        ),
    }