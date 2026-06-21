"""
Dataset objects for the Fitts data framework.

Responsibility:
    Bundles all information related to one experiment session into a single
    high-level read-only object.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Dataset Layer

Important:
    Datasets are read-only views over stored experiment data.

    A SessionDataset is useful for notebooks, scripts and reports because it
    collects session metadata, trial rows, interaction rows, summaries,
    regression results and stored JSON snapshots in one object.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from .models import (
    Session,
    SessionSummary,
)

from .queries import (
    get_device_context,
    get_protocol_snapshot,
    get_session,
    get_trials,
)

from .regression import (
    LinearRegressionResult,
    fit_fitts_law,
)

from .summaries import session_summary


@dataclass(frozen=True)
class SessionDataset:
    """
    Complete read-only dataset for one experimental session.

    The dataset keeps the main session information together with all stored
    trial-level and interaction-level rows.

    Attributes:
        session:
            Structured session metadata.
        trials:
            All rows from the trial table for the selected session.
        trial_summaries:
            Rows where trial_summary = 1.
        interactions:
            Interaction-level rows where trial_summary is NULL or 0.
        summary:
            Computed session-level summary.
        regression:
            Fitts' Law regression result.
        protocol_json:
            Stored protocol snapshot as raw JSON string.
        device_context_json:
            Stored device context as raw JSON string.
    """

    session: Session

    trials: list[dict[str, Any]]
    trial_summaries: list[dict[str, Any]]
    interactions: list[dict[str, Any]]

    summary: SessionSummary
    regression: LinearRegressionResult

    protocol_json: str | None
    device_context_json: str | None

    @property
    def session_id(self) -> int:
        """
        Return the internal database session ID.
        """
        return self.session.id

    @property
    def participant_id(self) -> str:
        """
        Return the participant identifier.
        """
        return self.session.participant_id

    @property
    def session_code(self) -> str:
        """
        Return the session code.
        """
        return self.session.session_code

    @property
    def trial_count(self) -> int:
        """
        Return the number of trial summary rows.

        This count corresponds to completed trials, not to all rows in the
        trial table.
        """
        return len(self.trial_summaries)

    @property
    def interaction_count(self) -> int:
        """
        Return the number of interaction-level rows.
        """
        return len(self.interactions)

    @property
    def row_count(self) -> int:
        """
        Return the total number of stored trial-table rows.
        """
        return len(self.trials)

    def as_dict(self) -> dict[str, Any]:
        """
        Convert the dataset metadata and computed results to a dictionary.

        Trial rows are not fully embedded here to avoid accidentally creating
        very large dictionaries when exporting or printing the dataset.
        """
        return {
            "session": asdict(self.session),
            "row_count": self.row_count,
            "trial_count": self.trial_count,
            "interaction_count": self.interaction_count,
            "summary": self.summary.as_dict(),
            "regression": self.regression.as_dict(),
            "protocol_json": self.protocol_json,
            "device_context_json": self.device_context_json,
        }

    def trials_as_dicts(self) -> list[dict[str, Any]]:
        """
        Return all trial-table rows as dictionaries.
        """
        return self.trials

    def trial_summaries_as_dicts(self) -> list[dict[str, Any]]:
        """
        Return trial summary rows as dictionaries.
        """
        return self.trial_summaries

    def interactions_as_dicts(self) -> list[dict[str, Any]]:
        """
        Return interaction-level rows as dictionaries.
        """
        return self.interactions


def load_session_dataset(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> SessionDataset:
    """
    Load a complete session dataset.

    A session can be selected either by session_id or by participant/session
    code. Internally, the resolved session_id is used for all further queries to
    avoid ambiguity.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        A SessionDataset object.

    Raises:
        ValueError:
            If the requested session cannot be found.
    """
    session_row = get_session(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if session_row is None:
        raise ValueError("Session not found.")

    resolved_session_id = int(session_row["id"])

    all_rows = get_trials(
        session_id=resolved_session_id,
        summary_only=None,
    )

    trial_summaries = get_trials(
        session_id=resolved_session_id,
        summary_only=True,
    )

    interactions = get_trials(
        session_id=resolved_session_id,
        summary_only=False,
    )

    summary = session_summary(
        session_id=resolved_session_id,
    )

    regression = fit_fitts_law(
        session_id=resolved_session_id,
    )

    protocol_json = get_protocol_snapshot(
        session_id=resolved_session_id,
    )

    device_context_json = get_device_context(
        session_id=resolved_session_id,
    )

    return SessionDataset(
        session=Session.from_row(session_row),
        trials=all_rows,
        trial_summaries=trial_summaries,
        interactions=interactions,
        summary=summary,
        regression=regression,
        protocol_json=protocol_json,
        device_context_json=device_context_json,
    )