"""
Plot helpers for the Fitts data framework.

Responsibility:
    Provides optional matplotlib plots for scientific analysis.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Plot Layer

Important:
    Matplotlib is imported inside functions so the core framework stays usable
    without plotting dependencies.

    Plotting functions do not modify data. They only visualise already stored
    or computed values from the framework.

    ID and MT values are extracted row by row where alignment matters. This
    avoids mismatches between separately filtered metric lists.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any

from .interactions import (
    describe_MT_trend_across_trials,
    get_mean_MT_by_interaction_number,
)
from .metrics import get_MT
from .queries import get_trials
from .regression import fit_fitts_law


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
    """
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _compute_id_from_a_w(
    a_value: Any,
    w_value: Any,
) -> float | None:
    """
    Compute the Shannon index of difficulty from A and W.

    Formula:
        ID = log2(A / W + 1)
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

    Stored ID values are preferred. If they are missing, the ID is recomputed
    from the corresponding A/W or D/W columns.
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


def _id_mt_pairs(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective_id: bool = True,
    summary_only: bool = True,
    valid_only: bool = False,
) -> list[tuple[float, float]]:
    """
    Return aligned ID/MT pairs from trial rows.

    Returns:
        A list of (ID, MT_ms) pairs.
    """
    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    pairs: list[tuple[float, float]] = []

    for row in rows:
        id_value = _id_from_row(row, effective=effective_id)
        mt_ms = _as_finite_float(row.get("mt_ms"))

        if id_value is None or mt_ms is None:
            continue

        pairs.append((id_value, mt_ms))

    return pairs


def _numeric_mapping_to_xy(
    values: dict[Any, Any],
) -> tuple[list[float], list[float]]:
    """
    Convert a mapping into clean numeric x/y lists.

    Entries with missing, invalid, NaN or infinite values are skipped.
    """
    pairs: list[tuple[float, float]] = []

    for key, value in values.items():
        x_value = _as_finite_float(key)
        y_value = _as_finite_float(value)

        if x_value is None or y_value is None:
            continue

        pairs.append((x_value, y_value))

    pairs.sort(key=lambda pair: pair[0])

    x_values = [
        pair[0]
        for pair in pairs
    ]

    y_values = [
        pair[1]
        for pair in pairs
    ]

    return x_values, y_values


def _empty_plot(
    *,
    title: str,
    xlabel: str,
    ylabel: str,
    message: str = "No data available.",
):
    """
    Return an empty matplotlib plot with a centered message.
    """
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots()

    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)

    ax.text(
        0.5,
        0.5,
        message,
        ha="center",
        va="center",
        transform=ax.transAxes,
    )

    fig.tight_layout()

    return fig, ax


def plot_fitts_regression(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective_id: bool = True,
    summary_only: bool = True,
    valid_only: bool = False,
):
    """
    Plot MT over ID with the fitted Fitts' Law regression line.

    Args:
        effective_id:
            If True, plot effective ID.
            If False, plot planned ID.
        summary_only:
            If True, use trial-summary rows.
        valid_only:
            If True, use only valid rows.

    Returns:
        Matplotlib figure and axes.
    """
    import matplotlib.pyplot as plt

    pairs = _id_mt_pairs(
        participant=participant,
        session=session,
        session_id=session_id,
        effective_id=effective_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    ids = [
        pair[0]
        for pair in pairs
    ]

    mts = [
        pair[1]
        for pair in pairs
    ]

    fit = fit_fitts_law(
        participant=participant,
        session=session,
        session_id=session_id,
        effective_id=effective_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    fig, ax = plt.subplots()

    ax.scatter(
        ids,
        mts,
        label="Measured values",
    )

    if fit.intercept is not None and fit.slope is not None and ids:
        x_min = min(ids)
        x_max = max(ids)

        x_line: list[float] = [x_min, x_max]
        y_line: list[float] = [
            fit.intercept + fit.slope * x_min,
            fit.intercept + fit.slope * x_max,
        ]

        ax.plot(
            x_line,
            y_line,
            label=f"MT = {fit.intercept:.2f} + {fit.slope:.2f} · ID",
        )

    ax.set_xlabel("ID")
    ax.set_ylabel("MT [ms]")
    ax.set_title("Fitts' Law Regression")
    ax.legend()

    fig.tight_layout()

    return fig, ax


def plot_distribution(
    values: Sequence[Any],
    *,
    title: str = "Distribution",
    xlabel: str = "Value",
    bins: int = 20,
):
    """
    Plot a histogram for one numeric value distribution.

    Invalid values are ignored before plotting.

    Args:
        values:
            Numeric values to plot.
        title:
            Plot title.
        xlabel:
            X-axis label.
        bins:
            Number of histogram bins.

    Returns:
        Matplotlib figure and axes.
    """
    import matplotlib.pyplot as plt

    cleaned = [
        number
        for value in values
        if (number := _as_finite_float(value)) is not None
    ]

    fig, ax = plt.subplots()

    ax.hist(
        cleaned,
        bins=bins,
    )

    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel("Count")

    fig.tight_layout()

    return fig, ax


def plot_mt_distribution(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
    bins: int = 20,
):
    """
    Plot the movement-time distribution.

    Returns:
        Matplotlib figure and axes.
    """
    mt_values = get_MT(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    return plot_distribution(
        mt_values,
        title="Movement Time Distribution",
        xlabel="MT [ms]",
        bins=bins,
    )


def plot_boxplot_by_group(
    groups: dict[Any, list[dict[str, Any]]],
    *,
    value_column: str,
    title: str = "Grouped Boxplot",
    ylabel: str = "Value",
):
    """
    Plot boxplots for one value column across grouped trial rows.

    Args:
        groups:
            Dictionary mapping group keys to row lists.
        value_column:
            Column to visualise.
        title:
            Plot title.
        ylabel:
            Y-axis label.

    Returns:
        Matplotlib figure and axes.
    """
    import matplotlib.pyplot as plt

    labels: list[str] = []
    values: list[list[float]] = []

    for key, rows in groups.items():
        group_values: list[float] = []

        for row in rows:
            value = _as_finite_float(row.get(value_column))

            if value is None:
                continue

            group_values.append(value)

        if group_values:
            labels.append(str(key))
            values.append(group_values)

    fig, ax = plt.subplots()

    if values:
        positions = list(range(1, len(values) + 1))

        ax.boxplot(
            values,
            positions=positions,
            showmeans=True,
        )

        ax.set_xticks(positions)
        ax.set_xticklabels(
            labels,
            rotation=45,
            ha="right",
        )

    ax.set_title(title)
    ax.set_ylabel(ylabel)
    ax.set_xlabel("Group")

    fig.tight_layout()

    return fig, ax


def plot_mean_mt_by_interaction_number(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
):
    """
    Plot mean MT for each interaction number.

    This plot is useful for visualising habituation or repetition effects inside
    trials. A decreasing curve can indicate that repeated interactions become
    faster.

    Returns:
        Matplotlib figure and axes.
    """
    import matplotlib.pyplot as plt

    means = get_mean_MT_by_interaction_number(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    x_values, y_values = _numeric_mapping_to_xy(means)

    if not x_values or not y_values:
        return _empty_plot(
            title="Mean MT by Interaction Number",
            xlabel="Interaction number",
            ylabel="Mean MT [ms]",
        )

    fig, ax = plt.subplots()

    ax.plot(
        x_values,
        y_values,
        marker="o",
    )

    ax.set_title("Mean MT by Interaction Number")
    ax.set_xlabel("Interaction number")
    ax.set_ylabel("Mean MT [ms]")

    fig.tight_layout()

    return fig, ax


def plot_mean_mt_across_trials(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
):
    """
    Plot mean interaction MT across trial numbers.

    This plot is useful for visualising learning or fatigue over the session.
    A decreasing curve may indicate learning or habituation. An increasing curve
    may indicate fatigue or reduced attention.

    Returns:
        Matplotlib figure and axes.
    """
    import matplotlib.pyplot as plt

    trend = describe_MT_trend_across_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    mean_mt_by_trial = trend.get("mean_mt_by_trial", {})
    x_values, y_values = _numeric_mapping_to_xy(mean_mt_by_trial)

    if not x_values or not y_values:
        return _empty_plot(
            title="Mean Interaction MT Across Trials",
            xlabel="Trial number",
            ylabel="Mean MT [ms]",
        )

    fig, ax = plt.subplots()

    ax.plot(
        x_values,
        y_values,
        marker="o",
    )

    ax.set_title("Mean Interaction MT Across Trials")
    ax.set_xlabel("Trial number")
    ax.set_ylabel("Mean MT [ms]")

    fig.tight_layout()

    return fig, ax


def plot_regression_residuals(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective_id: bool = True,
    summary_only: bool = True,
    valid_only: bool = False,
):
    """
    Plot Fitts' Law regression residuals over ID.

    Residual:
        observed MT - predicted MT
    """
    import matplotlib.pyplot as plt

    from .regression import fitts_law_residuals

    residual_rows = fitts_law_residuals(
        participant=participant,
        session=session,
        session_id=session_id,
        effective_id=effective_id,
        summary_only=summary_only,
        valid_only=valid_only,
    )

    ids: list[float] = []
    residuals: list[float] = []

    for row in residual_rows:
        id_value = _as_finite_float(row.get("ID"))
        residual_value = _as_finite_float(row.get("residual_MT_ms"))

        if id_value is None or residual_value is None:
            continue

        ids.append(id_value)
        residuals.append(residual_value)

    if not ids or not residuals:
        return _empty_plot(
            title="Fitts' Law Regression Residuals",
            xlabel="ID",
            ylabel="Residual MT [ms]",
        )

    fig, ax = plt.subplots()

    ax.scatter(
        ids,
        residuals,
    )

    ax.axhline(0)

    ax.set_title("Fitts' Law Regression Residuals")
    ax.set_xlabel("ID")
    ax.set_ylabel("Residual MT [ms]")

    fig.tight_layout()

    return fig, ax


def plot_mt_boxplot_by_ID(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective: bool = True,
    summary_only: bool = True,
    decimals: int = 2,
):
    """
    Plot MT boxplots grouped by ID.
    """
    from .grouping import group_by_ID

    groups = group_by_ID(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=effective,
        summary_only=summary_only,
        decimals=decimals,
    )

    return plot_boxplot_by_group(
        groups,
        value_column="mt_ms",
        title="Movement Time by ID",
        ylabel="MT [ms]",
    )


def plot_error_rate_by_ID(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective: bool = True,
    decimals: int = 2,
):
    """
    Plot mean error count by ID.

    Note:
        The y-axis represents the mean number of errors per trial, not a
        percentage-based error rate.
    """
    import matplotlib.pyplot as plt

    from .quality import error_rate_by_ID

    values = error_rate_by_ID(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=effective,
        decimals=decimals,
    )

    x_values, y_values = _numeric_mapping_to_xy(values)

    if not x_values or not y_values:
        return _empty_plot(
            title="Mean Errors by ID",
            xlabel="ID",
            ylabel="Mean errors per trial",
        )

    fig, ax = plt.subplots()

    ax.plot(
        x_values,
        y_values,
        marker="o",
    )

    ax.set_title("Mean Errors by ID")
    ax.set_xlabel("ID")
    ax.set_ylabel("Mean errors per trial")

    fig.tight_layout()

    return fig, ax


def plot_valid_hit_rate_by_ID(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective: bool = True,
    decimals: int = 2,
):
    """
    Plot valid hit rate by ID.
    """
    import matplotlib.pyplot as plt

    from .quality import valid_hit_rate_by_ID

    values = valid_hit_rate_by_ID(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=effective,
        decimals=decimals,
    )

    x_values, y_values = _numeric_mapping_to_xy(values)

    if not x_values or not y_values:
        return _empty_plot(
            title="Valid Hit Rate by ID",
            xlabel="ID",
            ylabel="Valid hit rate",
        )

    fig, ax = plt.subplots()

    ax.plot(
        x_values,
        y_values,
        marker="o",
    )

    ax.set_title("Valid Hit Rate by ID")
    ax.set_xlabel("ID")
    ax.set_ylabel("Valid hit rate")

    fig.tight_layout()

    return fig, ax


def plot_planned_vs_effective_ID(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    summary_only: bool = True,
):
    """
    Plot planned ID against effective ID.

    If planned and effective difficulty match perfectly, points should lie near
    the diagonal.
    """
    import matplotlib.pyplot as plt

    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=summary_only,
    )

    planned_values: list[float] = []
    effective_values: list[float] = []

    for row in rows:
        planned = _as_finite_float(row.get("ID_planned"))
        effective = _as_finite_float(row.get("ID_effective"))

        if planned is None or effective is None:
            continue

        planned_values.append(planned)
        effective_values.append(effective)

    if not planned_values or not effective_values:
        return _empty_plot(
            title="Planned vs Effective ID",
            xlabel="Planned ID",
            ylabel="Effective ID",
        )

    fig, ax = plt.subplots()

    ax.scatter(
        planned_values,
        effective_values,
    )

    lower = min(
        min(planned_values),
        min(effective_values),
    )

    upper = max(
        max(planned_values),
        max(effective_values),
    )

    ax.plot(
        [lower, upper],
        [lower, upper],
        label="planned = effective",
    )

    ax.legend()

    ax.set_title("Planned vs Effective ID")
    ax.set_xlabel("Planned ID")
    ax.set_ylabel("Effective ID")

    fig.tight_layout()

    return fig, ax


def plot_interaction_MT_heatmap(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
):
    """
    Plot a Trial x Interaction heatmap using MT as value.

    X-axis:
        interaction_no

    Y-axis:
        trial_no

    Cell value:
        mt_ms

    This plot is useful for visualising habituation inside trials and possible
    fatigue across the session.
    """
    import matplotlib.pyplot as plt

    from .interactions import group_interactions_by_trial

    groups = group_interactions_by_trial(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    trial_numbers = sorted(groups)

    interaction_number_set: set[int] = set()
    
    for rows in groups.values():
        for row in rows:
            interaction_no = _as_int(row.get("interaction_no"))
    
            if interaction_no is None:
                continue
    
            interaction_number_set.add(interaction_no)
    
    interaction_numbers = sorted(interaction_number_set)

    if not trial_numbers or not interaction_numbers:
        return _empty_plot(
            title="Interaction MT Heatmap",
            xlabel="Interaction number",
            ylabel="Trial number",
        )

    matrix: list[list[float | None]] = []

    for trial_no in trial_numbers:
        row_values: list[float | None] = []
        rows = groups[trial_no]

        for interaction_no in interaction_numbers:
            matching_values = [
                _as_finite_float(row.get("mt_ms"))
                for row in rows
                if row.get("interaction_no") == interaction_no
            ]

            clean_values = [
                value
                for value in matching_values
                if value is not None
            ]

            if clean_values:
                row_values.append(
                    sum(clean_values) / len(clean_values)
                )
            else:
                row_values.append(None)

        matrix.append(row_values)

    display_matrix: list[list[float]] = [
        [
            value if value is not None else float("nan")
            for value in row
        ]
        for row in matrix
    ]

    fig, ax = plt.subplots()

    image = ax.imshow(
        display_matrix,
        aspect="auto",
    )

    ax.set_title("Interaction MT Heatmap")
    ax.set_xlabel("Interaction number")
    ax.set_ylabel("Trial number")

    ax.set_xticks(
        list(range(len(interaction_numbers)))
    )
    ax.set_xticklabels(
        [
            str(number)
            for number in interaction_numbers
        ]
    )

    ax.set_yticks(
        list(range(len(trial_numbers)))
    )
    ax.set_yticklabels(
        [
            str(number)
            for number in trial_numbers
        ]
    )

    fig.colorbar(
        image,
        ax=ax,
        label="MT [ms]",
    )

    fig.tight_layout()

    return fig, ax


def plot_learning_curve(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    valid_only: bool = False,
    window: int = 5,
):
    """
    Plot a rolling mean learning curve across trials.

    The curve is based on mean interaction MT per trial.
    """
    import matplotlib.pyplot as plt

    from .interactions import describe_MT_trend_across_trials

    trend = describe_MT_trend_across_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        valid_only=valid_only,
    )

    mean_mt_by_trial = trend.get("mean_mt_by_trial", {})

    trial_numbers: list[float] = []
    mt_values: list[float] = []

    for trial_no, mt_ms in sorted(mean_mt_by_trial.items()):
        trial_value = _as_finite_float(trial_no)
        mt_value = _as_finite_float(mt_ms)

        if trial_value is None or mt_value is None:
            continue

        trial_numbers.append(trial_value)
        mt_values.append(mt_value)

    if not trial_numbers or not mt_values:
        return _empty_plot(
            title="Learning Curve Across Trials",
            xlabel="Trial number",
            ylabel="Mean MT [ms]",
        )

    safe_window = max(1, int(window))
    rolling_values: list[float] = []

    for index in range(len(mt_values)):
        start = max(0, index - safe_window + 1)
        window_values = mt_values[start:index + 1]

        rolling_values.append(
            sum(window_values) / len(window_values)
        )

    fig, ax = plt.subplots()

    ax.plot(
        trial_numbers,
        mt_values,
        marker="o",
        label="Mean MT per trial",
    )

    ax.plot(
        trial_numbers,
        rolling_values,
        marker="o",
        label=f"Rolling mean, window={safe_window}",
    )

    ax.set_title("Learning Curve Across Trials")
    ax.set_xlabel("Trial number")
    ax.set_ylabel("Mean MT [ms]")
    ax.legend()

    fig.tight_layout()

    return fig, ax