"""
High-level client for the Fitts data framework.

Responsibility:
Provides a convenient Python entry point for reading and analysing Fitts
experiment data.

Example:
    from fitts_data import FittsDataClient

    fd = FittsDataClient()

    participants = fd.participants()
    sessions = fd.sessions(participant="P01")
    mt = fd.get_MT(participant="P01", session="S1")
    summary = fd.session_summary(participant="P01", session="S1")
"""

from __future__ import annotations

from . import metrics
from . import summaries
from . import interactions
from . import diagnostics
from . import quality
from . import queries
from . import regression
from .regression import LinearRegressionResult
from . import protocol
from . import grouping
from . import plots
from .models import SessionSummary,ParticipantSummary
from .datasets import (
    SessionDataset,
    load_session_dataset,
)


class FittsDataClient:
    """
    Main access point for the Fitts data framework.
    """

    def participants(self) -> list[dict]:
        """
        Return all participants.
        """
        return queries.list_participants()

    def sessions(
        self,
        participant: str | None = None,
    ) -> list[dict]:
        """
        Return sessions, optionally filtered by participant.
        """
        return queries.list_sessions(participant=participant)

    def session(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ) -> dict | None:
        """
        Return one session.
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
    ) -> list[dict]:
        """
        Return trial rows for one session.
        """
        return queries.get_trials(
            participant=participant,
            session=session,
            session_id=session_id,
            summary_only=summary_only,
            valid_only=valid_only,
        )

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
        Return width values.
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
        Return index of difficulty values.
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
        Return movement times in milliseconds.
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

    def session_summary(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ) -> SessionSummary:
        """
        Return one session summary.
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
    
        No global average is computed because sessions may differ in protocol,
        device, calibration or experimental conditions.
        """
        return summaries.participant_summary(participant)
    
    def fit_fitts_law(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        effective_id: bool = True,
        summary_only: bool = True,
    ) -> LinearRegressionResult:
        """
        Fit Fitts' law for one session.

        Model:
        MT = a + b * ID

        Returns:
        - intercept a
        - slope b
        - r_squared
        - number of data points
        """
        return regression.fit_fitts_law(
            participant=participant,
            session=session,
            session_id=session_id,
            effective_id=effective_id,
            summary_only=summary_only,
        )
    def dataset(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ) -> SessionDataset:
        """
        Load a complete session dataset.
        """
        return load_session_dataset(
            participant=participant,
            session=session,
            session_id=session_id,
        )
    def get_error_rate(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        summary_only: bool = True,
    ) -> float | None:
        """
        Return mean error rate per row.
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
        Return total error count.
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
        Return valid hit ratio for interaction rows.
        """
        return quality.get_valid_hit_rate(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def describe_overlap(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
        summary_only: bool = False,
    ):
        """
        Return descriptive overlap statistics.
        """
        return quality.describe_overlap(
            participant=participant,
            session=session,
            session_id=session_id,
            summary_only=summary_only,
        )
    def get_protocol(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ):
        """
        Return the protocol snapshot as dictionary.
        """
        return protocol.get_protocol(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def get_protocol_blocks(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ):
        """
        Return protocol block definitions.
        """
        return protocol.get_blocks(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def get_protocol_sampling(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ):
        """
        Return protocol sampling settings.
        """
        return protocol.get_sampling(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def get_protocol_shapes(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ):
        """
        Return protocol target shapes.
        """
        return protocol.get_shapes(
            participant=participant,
            session=session,
            session_id=session_id,
        )

    def get_protocol_param_modes(
        self,
        *,
        participant: str | None = None,
        session: str | None = None,
        session_id: int | None = None,
    ):
        """
        Return protocol parameter modes.
        """
        return protocol.get_param_modes(
            participant=participant,
            session=session,
            session_id=session_id,
        )
    def group_by_ID(self, **kwargs):
        """
        Group rows by ID value.
        """
        return grouping.group_by_ID(**kwargs)

    def group_by_A(self, **kwargs):
        """
        Group rows by A value.
        """
        return grouping.group_by_A(**kwargs)

    def group_by_W(self, **kwargs):
        """
        Group rows by W value.
        """
        return grouping.group_by_W(**kwargs)

    def group_by_shape(self, **kwargs):
        """
        Group rows by target shape.
        """
        return grouping.group_by_shape(**kwargs)

    def group_by_param_mode(self, **kwargs):
        """
        Group rows by parameter mode.
        """
        return grouping.group_by_param_mode(**kwargs)

    def describe_MT_by_group(self, groups):
        """
        Compute MT statistics for grouped rows.
        """
        return grouping.describe_MT_by_group(groups)
    def plot_fitts_regression(self, **kwargs):
        """
        Plot MT over ID with Fitts' law regression line.
        """
        return plots.plot_fitts_regression(**kwargs)

    def plot_mt_distribution(self, **kwargs):
        """
        Plot movement time distribution.
        """
        return plots.plot_mt_distribution(**kwargs)
    
    def plot_boxplot_by_group(
        self,
        groups: dict,
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
    def diagnose_session(self, **kwargs) -> dict:
        """
        Return structured diagnostics for one session.
        """
        return diagnostics.diagnose_session(**kwargs)

    def session_report(self, **kwargs) -> str:
        """
        Return a human-readable session report.
        """
        return diagnostics.session_report(**kwargs)
    def interactions(self, **kwargs):
        """
        Return interaction rows.
        """
        return interactions.get_interactions(**kwargs)

    def group_interactions_by_trial(self, **kwargs):
        """
        Group interaction rows by trial number.
        """
        return interactions.group_interactions_by_trial(**kwargs)

    def get_interaction_counts_per_trial(self, **kwargs):
        """
        Return number of interactions per trial.
        """
        return interactions.get_interaction_counts_per_trial(**kwargs)

    def mean_interactions_per_trial(self, **kwargs):
        """
        Return mean interaction count per trial.
        """
        return interactions.mean_interactions_per_trial(**kwargs)

    def describe_interaction_MT(self, **kwargs):
        """
        Return descriptive statistics for interaction-level MT.
        """
        return interactions.describe_interaction_MT(**kwargs)

    def get_interaction_MT_by_number(self, **kwargs):
        """
        Return MT values grouped by interaction number.
        """
        return interactions.get_interaction_MT_by_number(**kwargs)

    def verify_interaction_count(self, **kwargs):
        """
        Verify whether each trial contains the expected number of interactions.
        """
        return interactions.verify_interaction_count(**kwargs)