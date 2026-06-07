"""
Plot helpers for the Fitts data framework.

Responsibility:
Provides optional matplotlib plots for scientific analysis.

Important:
Matplotlib is imported inside functions so the core framework stays usable
without plotting dependencies.
"""

from __future__ import annotations

from .metrics import get_ID, get_MT
from .regression import fit_fitts_law


def plot_fitts_regression(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
    effective_id: bool = True,
    summary_only: bool = True,
):
    """
    Plot MT over ID with fitted Fitts' law regression line.
    """
    import matplotlib.pyplot as plt

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

    fit = fit_fitts_law(
        participant=participant,
        session=session,
        session_id=session_id,
        effective_id=effective_id,
        summary_only=summary_only,
    )

    fig, ax = plt.subplots()

    ax.scatter(ids, mts, label="Messwerte")

    if fit.intercept is not None and fit.slope is not None and ids:
        x_min = min(ids)
        x_max = max(ids)

        x_line = [x_min, x_max]
        y_line = [
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

    return fig, ax


def plot_distribution(
    values: list[float],
    *,
    title: str = "Distribution",
    xlabel: str = "Value",
    bins: int = 20,
):
    """
    Plot a histogram for one numeric value distribution.
    """
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots()

    ax.hist(values, bins=bins)
    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel("Count")

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
    Plot movement time distribution.
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
    groups: dict,
    *,
    value_column: str,
    title: str = "Grouped Boxplot",
    ylabel: str = "Value",
):
    """
    Plot boxplots for one value column across grouped trial rows.
    """
    import matplotlib.pyplot as plt

    labels = []
    values = []

    for key, rows in groups.items():
        group_values = []

        for row in rows:
            value = row.get(value_column)

            if value is None:
                continue

            try:
                group_values.append(float(value))
            except (TypeError, ValueError):
                continue

        if group_values:
            labels.append(str(key))
            values.append(group_values)

    fig, ax = plt.subplots()

    ax.boxplot(
        values,
        label=labels,
        showmeans=True,
    )

    ax.set_title(title)
    ax.set_ylabel(ylabel)
    ax.set_xlabel("Group")

    return fig, ax