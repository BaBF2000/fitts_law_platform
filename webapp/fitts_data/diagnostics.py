"""
Diagnostics and user-facing hints for Fitts experiment data.

Responsibility:
    Checks data availability and explains missing, computed or
    calibration-dependent values in a human-readable way.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Diagnostics Layer

Important:
    This module does not change data.
    It only reports what is available and how the framework handled missing
    or calibration-dependent values.

    Diagnostics combine information from:
    - query layer
    - metric layer
    - quality layer
    - regression layer
    - interaction layer
"""

from __future__ import annotations

from typing import Any

from .interactions import (
    interaction_habituation_report,
    mean_interactions_per_trial,
    verify_interaction_count,
)

from .metrics import (
    get_A,
    get_ID,
    get_MT,
    get_W,
)

from .quality import (
    describe_overlap,
    get_error_rate,
    get_total_errors,
    get_valid_hit_rate,
    speed_accuracy_summary,
)

from .queries import (
    get_session,
    get_trials,
)

from .regression import (
    fit_fitts_law,
    fitts_law_error_metrics,
)

from .statistics import (
    count_outliers_iqr,
    describe,
)

from .summaries import session_summary


def _count_non_missing(rows: list[dict[str, Any]], column: str) -> int:
    """
    Count rows where a column contains a non-empty value.

    Args:
        rows:
            Database rows.
        column:
            Column name to inspect.

    Returns:
        Number of rows with a non-missing value.
    """
    return sum(
        1
        for row in rows
        if row.get(column) is not None
    )


def _append_unique(target: list[str], message: str) -> None:
    """
    Append a message only if it is not already present.

    Args:
        target:
            List of messages.
        message:
            Message to add.
    """
    if message not in target:
        target.append(message)

def _fmt(value: Any, digits: int = 2) -> str:
    """
    Format numeric values for human-readable reports.
    """
    if value is None:
        return "n/a"

    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return str(value)


def _fmt_pct(value: Any, digits: int = 2) -> str:
    """
    Format percentage values for human-readable reports.
    """
    if value is None:
        return "n/a"

    try:
        return f"{float(value):.{digits}f} %"
    except (TypeError, ValueError):
        return str(value)


