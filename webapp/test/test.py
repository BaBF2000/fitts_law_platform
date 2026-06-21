"""
Manual test script for the fitts_data framework.

This script is intended for quick local checks during development.
It verifies that the high-level FittsDataClient API can access, analyse,
diagnose and visualise one selected session.

Run from the project root:

    python test.py
"""

from __future__ import annotations

from pathlib import Path
from pprint import pprint
from typing import Any, Callable

import matplotlib.pyplot as plt

from fitts_data import FittsDataClient


# ---------------------------------------------------------------------
# Test configuration
# ---------------------------------------------------------------------

PARTICIPANT = "P01"
SESSION = "S3"

SHOW_PLOTS = True
SAVE_PLOTS = True
PLOT_DIR = Path("test_outputs")


# ---------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------

def section(title: str) -> None:
    """
    Print a visible section header.
    """
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def safe_call(
    label: str,
    function: Callable[..., Any],
    *args: Any,
    **kwargs: Any,
) -> Any:
    """
    Execute a test call without stopping the full script on failure.

    Args:
        label:
            Human-readable name of the tested function.
        function:
            Function to call.
        *args:
            Positional arguments forwarded to the function.
        **kwargs:
            Keyword arguments forwarded to the function.

    Returns:
        Function result, or None if an exception occurred.
    """
    print(f"\n--- {label} ---")

    try:
        result = function(*args, **kwargs)
    except Exception as exc:
        print(f"[FAILED] {label}")
        print(f"{type(exc).__name__}: {exc}")
        return None

    print(f"[OK] {label}")
    pprint(result)
    return result


def save_or_show_plot(
    fig,
    filename: str,
) -> None:
    """
    Save and optionally show a matplotlib figure.
    """
    if SAVE_PLOTS:
        PLOT_DIR.mkdir(parents=True, exist_ok=True)
        output_path = PLOT_DIR / filename
        fig.savefig(output_path, dpi=150, bbox_inches="tight")
        print(f"Saved plot: {output_path}")

    if SHOW_PLOTS:
        plt.show()
    else:
        plt.close(fig)


# ---------------------------------------------------------------------
# Main test routine
# ---------------------------------------------------------------------

