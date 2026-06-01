"""
CSV export helpers.

Organigram reference:
- Persistence & Backend
  -> CSV Export
  -> Export Query

Responsibility:
Provides CSV response generation and the shared SQL query used by export routes.

This module handles:
- cleaning non-CSV-friendly values
- converting SQLite rows to downloadable CSV responses
- defining the shared export SELECT query

Important:
CSV_SELECT is intentionally centralized so all export endpoints use the same
column order and schema.
"""

from __future__ import annotations

import csv
import sqlite3
from io import StringIO
from typing import Sequence

from flask import Response


def csv_clean(value):
    """
    Convert special numeric/string values into CSV-safe empty cells.
    """
    if value is None:
        return ""

    if str(value) in ("NaN", "nan", "Infinity", "-Infinity"):
        return ""

    return value


def rows_to_csv_response(
    rows: Sequence[sqlite3.Row],
    filename: str,
) -> Response:
    """
    Convert sqlite3 rows into a downloadable CSV response.
    """
    output = StringIO()
    writer = csv.writer(output, lineterminator="\n")

    if rows:
        header = list(rows[0].keys())
        writer.writerow(header)

        for row in rows:
            writer.writerow(
                [
                    csv_clean(row[column])
                    for column in header
                ]
            )

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


CSV_SELECT = """
  SELECT
    p.participant_id,

    s.session_code,
    s.started_at,
    s.is_demo,
    s.session_comment,
    s.protocol_name,
    s.protocol_comment,
    s.protocol_json,

    s.monte_carlo_summary_json,
    s.monte_carlo_warning_count,
    s.monte_carlo_worst_clamp_pct,
    s.monte_carlo_worst_diagnostic,
    s.monte_carlo_mean_clamped_min_pct,
    s.monte_carlo_mean_clamped_max_pct,

    s.unit,
    s.formula,
    s.timeout_ms,
    s.trial_count,
    s.interactions_per_trial,
    s.admin_settings_json,
    s.a_sampling,
    s.w_sampling,
    s.id_sampling,

    s.target_shape,
    s.param_mode,
    s.required_overlap,
    s.touch_diameter_px,
    s.touch_diameter_mm,

    s.mm_per_px,
    s.viewport_w,
    s.viewport_h,
    s.dpr,
    s.user_agent,
    s.device_context_json,

    t.trial_no,
    t.timestamp_iso,
    t.interaction_no,
    t.active_target_key,
    t.interactions_per_trial,
    t.trial_summary,

    t.unit,
    t.formula,
    t.shape,
    t.target_shape,

    t.param_mode,
    t.random_A,
    t.random_W,
    t.random_ID,

    t.target_x,
    t.target_y,
    t.target_width_px,
    t.target_height_px,

    t.target_hit_geom_json,

    t.A_in,
    t.W_in,
    t.ID_in,

    t.A_px_planned,
    t.W_px,
    t.W_axis_planned_px,

    t.A_mm_planned,
    t.W_mm,
    t.W_axis_planned_mm,

    t.ID_planned,

    t.axis_planned_c_x,
    t.axis_planned_c_y,
    t.axis_planned_d_x,
    t.axis_planned_d_y,

    t.D_px_effective,
    t.D_mm_effective,
    t.W_axis_effective_px,
    t.W_axis_effective_mm,
    t.ID_effective,

    t.measured_overlap,
    t.required_overlap,
    t.hit_valid,

    t.touch_x,
    t.touch_y,
    t.touch_diameter_px,
    t.touch_radius_px,
    t.touch_diameter_px_session,
    t.touch_diameter_mm_session,

    t.prev_x,
    t.prev_y,
    t.x,
    t.y,
    t.placed,

    t.mt_ms,
    t.errors,
    t.error_reasons,
    t.clicks_before_hit,

    t.ua,
    t.platform,
    t.mobile_ua,
    t.screen_w,
    t.screen_h,
    t.viewport_w,
    t.viewport_h,
    t.dpr,
    t.touch_support,
    t.max_touch_points,
    t.pointer_coarse,
    t.pointer_fine,
    t.hover_capable,
    t.hardware_concurrency,
    t.device_memory_gb,
    t.prefers_reduced_motion,
    t.language,
    t.timezone

  FROM participant p
  JOIN session s ON s.participant_id = p.participant_id
  JOIN trial t ON t.session_id = s.id
  ORDER BY
    p.participant_id ASC,
    s.session_code ASC,
    t.trial_no ASC,
    t.interaction_no ASC
"""