"""
Dataset objects for the Fitts data framework.

Responsibility:
Bundles all information related to one experiment session into a single
high-level object.

Important:
Datasets are read-only views over stored experiment data.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .queries import (
    get_session,
    get_trials,
    get_protocol_snapshot,
    get_device_context,
)

from .summaries import session_summary
from .regression import fit_fitts_law

from .models import (
    Session,
    SessionSummary,
)

from .regression import LinearRegressionResult


@dataclass(frozen=True)
class SessionDataset:
    """
    Complete dataset for one experimental session.
    """

    session: dict[str, Any]
    trials: list[dict[str, Any]]

    summary: SessionSummary
    regression: LinearRegressionResult

    protocol_json: str | None
    device_context_json: str | None

    @property
    def trial_count(self) -> int:
        return len(self.trials)

    def as_dict(self) -> dict[str, Any]:
        return {
            "session": self.session,
            "trial_count": self.trial_count,
            "summary": self.summary.as_dict(),
            "regression": self.regression.as_dict(),
            "protocol_json": self.protocol_json,
            "device_context_json": self.device_context_json,
        }


def load_session_dataset(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> SessionDataset:
    """
    Load a complete session dataset.
    """

    session_row = get_session(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if session_row is None:
        raise ValueError(
            "Session not found."
        )

    trials = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    summary = session_summary(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    regression = fit_fitts_law(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    protocol_json = get_protocol_snapshot(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    device_context_json = get_device_context(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    return SessionDataset(
        session=session_row,
        trials=trials,
        summary=summary,
        regression=regression,
        protocol_json=protocol_json,
        device_context_json=device_context_json,
    )