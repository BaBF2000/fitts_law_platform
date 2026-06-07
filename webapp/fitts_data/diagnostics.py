"""
Diagnostics and user-facing hints for Fitts experiment data.

Responsibility:
Checks data availability and explains missing, computed or calibration-dependent
values in a human-readable way.

Important:
This module does not change data.
It only reports what is available and how the framework handled missing values.
"""

from __future__ import annotations

from .queries import get_session, get_trials
from .metrics import get_A, get_W, get_ID, get_MT
from .summaries import session_summary
from .regression import fit_fitts_law


def diagnose_session(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> dict:
    """
    Return structured diagnostics for one session.
    """
    session_row = get_session(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not session_row:
        return {
            "ok": False,
            "errors": ["Session not found."],
            "warnings": [],
            "hints": [],
            "available": {},
        }

    rows = get_trials(
        participant=participant,
        session=session,
        session_id=session_id,
        summary_only=True,
    )

    warnings: list[str] = []
    hints: list[str] = []

    mm_per_px = session_row.get("mm_per_px")
    session_unit = session_row.get("unit")

    if session_unit == "relative":
        hints.append(
            "Die Session wurde im relativen Modus geplant. Die gespeicherten px/mm Werte entstehen aus der Umrechnung während der Durchführung."
        )

    if session_unit == "px":
        hints.append(
            "Die Session wurde im px-Modus geplant. Millimeterwerte hängen von der gespeicherten Kalibrierung ab."
        )

    if session_unit == "mm" and mm_per_px is None:
        warnings.append(
            "Die Session wurde im mm-Modus geplant, aber mm_per_px fehlt."
        )
        hints.append(
            "Prüfe, ob vor der Durchführung eine gültige Bildschirmkalibrierung gespeichert wurde."
        )

    if mm_per_px is None:
        warnings.append("Kalibrierung fehlt: mm_per_px ist nicht gespeichert.")
        hints.append(
            "Führe die Bildschirmkalibrierung durch, bevor du neue Daten speicherst."
        )

    id_planned_db = [
        row.get("ID_planned")
        for row in rows
        if row.get("ID_planned") is not None
    ]

    id_effective_db = [
        row.get("ID_effective")
        for row in rows
        if row.get("ID_effective") is not None
    ]

    if not id_planned_db:
        warnings.append("ID_planned fehlt in der Datenbank.")
        hints.append(
            "ID_planned wird aus A_px_planned und W_axis_planned_px berechnet."
        )

    if not id_effective_db:
        warnings.append("ID_effective fehlt in der Datenbank.")
        hints.append(
            "ID_effective wird aus D_px_effective und W_axis_effective_px berechnet."
        )

    mt = get_MT(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    a_planned = get_A(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=False,
    )

    w_planned = get_W(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=False,
    )

    a_effective = get_A(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=True,
    )

    w_effective = get_W(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=True,
    )

    id_planned = get_ID(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=False,
    )

    id_effective = get_ID(
        participant=participant,
        session=session,
        session_id=session_id,
        effective=True,
    )

    a_planned_mm = get_A(
        participant=participant,
        session=session,
        session_id=session_id,
        calibrated=True,
        effective=False,
    )
    
    w_planned_mm = get_W(
        participant=participant,
        session=session,
        session_id=session_id,
        calibrated=True,
        effective=False,
    )
    
    a_effective_mm = get_A(
        participant=participant,
        session=session,
        session_id=session_id,
        calibrated=True,
        effective=True,
    )
    
    w_effective_mm = get_W(
        participant=participant,
        session=session,
        session_id=session_id,
        calibrated=True,
        effective=True,
    )
    
    return {
        "ok": True,
        "session": {
            "participant": session_row.get("participant_id"),
            "session": session_row.get("session_code"),
            "session_id": session_row.get("id"),
        },
        "available": {
            "summary_rows": len(rows),
        
            "session_unit": session_unit,
            "mm_per_px": mm_per_px,
        
            "mt": len(mt),
        
            "a_planned_px": len(a_planned),
            "w_planned_px": len(w_planned),
            "a_effective_px": len(a_effective),
            "w_effective_px": len(w_effective),
        
            "a_planned_mm": len(a_planned_mm),
            "w_planned_mm": len(w_planned_mm),
            "a_effective_mm": len(a_effective_mm),
            "w_effective_mm": len(w_effective_mm),
        
            "id_planned": len(id_planned),
            "id_effective": len(id_effective),
        },
        "warnings": warnings,
        "hints": hints,
    }


def session_report(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> str:
    """
    Return a human-readable diagnostic report for one session.
    """
    
    diagnostics = diagnose_session(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not diagnostics["ok"]:
        return "Session report\n\n" + "\n".join(diagnostics["errors"])

    summary = session_summary(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    regression = fit_fitts_law(
        participant=participant,
        session=session,
        session_id=session_id,
        effective_id=True,
    )

    available = diagnostics["available"]
    session_info = diagnostics["session"]

    lines = [
        f"Session report: {session_info['participant']} / {session_info['session']}",
        "",
        "Session context:",
        f"- Input unit mode: {available['session_unit']}",
        f"- Calibration mm/px: {available['mm_per_px']}",
        "",
        "Available data:",
        f"- Summary rows: {available['summary_rows']}",
        f"- MT values: {available['mt']}",
        "",
        "Pixel values:",
        f"- A planned px: {available['a_planned_px']}",
        f"- W planned px: {available['w_planned_px']}",
        f"- A effective px: {available['a_effective_px']}",
        f"- W effective px: {available['w_effective_px']}",
        "",
        "Millimeter values:",
        f"- A planned mm: {available['a_planned_mm']}",
        f"- W planned mm: {available['w_planned_mm']}",
        f"- A effective mm: {available['a_effective_mm']}",
        f"- W effective mm: {available['w_effective_mm']}",
        "",
        "Difficulty values:",
        f"- ID planned values: {available['id_planned']}",
        f"- ID effective values: {available['id_effective']}",
        "",
        "Summary:",
        f"- Trial count: {summary.trial_count}",
        f"- Mean MT: {summary.mean_mt_ms}",
        f"- Mean ID: {summary.mean_id}",
        f"- Total errors: {summary.total_errors}",
        f"- Mean throughput: {summary.mean_throughput}",
        "",
        "Regression:",
        f"- Intercept a: {regression.intercept}",
        f"- Slope b: {regression.slope}",
        f"- R²: {regression.r_squared}",
        f"- n: {regression.n}",
    ]

    if diagnostics["warnings"]:
        lines.extend(["", "Warnings:"])
        lines.extend([f"- {warning}" for warning in diagnostics["warnings"]])

    if diagnostics["hints"]:
        lines.extend(["", "Hints:"])
        lines.extend([f"- {hint}" for hint in diagnostics["hints"]])

    return "\n".join(lines)