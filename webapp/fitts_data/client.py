"""
High-level client for the Fitts data framework.

Responsibility:
    Provides the main Python entry point for reading, cleaning, analysing
    and visualising Fitts' Law experiment data stored in the SQLite database.

Typical usage:
    from fitts_data import FittsDataClient

    fd = FittsDataClient()

    participants = fd.participants()
    sessions = fd.sessions(participant="P01")
    mt_values = fd.get_MT(participant="P01", session="S1")
    summary = fd.session_summary(participant="P01", session="S1")

Design note:
    This client acts as a facade. It does not implement the analysis logic
    directly. Instead, it delegates the actual work to specialised modules
    such as queries, metrics, summaries, regression, quality, protocol,
    grouping, plots, diagnostics, interactions, datasets and filters.
"""

from __future__ import annotations

from typing import Any

from . import diagnostics
from . import filters
from . import grouping
from . import interactions
from . import metrics
from . import plots
from . import protocol
from . import quality
from . import queries
from . import regression
from . import summaries

from .datasets import (
    SessionDataset,
    load_session_dataset,
)

from .models import (
    ParticipantSummary,
    SessionSummary,
)

from .regression import LinearRegressionResult


class FittsDataClient:
    """
    Main access point for the Fitts data framework.

    The client provides a compact and user-friendly interface for common
    analysis tasks. Most methods are thin wrappers around functions from
    specialised modules.

    This makes it possible to write high-level analysis code such as:

        fd = FittsDataClient()
        summary = fd.session_summary(participant="P01", session="S1")

    instead of importing and calling each module manually.
    """

    # ------------------------------------------------------------------
    # Basic database queries
    # ------------------------------------------------------------------

    def participants(self) -> list[dict[str, Any]]:
        """
        Return all participants stored in the database.
        """
        return queries.list_participants()

    def sessions(
        self,
        participant: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Return available sessions.

        Args:
            participant:
                Optional participant identifier. If provided, only sessions
                belonging to this participant are returned.
        """
        return queries.list_sessions(participant=participant)

    def session(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ) -> dict[str, Any] | None:
        """
        Return one session record.

        A session can be identified either by its internal database ID or by a
        participant/session-code combination.
        """
        return queries.get_session(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def trials(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        summary_only: bool | None = None,
        valid_only: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Return trial-table rows for one session.

        Args:
            summary_only:
                If True, only trial-summary rows are returned.
                If False, only interaction rows are returned.
                If None, all trial-table rows are returned.
            valid_only:
                If True, only valid hit rows are returned where supported.
        """
        return queries.get_trials(
            participant=participant,
            session=session,
            session_id=session_id,
            summary_only=summary_only,
            valid_only=valid_only,
        )

    def trial_summaries(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        valid_only: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Return trial-summary rows for one session.
        """
        return queries.get_trials(
            participant=participant,
            session=session,
            session_id=session_id,
            summary_only=True,
            valid_only=valid_only,
        )

    # ------------------------------------------------------------------
    # Core Fitts' Law metrics
    # ------------------------------------------------------------------

    def get_A(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        calibrated: bool = False,
        effective: bool = False,
        summary_only: bool = True,
    ) -> list[float]:
        """
        Return amplitude values.
        """
        return metrics.get_A(
            participant=participant,
            session=session,
            session_id=session_id,
            calibrated=calibrated,
            effective=effective,
            summary_only=summary_only,
        )

    def get_W(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        calibrated: bool = False,
        effective: bool = False,
        summary_only: bool = True,
    ) -> list[float]:
        """
        Return target-width values.
        """
        return metrics.get_W(
            participant=participant,
            session=session,
            session_id=session_id,
            calibrated=calibrated,
            effective=effective,
            summary_only=summary_only,
        )

    def get_ID(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        effective: bool = True,
        summary_only: bool = True,
    ) -> list[float]:
        """
        Return index-of-difficulty values.
        """
        return metrics.get_ID(
            participant=participant,
            session=session,
            session_id=session_id,
            effective=effective,
            summary_only=summary_only,
        )

    def get_MT(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        summary_only: bool = True,
    ) -> list[float]:
        """
        Return movement-time values in milliseconds.
        """
        return metrics.get_MT(
            participant=participant,
            session=session,
            session_id=session_id,
            summary_only=summary_only,
        )

    def get_errors(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        summary_only: bool = True,
    ) -> list[int]:
        """
        Return error counts.
        """
        return metrics.get_errors(
            participant=participant,
            session=session,
            session_id=session_id,
            summary_only=summary_only,
        )

    def get_throughput(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        effective: bool = True,
        summary_only: bool = True,
    ) -> list[float]:
        """
        Return throughput values.
        """
        return metrics.get_throughput(
            participant=participant,
            session=session,
            session_id=session_id,
            effective=effective,
            summary_only=summary_only,
        )

    # ------------------------------------------------------------------
    # Summaries
    # ------------------------------------------------------------------

    def session_summary(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ) -> SessionSummary:
        """
        Return a computed summary for one session.
        """
        return summaries.session_summary(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def participant_summary(
        self,
        participant: str,
    ) -> ParticipantSummary:
        """
        Return all session summaries for one participant.
        """
        return summaries.participant_summary(participant)

    # ------------------------------------------------------------------
    # Regression analysis
    # ------------------------------------------------------------------

    def fit_fitts_law(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        effective_id: bool = True,
        summary_only: bool = True,
        valid_only: bool = False,
    ) -> LinearRegressionResult:
        """
        Fit Fitts' Law for one session.

        Model:
            MT = a + b * ID
        """
        return regression.fit_fitts_law(
            participant=participant,
            session=session,
            session_id=session_id,
            effective_id=effective_id,
            summary_only=summary_only,
            valid_only=valid_only,
        )

    def fitts_law_residuals(self, **kwargs):
        """
        Return residuals for the Fitts' Law regression.
        """
        return regression.fitts_law_residuals(**kwargs)

    def fitts_law_error_metrics(self, **kwargs):
        """
        Return regression error metrics for the Fitts' Law model.
        """
        return regression.fitts_law_error_metrics(**kwargs)

    # ------------------------------------------------------------------
    # Dataset abstraction
    # ------------------------------------------------------------------

    def dataset(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ) -> SessionDataset:
        """
        Load a complete read-only dataset for one session.
        """
        return load_session_dataset(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    # ------------------------------------------------------------------
    # Data quality and speed-accuracy checks
    # ------------------------------------------------------------------

    def get_error_rate(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        summary_only: bool = True,
    ) -> float | None:
        """
        Return the mean error count per row.
        """
        return quality.get_error_rate(
            participant=participant,
            session=session,
            session_id=session_id,
            summary_only=summary_only,
        )

    def get_total_errors(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        summary_only: bool = True,
    ) -> int:
        """
        Return the total number of recorded errors.
        """
        return quality.get_total_errors(
            participant=participant,
            session=session,
            session_id=session_id,
            summary_only=summary_only,
        )

    def get_valid_hit_rate(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ) -> float | None:
        """
        Return the ratio of valid interaction hits.
        """
        return quality.get_valid_hit_rate(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def get_invalid_hit_rate(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ) -> float | None:
        """
        Return the ratio of invalid interaction hits.
        """
        return quality.get_invalid_hit_rate(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def get_valid_hit_count(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ) -> int:
        """
        Return the number of valid interaction hits.
        """
        return quality.get_valid_hit_count(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def get_invalid_hit_count(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ) -> int:
        """
        Return the number of invalid interaction hits.
        """
        return quality.get_invalid_hit_count(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def describe_overlap(self, **kwargs):
        """
        Return descriptive statistics for target overlap values.
        """
        return quality.describe_overlap(**kwargs)

    def speed_accuracy_summary(self, **kwargs):
        """
        Return a compact speed-accuracy summary.
        """
        return quality.speed_accuracy_summary(**kwargs)

    def error_rate_by_ID(self, **kwargs):
        """
        Return mean error count grouped by ID.
        """
        return quality.error_rate_by_ID(**kwargs)

    def valid_hit_rate_by_ID(self, **kwargs):
        """
        Return valid hit rate grouped by ID.
        """
        return quality.valid_hit_rate_by_ID(**kwargs)

    def mean_MT_by_error_count(self, **kwargs):
        """
        Return MT statistics grouped by error count.
        """
        return quality.mean_MT_by_error_count(**kwargs)

    # ------------------------------------------------------------------
    # Protocol inspection
    # ------------------------------------------------------------------

    def get_protocol(self, **kwargs):
        """
        Return the stored protocol snapshot as a dictionary.
        """
        return protocol.get_protocol(**kwargs)

    def get_protocol_blocks(self, **kwargs):
        """
        Return protocol block definitions.
        """
        return protocol.get_blocks(**kwargs)

    def get_protocol_sampling(self, **kwargs):
        """
        Return protocol sampling settings.
        """
        return protocol.get_sampling(**kwargs)

    def get_protocol_name(self, **kwargs):
        """
        Return the stored protocol name.
        """
        return protocol.get_protocol_name(**kwargs)

    def get_protocol_comment(self, **kwargs):
        """
        Return the stored protocol comment.
        """
        return protocol.get_protocol_comment(**kwargs)

    def get_protocol_block_count(self, **kwargs):
        """
        Return the number of protocol blocks.
        """
        return protocol.get_block_count(**kwargs)

    def get_protocol_shapes(self, **kwargs):
        """
        Return target shapes used by the protocol.
        """
        return protocol.get_shapes(**kwargs)

    def get_protocol_param_modes(self, **kwargs):
        """
        Return parameter modes used by the protocol.
        """
        return protocol.get_param_modes(**kwargs)

    def get_protocol_unit(self, **kwargs):
        """
        Return the protocol unit setting.
        """
        return protocol.get_unit(**kwargs)

    def get_protocol_formula(self, **kwargs):
        """
        Return the protocol formula setting.
        """
        return protocol.get_formula(**kwargs)

    # ------------------------------------------------------------------
    # Grouping utilities
    # ------------------------------------------------------------------

    def group_by_ID(self, **kwargs):
        """
        Group trial rows by ID value.
        """
        return grouping.group_by_ID(**kwargs)

    def group_by_A(self, **kwargs):
        """
        Group trial rows by amplitude value.
        """
        return grouping.group_by_A(**kwargs)

    def group_by_W(self, **kwargs):
        """
        Group trial rows by target-width value.
        """
        return grouping.group_by_W(**kwargs)

    def group_by_shape(self, **kwargs):
        """
        Group trial rows by target shape.
        """
        return grouping.group_by_shape(**kwargs)

    def group_by_param_mode(self, **kwargs):
        """
        Group trial rows by protocol parameter mode.
        """
        return grouping.group_by_param_mode(**kwargs)

    def describe_MT_by_group(self, groups):
        """
        Compute MT statistics for grouped rows.
        """
        return grouping.describe_MT_by_group(groups)

    def describe_column_by_group(self, groups, column: str):
        """
        Compute descriptive statistics for one column across grouped rows.
        """
        return grouping.describe_column_by_group(groups, column)

    def group_counts(self, groups):
        """
        Return the number of rows in each group.
        """
        return grouping.group_counts(groups)

    # ------------------------------------------------------------------
    # Filtering utilities
    # ------------------------------------------------------------------

    def filter_valid_hits(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Keep only valid hit rows from already loaded rows.
        """
        return filters.valid_hits(rows)

    def filter_invalid_hits(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Keep only invalid hit rows from already loaded rows.
        """
        return filters.invalid_hits(rows)

    def filter_trial_summaries(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Keep only trial-summary rows from already loaded rows.
        """
        return filters.trial_summaries(rows)

    def filter_interactions(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Keep only interaction rows from already loaded rows.
        """
        return filters.interactions(rows)

    def filter_without_errors(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Keep only rows without recorded errors.
        """
        return filters.without_errors(rows)

    def filter_with_errors(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Keep only rows with one or more recorded errors.
        """
        return filters.with_errors(rows)

    def filter_by_trial_no(
        self,
        rows: list[dict[str, Any]],
        trial_no: int,
    ) -> list[dict[str, Any]]:
        """
        Keep rows belonging to one trial number.
        """
        return filters.by_trial_no(rows, trial_no)

    def filter_by_interaction_no(
        self,
        rows: list[dict[str, Any]],
        interaction_no: int,
    ) -> list[dict[str, Any]]:
        """
        Keep rows belonging to one interaction number.
        """
        return filters.by_interaction_no(rows, interaction_no)

    def filter_by_shape(
        self,
        rows: list[dict[str, Any]],
        shape: str,
    ) -> list[dict[str, Any]]:
        """
        Keep rows matching a target shape.
        """
        return filters.by_shape(rows, shape)

    def filter_by_param_mode(
        self,
        rows: list[dict[str, Any]],
        mode: str,
    ) -> list[dict[str, Any]]:
        """
        Keep rows matching a parameter mode.
        """
        return filters.by_param_mode(rows, mode)

    # ------------------------------------------------------------------
    # Interaction-level analysis
    # ------------------------------------------------------------------

    def interactions(self, **kwargs):
        """
        Return interaction rows.

        Interaction rows are lower-level rows inside trials.
        """
        return interactions.get_interactions(**kwargs)

    def group_interactions_by_trial(self, **kwargs):
        """
        Group interaction rows by trial number.
        """
        return interactions.group_interactions_by_trial(**kwargs)

    def get_interaction_counts_per_trial(self, **kwargs):
        """
        Return the number of interactions per trial.
        """
        return interactions.get_interaction_counts_per_trial(**kwargs)

    def mean_interactions_per_trial(self, **kwargs):
        """
        Return the mean interaction count per trial.
        """
        return interactions.mean_interactions_per_trial(**kwargs)

    def describe_interaction_MT(self, **kwargs):
        """
        Return descriptive statistics for interaction-level movement times.
        """
        return interactions.describe_interaction_MT(**kwargs)

    def get_interaction_MT_by_number(self, **kwargs):
        """
        Return MT values grouped by interaction number.
        """
        return interactions.get_interaction_MT_by_number(**kwargs)

    def describe_MT_by_interaction_number(self, **kwargs):
        """
        Return MT statistics for each interaction number.
        """
        return interactions.describe_MT_by_interaction_number(**kwargs)

    def get_mean_MT_by_interaction_number(self, **kwargs):
        """
        Return mean MT for each interaction number.
        """
        return interactions.get_mean_MT_by_interaction_number(**kwargs)

    def interaction_learning_effect(self, **kwargs):
        """
        Compare early and late interaction movement times.
        """
        return interactions.interaction_learning_effect(**kwargs)

    def describe_interaction_learning_trend(self, **kwargs):
        """
        Describe MT trend across interaction numbers.
        """
        return interactions.describe_interaction_learning_trend(**kwargs)

    def detect_drastic_MT_drop_within_trials(self, **kwargs):
        """
        Detect drastic MT decreases inside individual trials.
        """
        return interactions.detect_drastic_MT_drop_within_trials(**kwargs)

    def describe_MT_trend_across_trials(self, **kwargs):
        """
        Describe MT trend across the trial sequence.
        """
        return interactions.describe_MT_trend_across_trials(**kwargs)

    def interaction_habituation_report(self, **kwargs):
        """
        Return a compact interaction-level habituation report.
        """
        return interactions.interaction_habituation_report(**kwargs)

    def verify_interaction_count(self, **kwargs):
        """
        Verify whether each trial contains the expected number of interactions.
        """
        return interactions.verify_interaction_count(**kwargs)

    # ------------------------------------------------------------------
    # Plotting utilities
    # ------------------------------------------------------------------

    def plot_fitts_regression(self, **kwargs):
        """
        Plot MT over ID with the Fitts' Law regression line.
        """
        return plots.plot_fitts_regression(**kwargs)

    def plot_mt_distribution(self, **kwargs):
        """
        Plot the movement-time distribution.
        """
        return plots.plot_mt_distribution(**kwargs)

    def plot_boxplot_by_group(
        self,
        groups: dict[Any, list[dict[str, Any]]],
        *,
        value_column: str,
        title: str = "Grouped Boxplot",
        ylabel: str = "Value",
    ):
        """
        Plot boxplots for one value column across grouped rows.
        """
        return plots.plot_boxplot_by_group(
            groups,
            value_column=value_column,
            title=title,
            ylabel=ylabel,
        )

    def plot_regression_residuals(self, **kwargs):
        """
        Plot Fitts' Law regression residuals.
        """
        return plots.plot_regression_residuals(**kwargs)

    def plot_mt_boxplot_by_ID(self, **kwargs):
        """
        Plot MT boxplots grouped by ID.
        """
        return plots.plot_mt_boxplot_by_ID(**kwargs)

    def plot_error_rate_by_ID(self, **kwargs):
        """
        Plot mean error count by ID.
        """
        return plots.plot_error_rate_by_ID(**kwargs)

    def plot_valid_hit_rate_by_ID(self, **kwargs):
        """
        Plot valid hit rate by ID.
        """
        return plots.plot_valid_hit_rate_by_ID(**kwargs)

    def plot_planned_vs_effective_ID(self, **kwargs):
        """
        Plot planned ID against effective ID.
        """
        return plots.plot_planned_vs_effective_ID(**kwargs)

    def plot_mean_mt_by_interaction_number(self, **kwargs):
        """
        Plot mean MT for each interaction number.
        """
        return plots.plot_mean_mt_by_interaction_number(**kwargs)

    def plot_mean_mt_across_trials(self, **kwargs):
        """
        Plot mean interaction MT across trial numbers.
        """
        return plots.plot_mean_mt_across_trials(**kwargs)

    def plot_interaction_MT_heatmap(self, **kwargs):
        """
        Plot Trial x Interaction MT heatmap.
        """
        return plots.plot_interaction_MT_heatmap(**kwargs)

    def plot_learning_curve(self, **kwargs):
        """
        Plot rolling mean learning curve across trials.
        """
        return plots.plot_learning_curve(**kwargs)

    # ------------------------------------------------------------------
    # Diagnostics and reports
    # ------------------------------------------------------------------

    def diagnose_session(self, **kwargs) -> dict[str, Any]:
        """
        Return structured diagnostics for one session.
        """
        return diagnostics.diagnose_session(**kwargs)

    def session_report(self, **kwargs) -> str:
        """
        Return a human-readable session report.
        """
        return diagnostics.session_report(**kwargs)
    def robust_interaction_learning_effect(self, **kwargs):
        """
        Analyse interaction-level learning with robust statistics.
        """
        return interactions.robust_interaction_learning_effect(**kwargs)
    
    
    def normalised_interaction_learning_effect(self, **kwargs):
        """
        Analyse interaction learning after normalising each interaction by its trial.
        """
        return interactions.normalised_interaction_learning_effect(**kwargs)