def diagnose_session(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> dict[str, Any]:
    """
    Return structured diagnostics for one session.

    The result is intended for debugging, documentation and data inspection.
    It explains which data are available, which values are missing and which
    parts of the analysis rely on calibration or fallback computations.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Dictionary with errors, warnings, hints and available data counts.
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
            "session": None,
            "available": {},
            "quality": {},
            "regression": {},
            "interactions": {},
        }

    resolved_session_id = int(session_row["id"])

    summary_rows = get_trials(
        session_id=resolved_session_id,
        summary_only=True,
    )

    interaction_rows = get_trials(
        session_id=resolved_session_id,
        summary_only=False,
    )

    warnings: list[str] = []
    hints: list[str] = []

    mm_per_px = session_row.get("mm_per_px")
    session_unit = session_row.get("unit")

    # ------------------------------------------------------------------
    # Session context and calibration diagnostics
    # ------------------------------------------------------------------

    if session_unit == "relative":
        hints.append(
            "Die Session wurde im relativen Modus geplant. Die gespeicherten "
            "px/mm-Werte entstehen aus der Umrechnung während der Durchführung."
        )

    if session_unit == "px":
        hints.append(
            "Die Session wurde im px-Modus geplant. Millimeterwerte hängen von "
            "der gespeicherten Kalibrierung ab."
        )

    if session_unit == "mm" and mm_per_px is None:
        warnings.append(
            "Die Session wurde im mm-Modus geplant, aber mm_per_px fehlt."
        )
        hints.append(
            "Prüfe, ob vor der Durchführung eine gültige Bildschirmkalibrierung "
            "gespeichert wurde."
        )

    if mm_per_px is None:
        _append_unique(
            warnings,
            "Kalibrierung fehlt: mm_per_px ist nicht gespeichert.",
        )
        _append_unique(
            hints,
            "Führe die Bildschirmkalibrierung durch, bevor du neue Daten "
            "speicherst.",
        )

    # ------------------------------------------------------------------
    # Stored ID diagnostics
    # ------------------------------------------------------------------

    id_planned_db_count = _count_non_missing(summary_rows, "ID_planned")
    id_effective_db_count = _count_non_missing(summary_rows, "ID_effective")

    if summary_rows and id_planned_db_count == 0:
        warnings.append("ID_planned fehlt in den Summary-Zeilen.")
        hints.append(
            "ID_planned wird im Framework aus A_px_planned und "
            "W_axis_planned_px berechnet."
        )

    if summary_rows and id_effective_db_count == 0:
        warnings.append("ID_effective fehlt in den Summary-Zeilen.")
        hints.append(
            "ID_effective wird im Framework aus D_px_effective und "
            "W_axis_effective_px berechnet."
        )

    if not summary_rows:
        warnings.append("Keine Trial-Summary-Zeilen gefunden.")
        hints.append(
            "Prüfe, ob die Session vollständig gespeichert wurde und ob "
            "trial_summary = 1 für Summary-Zeilen gesetzt ist."
        )

    if not interaction_rows:
        warnings.append("Keine Interaction-Zeilen gefunden.")
        hints.append(
            "Interaktionsanalysen zu Habituation, Wiederholungseffekten oder "
            "Fatigue sind ohne Interaction-Zeilen nicht möglich."
        )

    # ------------------------------------------------------------------
    # Metric availability
    # ------------------------------------------------------------------

    mt = get_MT(session_id=resolved_session_id)
    mt_stats = describe(mt)
    mt_outlier_count = count_outliers_iqr(mt)

    a_planned_px = get_A(
        session_id=resolved_session_id,
        calibrated=False,
        effective=False,
    )

    w_planned_px = get_W(
        session_id=resolved_session_id,
        calibrated=False,
        effective=False,
    )

    a_effective_px = get_A(
        session_id=resolved_session_id,
        calibrated=False,
        effective=True,
    )

    w_effective_px = get_W(
        session_id=resolved_session_id,
        calibrated=False,
        effective=True,
    )

    id_planned = get_ID(
        session_id=resolved_session_id,
        effective=False,
    )

    id_effective = get_ID(
        session_id=resolved_session_id,
        effective=True,
    )

    a_planned_mm = get_A(
        session_id=resolved_session_id,
        calibrated=True,
        effective=False,
    )

    w_planned_mm = get_W(
        session_id=resolved_session_id,
        calibrated=True,
        effective=False,
    )

    a_effective_mm = get_A(
        session_id=resolved_session_id,
        calibrated=True,
        effective=True,
    )

    w_effective_mm = get_W(
        session_id=resolved_session_id,
        calibrated=True,
        effective=True,
    )

    if not mt:
        warnings.append("Keine gültigen MT-Werte gefunden.")
    
    if mt_outlier_count > 0:
        hints.append(
            f"Es wurden {mt_outlier_count} mögliche MT-Ausreißer erkannt. "
            "Diese Werte sollten vor der Interpretation geprüft werden."
        )

    if not id_effective:
        warnings.append("Keine gültigen effektiven ID-Werte gefunden.")

    # ------------------------------------------------------------------
    # Quality diagnostics
    # ------------------------------------------------------------------

    error_rate = get_error_rate(session_id=resolved_session_id)
    total_errors = get_total_errors(session_id=resolved_session_id)
    valid_hit_rate = get_valid_hit_rate(session_id=resolved_session_id)
    overlap_stats = describe_overlap(session_id=resolved_session_id)
    speed_accuracy = speed_accuracy_summary(session_id=resolved_session_id)

    if valid_hit_rate is not None and valid_hit_rate < 0.8:
        warnings.append(
            "Die gültige Trefferquote liegt unter 80 %. Die Session sollte "
            "vor der Interpretation der Fitts-Law-Ergebnisse geprüft werden."
        )

    if error_rate is not None and error_rate > 0:
        hints.append(
            "Die Session enthält Fehler. Die Bewegungszeiten sollten zusammen mit "
            "dem Fehlerverhalten interpretiert werden."
        )

    # ------------------------------------------------------------------
    # Regression diagnostics
    # ------------------------------------------------------------------

    regression = fit_fitts_law(
        session_id=resolved_session_id,
        effective_id=True,
    )

    regression_errors = fitts_law_error_metrics(
        session_id=resolved_session_id,
        effective_id=True,
    )

    if regression.n < 2:
        warnings.append(
            "Für die Fitts-Law-Regression sind weniger als zwei gültige "
            "Datenpunkte verfügbar."
        )

    if regression.slope is None:
        warnings.append(
            "Die Fitts-Law-Regression konnte keine gültige Steigung berechnen."
        )

    rmse = regression_errors.get("rmse")

    if rmse is not None and mt_stats.mean is not None:
        if rmse > 0.25 * mt_stats.mean:
            hints.append(
                "Der RMSE der Fitts-Law-Regression ist relativ hoch im Verhältnis "
                "zur mittleren Bewegungszeit. Die Residuen sollten geprüft werden."
            )

    # ------------------------------------------------------------------
    # Interaction diagnostics
    # ------------------------------------------------------------------

    interaction_count_check = verify_interaction_count(
        session_id=resolved_session_id,
    )

    mean_interactions = mean_interactions_per_trial(
        session_id=resolved_session_id,
    )

    habituation = interaction_habituation_report(
        session_id=resolved_session_id,
    )

    if not interaction_count_check.get("ok", False):
        for warning in interaction_count_check.get("warnings", []):
            _append_unique(warnings, warning)

    learning_effect = habituation.get("learning_effect", {})

    if learning_effect.get("ok"):
        percent_change = learning_effect.get("percent_change")

        if percent_change is not None and percent_change < -10:
            hints.append(
                "Die späteren Interaktionen sind deutlich schneller als die "
                "frühen Interaktionen. Dies kann auf Habituation oder einen "
                "Übungseffekt hinweisen."
            )

        if percent_change is not None and percent_change > 10:
            hints.append(
                "Die späteren Interaktionen sind langsamer als die frühen "
                "Interaktionen. Dies kann auf Ermüdung, Unsicherheit oder "
                "Aufmerksamkeitsverlust hinweisen."
            )

    return {
        "ok": True,
        "errors": [],
        "warnings": warnings,
        "hints": hints,
        "session": {
            "participant": session_row.get("participant_id"),
            "session": session_row.get("session_code"),
            "session_id": resolved_session_id,
            "started_at": session_row.get("started_at"),
        },
        "available": {
            "summary_rows": len(summary_rows),
            "interaction_rows": len(interaction_rows),

            "session_unit": session_unit,
            "mm_per_px": mm_per_px,

            "mt": len(mt),
            "mt_outlier_count": mt_outlier_count,
            "mt_statistics": mt_stats.as_dict(),

            "a_planned_px": len(a_planned_px),
            "w_planned_px": len(w_planned_px),
            "a_effective_px": len(a_effective_px),
            "w_effective_px": len(w_effective_px),

            "a_planned_mm": len(a_planned_mm),
            "w_planned_mm": len(w_planned_mm),
            "a_effective_mm": len(a_effective_mm),
            "w_effective_mm": len(w_effective_mm),

            "id_planned": len(id_planned),
            "id_effective": len(id_effective),

            "id_planned_stored": id_planned_db_count,
            "id_effective_stored": id_effective_db_count,

        },
        "quality": {
            "error_rate": error_rate,
            "total_errors": total_errors,
            "valid_hit_rate": valid_hit_rate,
            "overlap": overlap_stats.as_dict(),
            "speed_accuracy": speed_accuracy,
        },
        "regression": {
            **regression.as_dict(),
            "error_metrics": regression_errors,
        },
        "interactions": {
            "mean_interactions_per_trial": mean_interactions,
            "interaction_count_check": interaction_count_check,
            "habituation": habituation,
        },
    }


def session_report(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> str:
    """
    Return a human-readable diagnostic report for one session.

    The report is designed for manual inspection. It summarises session context,
    available metrics, quality indicators, regression results and interaction
    diagnostics.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Multi-line text report.
    """
    diagnostics = diagnose_session(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not diagnostics["ok"]:
        return "Session report\n\n" + "\n".join(diagnostics["errors"])

    resolved_session_id = diagnostics["session"]["session_id"]

    summary = session_summary(
        session_id=resolved_session_id,
    )

    available = diagnostics["available"]
    quality = diagnostics["quality"]
    regression = diagnostics["regression"]
    interactions = diagnostics["interactions"]
    session_info = diagnostics["session"]

    habituation = interactions.get("habituation", {})
    learning_effect = habituation.get("learning_effect", {})
    robust_effect = habituation.get("robust_learning_effect", {})
    normalised_effect = habituation.get("normalised_learning_effect", {})
    trend = habituation.get("interaction_trend", {})
    drastic_drops = habituation.get("drastic_drops_within_trials", {})
    speed_accuracy = quality.get("speed_accuracy", {})
    regression_errors = regression.get("error_metrics", {})

    lines = [
        f"Session report: {session_info['participant']} / {session_info['session']}",
        "",
        "Session context:",
        f"- Session ID: {session_info['session_id']}",
        f"- Started at: {session_info['started_at']}",
        f"- Input unit mode: {available['session_unit']}",
        f"- Calibration mm/px: {available['mm_per_px']}",
        "",
        "Available data:",
        f"- Summary rows: {available['summary_rows']}",
        f"- Interaction rows: {available['interaction_rows']}",
        f"- MT values: {available['mt']}",
        f"- MT outliers: {available['mt_outlier_count']}",
        "",
        "Pixel values:",
        f"- A planned px: {available['a_planned_px']}",
        f"- W planned px: {available['w_planned_px']}",
        f"- A effective px: {available['a_effective_px']}",
        f"- W effective px: {available['w_effective_px']}",
        "",
        "Millimetre values:",
        f"- A planned mm: {available['a_planned_mm']}",
        f"- W planned mm: {available['w_planned_mm']}",
        f"- A effective mm: {available['a_effective_mm']}",
        f"- W effective mm: {available['w_effective_mm']}",
        "",
        "Difficulty values:",
        f"- ID planned values: {available['id_planned']}",
        f"- ID effective values: {available['id_effective']}",
        f"- Stored ID planned values: {available['id_planned_stored']}",
        f"- Stored ID effective values: {available['id_effective_stored']}",
        "",
        "Summary:",
        f"- Trial count: {summary.trial_count}",
        f"- Mean MT: {summary.mean_mt_ms}",
        f"- Mean ID: {summary.mean_id}",
        f"- Total errors: {summary.total_errors}",
        f"- Mean throughput: {summary.mean_throughput}",
        "",
        "Quality:",
        f"- Error rate: {quality['error_rate']}",
        f"- Total errors: {quality['total_errors']}",
        f"- Valid hit rate: {quality['valid_hit_rate']}",
        f"- Overlap mean: {quality['overlap']['mean']}",
        f"- Speed-accuracy error rate: {speed_accuracy.get('error_rate')}",
        f"- Speed-accuracy valid hit rate: {speed_accuracy.get('valid_hit_rate')}",
        "",
        "Regression:",
        f"- Intercept a: {regression['intercept']}",
        f"- Slope b: {regression['slope']}",
        f"- R²: {regression['r_squared']}",
        f"- n: {regression['n']}",
        f"- Slope-based throughput: {regression.get('throughput_bits_per_s')}",
        f"- MAE: {regression_errors.get('mae')}",
        f"- RMSE: {regression_errors.get('rmse')}",
        f"- Mean residual: {regression_errors.get('mean_residual')}",
        f"- Residual std: {regression_errors.get('residual_std')}",
        "",
        "Interactions:",
        f"- Mean interactions per trial: {interactions['mean_interactions_per_trial']}",
        f"- Interaction count ok: {interactions['interaction_count_check'].get('ok')}",
    ]

    if learning_effect:
        lines.extend(
            [
                "",
                "Interaction learning effect:",
                f"- First interaction: {learning_effect.get('first_interaction')}",
                f"- Last interaction: {learning_effect.get('last_interaction')}",
                f"- First mean MT: {learning_effect.get('first_mean_mt_ms')}",
                f"- Last mean MT: {learning_effect.get('last_mean_mt_ms')}",
                f"- Percent change: {learning_effect.get('percent_change')}",
                f"- Interpretation: {learning_effect.get('interpretation')}",
            ]
        )
    
    if robust_effect:
        outlier_report = robust_effect.get("outlier_report", {})
    
        total_outliers = sum(
            item.get("outlier_count", 0)
            for item in outlier_report.values()
            if isinstance(item, dict)
        )
    
        lines.extend(
            [
                "",
                "Robust interaction learning effect:",
                f"- Method: {robust_effect.get('method')}",
                f"- IQR multiplier: {robust_effect.get('iqr_multiplier')}",
                f"- Raw mean change: {_fmt_pct(robust_effect.get('raw_mean_change_pct'))}",
                f"- IQR-cleaned mean change: {_fmt_pct(robust_effect.get('cleaned_mean_change_pct'))}",
                f"- Median change: {_fmt_pct(robust_effect.get('median_change_pct'))}",
                f"- Mean relative change: {_fmt_pct(normalised_effect.get('mean_relative_change_pct'))}",
                f"- Median relative change: {_fmt_pct(normalised_effect.get('median_relative_change_pct'))}",
                f"- Removed outliers: {total_outliers}",
            ]
        )
    
    if normalised_effect:
        lines.extend(
            [
                "",
                "Normalised interaction learning effect:",
                f"- Baseline: {normalised_effect.get('baseline')}",
                f"- First interaction: {normalised_effect.get('first_interaction')}",
                f"- Last interaction: {normalised_effect.get('last_interaction')}",
                f"- Mean relative change: {normalised_effect.get('mean_relative_change_pct')}",
                f"- Median relative change: {normalised_effect.get('median_relative_change_pct')}",
                f"- First mean relative MT: {normalised_effect.get('first_mean_relative_mt')}",
                f"- Last mean relative MT: {normalised_effect.get('last_mean_relative_mt')}",
                f"- First median relative MT: {normalised_effect.get('first_median_relative_mt')}",
                f"- Last median relative MT: {normalised_effect.get('last_median_relative_mt')}",
            ]
        )
    
    if trend:
        lines.extend(
            [
                "",
                "Interaction trend:",
                f"- Slope ms/interaction: {trend.get('slope_ms_per_interaction')}",
                f"- Interpretation: {trend.get('interpretation')}",
            ]
        )

    if drastic_drops:
        lines.extend(
            [
                "",
                "Drastic MT drops within trials:",
                f"- Analysed trials: {drastic_drops.get('analysed_trials')}",
                f"- Flagged trials: {drastic_drops.get('flagged_trial_count')}",
                f"- Drop threshold %: {drastic_drops.get('drop_threshold_pct')}",
            ]
        )

    if diagnostics["warnings"]:
        lines.extend(["", "Warnings:"])
        lines.extend(
            [
                f"- {warning}"
                for warning in diagnostics["warnings"]
            ]
        )

    if diagnostics["hints"]:
        lines.extend(["", "Hints:"])
        lines.extend(
            [
                f"- {hint}"
                for hint in diagnostics["hints"]
            ]
        )

    return "\n".join(lines)