def main() -> None:
    """
    Run a complete manual smoke test for one participant/session.
    """
    fd = FittsDataClient()

    section("1. Basic database access")

    safe_call(
        "participants()",
        fd.participants,
    )

    safe_call(
        "sessions(participant=PARTICIPANT)",
        fd.sessions,
        participant=PARTICIPANT,
    )

    safe_call(
        "session(participant=PARTICIPANT, session=SESSION)",
        fd.session,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "trial_summaries()",
        fd.trial_summaries,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "interactions()",
        fd.interactions,
        participant=PARTICIPANT,
        session=SESSION,
    )

    section("2. Dataset abstraction")

    dataset = safe_call(
        "dataset()",
        fd.dataset,
        participant=PARTICIPANT,
        session=SESSION,
    )

    if dataset is not None:
        print("\nDataset compact dictionary:")
        pprint(dataset.as_dict())

        print("\nDataset row counts:")
        print(f"- row_count: {dataset.row_count}")
        print(f"- trial_count: {dataset.trial_count}")
        print(f"- interaction_count: {dataset.interaction_count}")

    section("3. Core metrics")

    safe_call(
        "get_A(effective=False)",
        fd.get_A,
        participant=PARTICIPANT,
        session=SESSION,
        effective=False,
    )

    safe_call(
        "get_A(effective=True)",
        fd.get_A,
        participant=PARTICIPANT,
        session=SESSION,
        effective=True,
    )

    safe_call(
        "get_W(effective=False)",
        fd.get_W,
        participant=PARTICIPANT,
        session=SESSION,
        effective=False,
    )

    safe_call(
        "get_W(effective=True)",
        fd.get_W,
        participant=PARTICIPANT,
        session=SESSION,
        effective=True,
    )

    safe_call(
        "get_ID(effective=False)",
        fd.get_ID,
        participant=PARTICIPANT,
        session=SESSION,
        effective=False,
    )

    safe_call(
        "get_ID(effective=True)",
        fd.get_ID,
        participant=PARTICIPANT,
        session=SESSION,
        effective=True,
    )

    safe_call(
        "get_MT()",
        fd.get_MT,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_errors()",
        fd.get_errors,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_throughput()",
        fd.get_throughput,
        participant=PARTICIPANT,
        session=SESSION,
    )

    section("4. Summaries")

    summary = safe_call(
        "session_summary()",
        fd.session_summary,
        participant=PARTICIPANT,
        session=SESSION,
    )

    if summary is not None:
        print("\nSession summary as dictionary:")
        pprint(summary.as_dict())

    safe_call(
        "participant_summary()",
        fd.participant_summary,
        PARTICIPANT,
    )

    section("5. Regression analysis")

    regression = safe_call(
        "fit_fitts_law()",
        fd.fit_fitts_law,
        participant=PARTICIPANT,
        session=SESSION,
        effective_id=True,
    )

    if regression is not None:
        print("\nRegression as dictionary:")
        pprint(regression.as_dict())

    safe_call(
        "fitts_law_residuals()",
        fd.fitts_law_residuals,
        participant=PARTICIPANT,
        session=SESSION,
        effective_id=True,
    )

    safe_call(
        "fitts_law_error_metrics()",
        fd.fitts_law_error_metrics,
        participant=PARTICIPANT,
        session=SESSION,
        effective_id=True,
    )
    

    section("6. Quality and speed-accuracy")

    safe_call(
        "get_error_rate()",
        fd.get_error_rate,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_total_errors()",
        fd.get_total_errors,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_valid_hit_rate()",
        fd.get_valid_hit_rate,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_invalid_hit_rate()",
        fd.get_invalid_hit_rate,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_valid_hit_count()",
        fd.get_valid_hit_count,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_invalid_hit_count()",
        fd.get_invalid_hit_count,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "describe_overlap()",
        fd.describe_overlap,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "speed_accuracy_summary()",
        fd.speed_accuracy_summary,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "error_rate_by_ID()",
        fd.error_rate_by_ID,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "valid_hit_rate_by_ID()",
        fd.valid_hit_rate_by_ID,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "mean_MT_by_error_count()",
        fd.mean_MT_by_error_count,
        participant=PARTICIPANT,
        session=SESSION,
    )

    section("7. Protocol inspection")

    safe_call(
        "get_protocol_name()",
        fd.get_protocol_name,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_protocol_comment()",
        fd.get_protocol_comment,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_protocol_block_count()",
        fd.get_protocol_block_count,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_protocol_sampling()",
        fd.get_protocol_sampling,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_protocol_shapes()",
        fd.get_protocol_shapes,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_protocol_param_modes()",
        fd.get_protocol_param_modes,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_protocol_unit()",
        fd.get_protocol_unit,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_protocol_formula()",
        fd.get_protocol_formula,
        participant=PARTICIPANT,
        session=SESSION,
    )

    section("8. Grouping utilities")

    groups_by_id = safe_call(
        "group_by_ID()",
        fd.group_by_ID,
        participant=PARTICIPANT,
        session=SESSION,
    )

    if groups_by_id is not None:
        print("\nGroup keys:")
        pprint(list(groups_by_id.keys()))

        safe_call(
            "describe_MT_by_group(groups_by_id)",
            fd.describe_MT_by_group,
            groups_by_id,
        )

        safe_call(
            "group_counts(groups_by_id)",
            fd.group_counts,
            groups_by_id,
        )

    safe_call(
        "group_by_A()",
        fd.group_by_A,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "group_by_W()",
        fd.group_by_W,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "group_by_shape()",
        fd.group_by_shape,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "group_by_param_mode()",
        fd.group_by_param_mode,
        participant=PARTICIPANT,
        session=SESSION,
    )

    section("9. Filtering utilities")

    if dataset is not None:
        safe_call(
            "filter_trial_summaries(dataset.trials)",
            fd.filter_trial_summaries,
            dataset.trials,
        )

        safe_call(
            "filter_interactions(dataset.trials)",
            fd.filter_interactions,
            dataset.trials,
        )

        safe_call(
            "filter_valid_hits(dataset.interactions)",
            fd.filter_valid_hits,
            dataset.interactions,
        )

        safe_call(
            "filter_without_errors(dataset.trial_summaries)",
            fd.filter_without_errors,
            dataset.trial_summaries,
        )

        safe_call(
            "filter_by_interaction_no(dataset.interactions, 1)",
            fd.filter_by_interaction_no,
            dataset.interactions,
            1,
        )

    section("10. Interaction-level analysis")

    safe_call(
        "get_interaction_counts_per_trial()",
        fd.get_interaction_counts_per_trial,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "mean_interactions_per_trial()",
        fd.mean_interactions_per_trial,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "verify_interaction_count()",
        fd.verify_interaction_count,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "describe_interaction_MT()",
        fd.describe_interaction_MT,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_interaction_MT_by_number()",
        fd.get_interaction_MT_by_number,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "describe_MT_by_interaction_number()",
        fd.describe_MT_by_interaction_number,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "get_mean_MT_by_interaction_number()",
        fd.get_mean_MT_by_interaction_number,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "interaction_learning_effect()",
        fd.interaction_learning_effect,
        participant=PARTICIPANT,
        session=SESSION,
    )
    safe_call(
        "robust_interaction_learning_effect()",
        fd.robust_interaction_learning_effect,
        participant=PARTICIPANT,
        session=SESSION,
    )
    
    safe_call(
        "normalised_interaction_learning_effect()",
        fd.normalised_interaction_learning_effect,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "describe_interaction_learning_trend()",
        fd.describe_interaction_learning_trend,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "detect_drastic_MT_drop_within_trials()",
        fd.detect_drastic_MT_drop_within_trials,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "describe_MT_trend_across_trials()",
        fd.describe_MT_trend_across_trials,
        participant=PARTICIPANT,
        session=SESSION,
    )

    safe_call(
        "interaction_habituation_report()",
        fd.interaction_habituation_report,
        participant=PARTICIPANT,
        session=SESSION,
    )

    section("11. Diagnostics")

    diagnostics = safe_call(
        "diagnose_session()",
        fd.diagnose_session,
        participant=PARTICIPANT,
        session=SESSION,
    )

    if diagnostics is not None:
        print("\nDiagnostic keys:")
        pprint(list(diagnostics.keys()))

    report = safe_call(
        "session_report()",
        fd.session_report,
        participant=PARTICIPANT,
        session=SESSION,
    )

    if report is not None:
        print("\nFormatted session report:")
        print(report)

    section("12. Plots")

    plot_calls = [
        (
            "plot_fitts_regression",
            fd.plot_fitts_regression,
            "01_fitts_regression.png",
            {
                "participant": PARTICIPANT,
                "session": SESSION,
            },
        ),
        (
            "plot_mt_distribution",
            fd.plot_mt_distribution,
            "02_mt_distribution.png",
            {
                "participant": PARTICIPANT,
                "session": SESSION,
            },
        ),
        (
            "plot_regression_residuals",
            fd.plot_regression_residuals,
            "03_regression_residuals.png",
            {
                "participant": PARTICIPANT,
                "session": SESSION,
            },
        ),
        (
            "plot_error_rate_by_ID",
            fd.plot_error_rate_by_ID,
            "04_error_rate_by_id.png",
            {
                "participant": PARTICIPANT,
                "session": SESSION,
            },
        ),
        (
            "plot_valid_hit_rate_by_ID",
            fd.plot_valid_hit_rate_by_ID,
            "05_valid_hit_rate_by_id.png",
            {
                "participant": PARTICIPANT,
                "session": SESSION,
            },
        ),
        (
            "plot_planned_vs_effective_ID",
            fd.plot_planned_vs_effective_ID,
            "06_planned_vs_effective_id.png",
            {
                "participant": PARTICIPANT,
                "session": SESSION,
            },
        ),
        (
            "plot_mean_mt_by_interaction_number",
            fd.plot_mean_mt_by_interaction_number,
            "07_mean_mt_by_interaction_number.png",
            {
                "participant": PARTICIPANT,
                "session": SESSION,
            },
        ),
        (
            "plot_mean_mt_across_trials",
            fd.plot_mean_mt_across_trials,
            "08_mean_mt_across_trials.png",
            {
                "participant": PARTICIPANT,
                "session": SESSION,
            },
        ),
        (
            "plot_interaction_MT_heatmap",
            fd.plot_interaction_MT_heatmap,
            "09_interaction_mt_heatmap.png",
            {
                "participant": PARTICIPANT,
                "session": SESSION,
            },
        ),
        (
            "plot_learning_curve",
            fd.plot_learning_curve,
            "10_learning_curve.png",
            {
                "participant": PARTICIPANT,
                "session": SESSION,
            },
        ),
    ]

    for label, plot_function, filename, kwargs in plot_calls:
        print(f"\n--- {label} ---")

        try:
            fig, ax = plot_function(**kwargs)
        except Exception as exc:
            print(f"[FAILED] {label}")
            print(f"{type(exc).__name__}: {exc}")
            continue

        print(f"[OK] {label}")
        save_or_show_plot(fig, filename)

    if groups_by_id is not None:
        print("\n--- plot_boxplot_by_group(groups_by_id) ---")

        try:
            fig, ax = fd.plot_boxplot_by_group(
                groups_by_id,
                value_column="mt_ms",
                title="MT by ID",
                ylabel="MT [ms]",
            )
        except Exception as exc:
            print("[FAILED] plot_boxplot_by_group(groups_by_id)")
            print(f"{type(exc).__name__}: {exc}")
        else:
            print("[OK] plot_boxplot_by_group(groups_by_id)")
            save_or_show_plot(fig, "11_mt_boxplot_by_id_group.png")

        print("\n--- plot_mt_boxplot_by_ID() ---")

        try:
            fig, ax = fd.plot_mt_boxplot_by_ID(
                participant=PARTICIPANT,
                session=SESSION,
            )
        except Exception as exc:
            print("[FAILED] plot_mt_boxplot_by_ID()")
            print(f"{type(exc).__name__}: {exc}")
        else:
            print("[OK] plot_mt_boxplot_by_ID()")
            save_or_show_plot(fig, "12_mt_boxplot_by_id_direct.png")

    section("Test completed")


if __name__ == "__main__":
    main()