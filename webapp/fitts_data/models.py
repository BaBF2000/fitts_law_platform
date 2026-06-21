"""
Data models for the Fitts data framework.

Responsibility:
    Defines typed Python objects representing database entities and computed
    analysis results.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Data Models

Important:
    Models make the framework easier to use than raw dictionaries.

    Low-level database query functions may still return dictionaries, but
    higher-level modules can convert these dictionaries into dataclass objects
    when a more structured representation is useful.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


def _optional_str(value: Any) -> str | None:
    """
    Convert a value to string if it is present.

    Args:
        value:
            Raw value from a database row.

    Returns:
        A string representation of the value, or None if the value is missing.
    """
    if value is None:
        return None

    return str(value)


def _optional_int(value: Any) -> int | None:
    """
    Convert a value to int if possible.

    Args:
        value:
            Raw value from a database row.

    Returns:
        An integer value, or None if conversion is not possible.
    """
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _optional_float(value: Any) -> float | None:
    """
    Convert a value to float if possible.

    Args:
        value:
            Raw value from a database row.

    Returns:
        A float value, or None if conversion is not possible.
    """
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@dataclass(frozen=True)
class Participant:
    """
    One experiment participant.

    Attributes:
        participant_id:
            Public participant identifier.
        session_count:
            Number of saved sessions for this participant.
        last_session_at:
            Timestamp of the most recent saved session.
    """

    participant_id: str
    session_count: int | None = None
    last_session_at: str | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Participant":
        """
        Create a Participant object from a database row.

        Args:
            row:
                Dictionary returned by the query layer.

        Returns:
            A Participant instance.
        """
        return cls(
            participant_id=str(row.get("participant_id")),
            session_count=_optional_int(row.get("session_count")),
            last_session_at=_optional_str(row.get("last_session_at")),
        )


@dataclass(frozen=True)
class Session:
    """
    One saved experiment session.

    The session model contains both identifying information and contextual
    information such as protocol metadata, unit settings, calibration and
    viewport data.
    """

    id: int
    participant_id: str
    session_code: str
    started_at: str

    protocol_name: str | None = None
    protocol_comment: str | None = None
    protocol_json: str | None = None

    unit: str | None = None
    formula: str | None = None
    target_shape: str | None = None
    param_mode: str | None = None

    trial_count: int | None = None
    interactions_per_trial: int | None = None

    mm_per_px: float | None = None
    viewport_w: int | None = None
    viewport_h: int | None = None
    dpr: float | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Session":
        """
        Create a Session object from a database row.

        Args:
            row:
                Dictionary returned by the query layer.

        Returns:
            A Session instance.
        """
        return cls(
            id=int(row["id"]),
            participant_id=str(row["participant_id"]),
            session_code=str(row["session_code"]),
            started_at=str(row["started_at"]),

            protocol_name=_optional_str(row.get("protocol_name")),
            protocol_comment=_optional_str(row.get("protocol_comment")),
            protocol_json=_optional_str(row.get("protocol_json")),

            unit=_optional_str(row.get("unit")),
            formula=_optional_str(row.get("formula")),
            target_shape=_optional_str(row.get("target_shape")),
            param_mode=_optional_str(row.get("param_mode")),

            trial_count=_optional_int(row.get("trial_count")),
            interactions_per_trial=_optional_int(row.get("interactions_per_trial")),

            mm_per_px=_optional_float(row.get("mm_per_px")),
            viewport_w=_optional_int(row.get("viewport_w")),
            viewport_h=_optional_int(row.get("viewport_h")),
            dpr=_optional_float(row.get("dpr")),
        )


@dataclass(frozen=True)
class TrialRow:
    """
    One trial or interaction row.

    A row can represent either:
    - a trial summary row, or
    - an interaction-level row belonging to a trial.

    The distinction is stored in the trial_summary field.
    """

    id: int | None
    session_id: int
    trial_no: int | None

    interaction_no: int | None = None
    trial_summary: int | None = None
    hit_valid: int | None = None

    mt_ms: float | None = None
    errors: int | None = None

    A_px_planned: float | None = None
    A_mm_planned: float | None = None

    W_axis_planned_px: float | None = None
    W_axis_planned_mm: float | None = None

    D_px_effective: float | None = None
    D_mm_effective: float | None = None

    W_axis_effective_px: float | None = None
    W_axis_effective_mm: float | None = None

    ID_planned: float | None = None
    ID_effective: float | None = None

    shape: str | None = None
    target_shape: str | None = None
    param_mode: str | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "TrialRow":
        """
        Create a TrialRow object from a database row.

        Args:
            row:
                Dictionary returned by the query layer.

        Returns:
            A TrialRow instance.
        """
        return cls(
            id=_optional_int(row.get("id")),
            session_id=int(row["session_id"]),
            trial_no=_optional_int(row.get("trial_no")),

            interaction_no=_optional_int(row.get("interaction_no")),
            trial_summary=_optional_int(row.get("trial_summary")),
            hit_valid=_optional_int(row.get("hit_valid")),

            mt_ms=_optional_float(row.get("mt_ms")),
            errors=_optional_int(row.get("errors")),

            A_px_planned=_optional_float(row.get("A_px_planned")),
            A_mm_planned=_optional_float(row.get("A_mm_planned")),

            W_axis_planned_px=_optional_float(row.get("W_axis_planned_px")),
            W_axis_planned_mm=_optional_float(row.get("W_axis_planned_mm")),

            D_px_effective=_optional_float(row.get("D_px_effective")),
            D_mm_effective=_optional_float(row.get("D_mm_effective")),

            W_axis_effective_px=_optional_float(row.get("W_axis_effective_px")),
            W_axis_effective_mm=_optional_float(row.get("W_axis_effective_mm")),

            ID_planned=_optional_float(row.get("ID_planned")),
            ID_effective=_optional_float(row.get("ID_effective")),

            shape=_optional_str(row.get("shape")),
            target_shape=_optional_str(row.get("target_shape")),
            param_mode=_optional_str(row.get("param_mode")),
        )


@dataclass(frozen=True)
class SessionSummary:
    """
    Computed summary for one session.

    This model stores aggregated metrics that are useful for a compact
    scientific overview of one experimental session.
    """

    participant: str | None
    session: str | None
    session_id: int | None

    trial_count: int
    mean_mt_ms: float | None
    mean_id: float | None
    mean_a_px: float | None
    mean_w_px: float | None
    total_errors: int
    mean_errors: float | None
    mean_throughput: float | None

    def as_dict(self) -> dict[str, Any]:
        """
        Convert the session summary to a JSON-friendly dictionary.

        Returns:
            Dictionary representation of the session summary.
        """
        return {
            "participant": self.participant,
            "session": self.session,
            "session_id": self.session_id,
            "trial_count": self.trial_count,
            "mean_mt_ms": self.mean_mt_ms,
            "mean_id": self.mean_id,
            "mean_a_px": self.mean_a_px,
            "mean_w_px": self.mean_w_px,
            "total_errors": self.total_errors,
            "mean_errors": self.mean_errors,
            "mean_throughput": self.mean_throughput,
        }


@dataclass(frozen=True)
class ParticipantSummary:
    """
    Summary of all sessions belonging to one participant.

    Important:
        This summary intentionally does not compute global averages across
        sessions because sessions may use different protocols, devices,
        calibration states or experimental conditions.
    """

    participant: str
    session_count: int
    sessions: list[SessionSummary]

    def as_dict(self) -> dict[str, Any]:
        """
        Convert the participant summary to a JSON-friendly dictionary.

        Returns:
            Dictionary representation of the participant summary.
        """
        return {
            "participant": self.participant,
            "session_count": self.session_count,
            "sessions": [
                session.as_dict()
                for session in self.sessions
            ],
        }