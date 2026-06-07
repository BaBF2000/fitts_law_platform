"""
Data models for the Fitts data framework.

Responsibility:
Defines typed Python objects representing database entities and computed
analysis results.

Important:
Models keep the framework easier to use than raw dictionaries.
Database query functions may still return dictionaries, but higher-level
functions can convert them into these dataclasses.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Participant:
    """
    One experiment participant.
    """
    participant_id: str
    session_count: int | None = None
    last_session_at: str | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Participant":
        return cls(
            participant_id=str(row.get("participant_id")),
            session_count=row.get("session_count"),
            last_session_at=row.get("last_session_at"),
        )


@dataclass(frozen=True)
class Session:
    """
    One saved experiment session.
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
        return cls(
            id=int(row["id"]),
            participant_id=str(row["participant_id"]),
            session_code=str(row["session_code"]),
            started_at=str(row["started_at"]),

            protocol_name=row.get("protocol_name"),
            protocol_comment=row.get("protocol_comment"),
            protocol_json=row.get("protocol_json"),

            unit=row.get("unit"),
            formula=row.get("formula"),
            target_shape=row.get("target_shape"),
            param_mode=row.get("param_mode"),

            trial_count=row.get("trial_count"),
            interactions_per_trial=row.get("interactions_per_trial"),

            mm_per_px=row.get("mm_per_px"),
            viewport_w=row.get("viewport_w"),
            viewport_h=row.get("viewport_h"),
            dpr=row.get("dpr"),
        )


@dataclass(frozen=True)
class TrialRow:
    """
    One trial or interaction row.
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
        return cls(
            id=row.get("id"),
            session_id=int(row["session_id"]),
            trial_no=row.get("trial_no"),

            interaction_no=row.get("interaction_no"),
            trial_summary=row.get("trial_summary"),
            hit_valid=row.get("hit_valid"),

            mt_ms=row.get("mt_ms"),
            errors=row.get("errors"),

            A_px_planned=row.get("A_px_planned"),
            A_mm_planned=row.get("A_mm_planned"),

            W_axis_planned_px=row.get("W_axis_planned_px"),
            W_axis_planned_mm=row.get("W_axis_planned_mm"),

            D_px_effective=row.get("D_px_effective"),
            D_mm_effective=row.get("D_mm_effective"),

            W_axis_effective_px=row.get("W_axis_effective_px"),
            W_axis_effective_mm=row.get("W_axis_effective_mm"),

            ID_planned=row.get("ID_planned"),
            ID_effective=row.get("ID_effective"),

            shape=row.get("shape"),
            target_shape=row.get("target_shape"),
            param_mode=row.get("param_mode"),
        )


@dataclass(frozen=True)
class SessionSummary:
    """
    Computed summary for one session.
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
        Convert the summary to a JSON-friendly dictionary.
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
    sessions because sessions may use different protocols, devices or
    calibration states.
    """

    participant: str
    session_count: int
    sessions: list[SessionSummary]

    def as_dict(self) -> dict[str, Any]:
        return {
            "participant": self.participant,
            "session_count": self.session_count,
            "sessions": [
                session.as_dict()
                for session in self.sessions
            ],
        }