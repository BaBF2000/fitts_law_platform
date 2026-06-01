"""
Admin dashboard routes.

Organigram reference:
- Persistence & Backend
  -> Admin Dashboard
     -> Participant Overview
     -> Participant Sessions
     -> Session Details

Responsibility:
Provides HTML dashboard pages for inspecting saved experiment data.

This module handles:
- participant overview
- participant session overview
- detailed session inspection

Important:
These routes are admin-protected.
They are not used during the participant-facing experiment flow.

Extension guide:
- Move repeated HTML/CSS into templates later.
- Add filtering and sorting here.
- Add visual analytics here.
"""

from __future__ import annotations

from flask import Response

from app.db import (
    db,
    safe_name,
    html_escape,
)

from app.routes import bp

from .helpers import (
    require_admin,
    admin_qs,
)

@bp.get("/dashboard")
def dashboard():
    """
    Admin dashboard showing all participants.
    """
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
              p.participant_id,
              COUNT(s.id) AS session_count,
              MAX(s.started_at) AS last_started_at
            FROM participant p
            LEFT JOIN session s ON s.participant_id = p.participant_id
            GROUP BY p.participant_id
            ORDER BY
              (last_started_at IS NULL) ASC,
              last_started_at DESC,
              p.participant_id ASC
            """
        )
        participants = [dict(row) for row in cur.fetchall()]

    qs = admin_qs()

    rows_html = []
    for participant in participants:
        pid = participant["participant_id"]
        session_count = participant["session_count"] or 0
        last_started = participant["last_started_at"] or "—"

        rows_html.append(
            f"""
            <tr>
              <td><a href="/dashboard/participant/{html_escape(pid)}{qs}">{html_escape(pid)}</a></td>
              <td style="text-align:right;">{session_count}</td>
              <td>{html_escape(last_started)}</td>
              <td><a href="/export/participant/{html_escape(pid)}.csv{qs}">CSV exportieren</a></td>
            </tr>
            """
        )

    page = f"""
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Fitts Dashboard</title>
        <style>
          body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 20px; color:#111; }}
          h1 {{ margin: 0 0 10px; }}
          .muted {{ color:#666; }}
          .card {{ border:1px solid #e5e5e5; border-radius: 12px; padding: 14px; max-width: 1000px; }}
          table {{ border-collapse: collapse; width: 100%; max-width: 1000px; }}
          th, td {{ border-bottom: 1px solid #e5e5e5; padding: 10px 8px; }}
          th {{ text-align: left; background: #fafafa; position: sticky; top: 0; }}
          a {{ color: #0b62d6; text-decoration: none; }}
          a:hover {{ text-decoration: underline; }}
          #q {{ padding:10px 12px;border:1px solid #ddd;border-radius:10px;width:min(420px,100%);margin:10px 0; }}
        </style>
      </head>
      <body>
        <h1>Fitts Dashboard</h1>
        <p class="muted">Teilnehmer: {len(participants)}</p>

        <input id="q" placeholder="Teilnehmer suchen..." />

        <div class="card">
          <p>
                <a href="/dashboard/montecarlo{qs}">Monte Carlo Analyse öffnen</a>
          </p>
          <table>
            <thead>
              <tr>
                <th>Teilnehmer</th>
                <th style="text-align:right;">Sessions</th>
                <th>Letzte Session</th>
                <th>Export</th>
              </tr>
            </thead>
            <tbody>
              {''.join(rows_html) if rows_html else '<tr><td colspan="4">Keine Daten.</td></tr>'}
              
            </tbody>
          </table>
        </div>

        <script>
          const q = document.getElementById('q');
          const rows = Array.from(document.querySelectorAll('tbody tr'));

          q.addEventListener('input', () => {{
            const value = q.value.toLowerCase().trim();

            rows.forEach((row) => {{
              const pid = (row.querySelector('td')?.innerText || '').toLowerCase();
              row.style.display = pid.includes(value) ? '' : 'none';
            }});
          }});
        </script>
      </body>
    </html>
    """

    return Response(page, mimetype="text/html")

@bp.get("/dashboard/participant/<participant_id>")
def dashboard_participant(participant_id: str):
    """
    Admin dashboard showing all sessions for one participant.
    """
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    pid = safe_name(participant_id, "P")
    qs = admin_qs()

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
              s.id AS session_id,
              s.session_code,
              s.started_at,
              s.is_demo,
              s.protocol_name,
              s.monte_carlo_warning_count,
              s.monte_carlo_worst_clamp_pct,
              s.monte_carlo_worst_diagnostic,
              s.unit,
              s.formula,
              s.timeout_ms,
              s.trial_count,
              s.interactions_per_trial,
              s.target_shape,
              s.param_mode,

              COUNT(t.id) AS trials_saved,
              COALESCE(SUM(t.errors), 0) AS errors_total,
              AVG(t.mt_ms) AS mt_avg,
              AVG(COALESCE(t.ID_effective, t.ID_planned)) AS id_avg
            FROM session s
            LEFT JOIN trial t ON t.session_id = s.id
            WHERE s.participant_id = ?
            GROUP BY s.id
            ORDER BY s.started_at DESC
            """,
            (pid,),
        )
        sessions = [dict(row) for row in cur.fetchall()]

    rows_html = []
    for session in sessions:
        sid = session["session_id"]
        scode = session["session_code"]
        started = session["started_at"] or "—"
        mode = "DEMO" if (session["is_demo"] or 0) else "RUN"
        unit = session["unit"] or "—"
        formula = session["formula"] or "—"
        shape = session["target_shape"] or "—"
        param_mode = session["param_mode"] or "—"
        protocol_name = session["protocol_name"] or "—"
        timeout = session["timeout_ms"] if session["timeout_ms"] is not None else "—"

        trials_saved = session["trials_saved"] or 0
        errors_total = session["errors_total"] or 0
        mt_avg = session["mt_avg"]
        id_avg = session["id_avg"]

        mt_txt = f"{mt_avg:.1f} ms" if mt_avg is not None else "—"
        id_txt = f"{id_avg:.3f}" if id_avg is not None else "—"

        mc_warn = session.get("monte_carlo_warning_count")
        mc_clamp = session.get("monte_carlo_worst_clamp_pct")
        mc_diag = session.get("monte_carlo_worst_diagnostic") or "—"
        mc_diag_class = (
          "diag-high" if mc_diag == "strong_distortion"
          else "diag-medium" if mc_diag == "moderate_distortion"
          else "diag-low" if mc_diag == "low_distortion"
          else ""
        )
        
        mc_warn_txt = "—" if mc_warn is None else str(mc_warn)
        mc_clamp_txt = "—" if mc_clamp is None else f"{mc_clamp:.1f}%"

        rows_html.append(
            f"""
            <tr>
              <td>{html_escape(scode)}</td>
              <td>{html_escape(started)}</td>
              <td>{html_escape(protocol_name)}</td>
              <td>{mode}</td>
              <td>{html_escape(unit)}</td>
              <td>{html_escape(formula)}</td>
              <td>{html_escape(shape)}</td>
              <td>{html_escape(param_mode)}</td>
              <td style="text-align:right;">{html_escape(timeout)}</td>
              <td style="text-align:right;">{trials_saved}</td>
              <td style="text-align:right;">{errors_total}</td>
              <td style="text-align:right;">{html_escape(mt_txt)}</td>
              <td style="text-align:right;">{html_escape(id_txt)}</td>
              <td style="text-align:right;">{html_escape(mc_warn_txt)}</td>
              <td style="text-align:right;">{html_escape(mc_clamp_txt)}</td>
              <td><span class="{mc_diag_class}">{html_escape(mc_diag)}</span></td>
              <td>
                <a href="/dashboard/session/{sid}{qs}">Ansehen</a>
                &nbsp;·&nbsp;
                <a href="/export/session_id/{sid}.csv{qs}">CSV exportieren</a>
              </td>
            </tr>
            """
        )

    page = f"""
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Fitts Dashboard — {html_escape(pid)}</title>
        <style>
          body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 20px; color:#111; }}
          h1 {{ margin: 0 0 10px; }}
          .muted {{ color:#666; }}
          .top {{ display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 10px; }}
          .btn {{ display:inline-block; padding:8px 10px; border:1px solid #ddd; border-radius:10px; background:#fafafa; }}
          .btn:hover {{ background:#f2f2f2; }}
          .card {{ border:1px solid #e5e5e5; border-radius: 12px; padding: 14px; max-width: 1400px; overflow-x:auto; }}
          table {{ border-collapse: collapse; width: 100%; min-width: 1300px; }}
          th, td {{ border-bottom: 1px solid #e5e5e5; padding: 10px 8px; vertical-align: top; }}
          th {{ text-align: left; background: #fafafa; position: sticky; top: 0; }}
          a {{ color: #0b62d6; text-decoration: none; }}
          a:hover {{ text-decoration: underline; }}
        </style>
      </head>
      <body>
        <div class="top">
          <a class="btn" href="/dashboard{qs}">← Dashboard</a>
          <a class="btn" href="/export/participant/{html_escape(pid)}.csv{qs}">Teilnehmer-CSV exportieren</a>
        </div>

        <h1>Teilnehmer: {html_escape(pid)}</h1>
        <p class="muted">Sessions: {len(sessions)}</p>

        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Start</th>
                <th>Protokoll</th>
                <th>Modus</th>
                <th>Einheit</th>
                <th>Formel</th>
                <th>Form</th>
                <th>Param</th>
                <th style="text-align:right;">Timeout</th>
                <th style="text-align:right;">Trials</th>
                <th style="text-align:right;">Fehler</th>
                <th style="text-align:right;">MT Ø</th>
                <th style="text-align:right;">ID Ø</th>
                <th style="text-align:right;">MC Warn.</th>
                <th style="text-align:right;">MC Clamp</th>
                <th>MC Diagnose</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {''.join(rows_html) if rows_html else '<tr><td colspan="14">Keine Sessions.</td></tr>'}
            </tbody>
          </table>
        </div>
      </body>
    </html>
    """

    return Response(page, mimetype="text/html")


@bp.get("/dashboard/session/<int:session_id>")
def dashboard_session(session_id: int):
    """
    Admin dashboard showing detailed information for one session.
    """
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    qs = admin_qs()

    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
              s.id AS session_id,
              s.participant_id,
              s.session_code,
              s.started_at,
              s.is_demo,
              s.session_comment,
              s.protocol_name,
              s.protocol_comment,
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
              s.target_shape,
              s.param_mode,
              s.required_overlap,
              s.touch_diameter_px,
              s.touch_diameter_mm,

              COUNT(t.id) AS trials_saved,
              COALESCE(SUM(t.errors), 0) AS errors_total,
              AVG(t.mt_ms) AS mt_avg,
              MIN(t.mt_ms) AS mt_min,
              MAX(t.mt_ms) AS mt_max,
              AVG(COALESCE(t.ID_effective, t.ID_planned)) AS id_avg
            FROM session s
            LEFT JOIN trial t ON t.session_id = s.id
            WHERE s.id = ?
            GROUP BY s.id
            LIMIT 1
            """,
            (session_id,),
        )
        meta = cur.fetchone()

        if not meta:
            return Response("Session not found", status=404, mimetype="text/plain")

        meta = dict(meta)

        cur.execute(
            """
            SELECT
              trial_no,
              timestamp_iso,
              param_mode,
              target_shape,
              A_px_planned,
              W_px,
              W_axis_planned_px,
              D_px_effective,
              W_axis_effective_px,
              COALESCE(ID_effective, ID_planned) AS id_used,
              mt_ms,
              errors,
              error_reasons,
              clicks_before_hit
            FROM trial
            WHERE session_id = ?
            ORDER BY trial_no ASC, interaction_no ASC
            LIMIT 120
            """,
            (session_id,),
        )
        trials = [dict(row) for row in cur.fetchall()]

    def fmt(value, nd=1):
        return "—" if value is None else f"{value:.{nd}f}"

    pid = meta["participant_id"]
    scode = meta["session_code"]
    mode = "DEMO" if (meta.get("is_demo") or 0) else "RUN"

    mc_diag = meta.get("monte_carlo_worst_diagnostic") or "—"

    mc_diag_class = (
        "diag-high" if mc_diag == "strong_distortion"
        else "diag-medium" if mc_diag == "moderate_distortion"
        else "diag-low" if mc_diag == "low_distortion"
        else ""
    )

    rows_html = ""
    for trial in trials:
        rows_html += f"""
          <tr>
            <td style="text-align:right;">{html_escape(trial.get("trial_no"))}</td>
            <td>{html_escape(trial.get("target_shape") or "—")}</td>
            <td>{html_escape(trial.get("param_mode") or "—")}</td>
            <td style="text-align:right;">{html_escape(fmt(trial.get("A_px_planned"), 1))}</td>
            <td style="text-align:right;">{html_escape(fmt(trial.get("W_px"), 1))}</td>
            <td style="text-align:right;">{html_escape(fmt(trial.get("W_axis_planned_px"), 1))}</td>
            <td style="text-align:right;">{html_escape(fmt(trial.get("D_px_effective"), 1))}</td>
            <td style="text-align:right;">{html_escape(fmt(trial.get("W_axis_effective_px"), 1))}</td>
            <td style="text-align:right;">{html_escape(fmt(trial.get("id_used"), 3))}</td>
            <td style="text-align:right;">{html_escape(fmt(trial.get("mt_ms"), 1))}</td>
            <td style="text-align:right;">{html_escape(trial.get("errors", 0))}</td>
            <td>{html_escape(trial.get("error_reasons") or "")}</td>
            <td style="text-align:right;">{html_escape(trial.get("clicks_before_hit"))}</td>
          </tr>
        """

    page = f"""
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Session {html_escape(pid)} / {html_escape(scode)}</title>
        <style>
          body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 20px; color:#111; }}
          a {{ color:#0b62d6; text-decoration:none; }}
          a:hover {{ text-decoration: underline; }}
          .top {{ display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 12px; }}
          .btn {{ display:inline-block; padding:8px 10px; border:1px solid #ddd; border-radius:10px; background:#fafafa; }}
          .btn:hover {{ background:#f2f2f2; }}
          .grid {{ display:grid; gap:12px; grid-template-columns: repeat(4, minmax(180px, 1fr)); max-width: 1200px; }}
          @media (max-width: 900px) {{ .grid {{ grid-template-columns: repeat(2, minmax(180px, 1fr)); }} }}
          @media (max-width: 520px) {{ .grid {{ grid-template-columns: 1fr; }} }}
          .kpi {{ border:1px solid #e5e5e5; border-radius:12px; padding:12px; background:#fff; }}
          .kpi b {{ display:block; font-size:12px; color:#666; margin-bottom:4px; }}
          .kpi span {{ font-size:16px; }}
          .card {{ border:1px solid #e5e5e5; border-radius: 12px; padding: 14px; max-width: 1400px; background:#fff; overflow-x:auto; }}
          .muted {{ color:#666; }}
          table {{ border-collapse: collapse; width: 100%; min-width: 1200px; }}
          th, td {{ border-bottom: 1px solid #e5e5e5; padding: 8px 6px; }}
          th {{ text-align:left; background:#fafafa; position: sticky; top: 0; }}
          code {{ background:#f6f6f6; padding:2px 6px; border-radius:6px; }}
          .diag-low {{
            color: #166534;
            background: #dcfce7;
            border-radius: 999px;
            padding: 2px 8px;
          }}
          
          .diag-medium {{
            color: #92400e;
            background: #fef3c7;
            border-radius: 999px;
            padding: 2px 8px;
          }}
          
          .diag-high {{
            color: #991b1b;
            background: #fee2e2;
            border-radius: 999px;
            padding: 2px 8px;
          }}
        </style>
      </head>
      <body>
        <div class="top">
          <a class="btn" href="/dashboard{qs}">← Dashboard</a>
          <a class="btn" href="/dashboard/participant/{html_escape(pid)}{qs}">← Teilnehmer</a>
          <a class="btn" href="/export/session_id/{session_id}.csv{qs}">CSV exportieren</a>
        </div>

        <h1>Session: {html_escape(pid)} / {html_escape(scode)} <span class="muted">({mode})</span></h1>

        <p class="muted">
          Start: <code>{html_escape(meta.get("started_at"))}</code> ·
          Protokoll: <code>{html_escape(meta.get("protocol_name") or "—")}</code> ·
          Einheit: <code>{html_escape(meta.get("unit") or "—")}</code> ·
          Formel: <code>{html_escape(meta.get("formula") or "—")}</code> ·
          Form: <code>{html_escape(meta.get("target_shape") or "—")}</code> ·
          Param: <code>{html_escape(meta.get("param_mode") or "—")}</code>
        </p>

        <p class="muted">
          Session-Kommentar: {html_escape(meta.get("session_comment") or "—")}<br>
          Protokoll-Kommentar: {html_escape(meta.get("protocol_comment") or "—")}
        </p>

        <div class="grid">
          <div class="kpi"><b>Gespeicherte Trials</b><span>{html_escape(meta.get("trials_saved"))}</span></div>
          <div class="kpi"><b>Fehler gesamt</b><span>{html_escape(meta.get("errors_total"))}</span></div>
          <div class="kpi"><b>MT Ø</b><span>{fmt(meta.get("mt_avg"), 1)} ms</span></div>
          <div class="kpi"><b>ID Ø</b><span>{fmt(meta.get("id_avg"), 3)}</span></div>
          <div class="kpi"><b>MT min</b><span>{fmt(meta.get("mt_min"), 1)} ms</span></div>
          <div class="kpi"><b>MT max</b><span>{fmt(meta.get("mt_max"), 1)} ms</span></div>
          <div class="kpi"><b>Timeout</b><span>{html_escape(meta.get("timeout_ms") if meta.get("timeout_ms") is not None else "—")}</span></div>
          <div class="kpi"><b>Trials deklariert</b><span>{html_escape(meta.get("trial_count") if meta.get("trial_count") is not None else "—")}</span></div>
          <div class="kpi"><b>Interaktionen / Trial</b><span>{html_escape(meta.get("interactions_per_trial") if meta.get("interactions_per_trial") is not None else "—")}</span></div>
          <div class="kpi"><b>Required overlap</b><span>{html_escape(meta.get("required_overlap") if meta.get("required_overlap") is not None else "—")}</span></div>
          <div class="kpi"><b>Touch px</b><span>{html_escape(meta.get("touch_diameter_px") if meta.get("touch_diameter_px") is not None else "—")}</span></div>
          <div class="kpi"><b>Touch mm</b><span>{html_escape(meta.get("touch_diameter_mm") if meta.get("touch_diameter_mm") is not None else "—")}</span></div>
          <div class="kpi"><b>MC Warnungen</b><span>{html_escape(meta.get("monte_carlo_warning_count") if meta.get("monte_carlo_warning_count") is not None else "—")}</span></div>
          <div class="kpi"><b>MC Clamp max.</b><span>{fmt(meta.get("monte_carlo_worst_clamp_pct"), 1)}%</span></div>
         <div class="kpi"><b>MC Diagnose</b><span class="{mc_diag_class}">{html_escape(mc_diag)}</span></div>
          <div class="kpi"><b>MC Wmin Ø</b><span>{fmt(meta.get("monte_carlo_mean_clamped_min_pct"), 1)}%</span></div>
          <div class="kpi"><b>MC Wmax Ø</b><span>{fmt(meta.get("monte_carlo_mean_clamped_max_pct"), 1)}%</span></div>
        </div>

        <div class="card" style="margin-top:14px;">
          <h3 style="margin:0 0 8px;">Trials (bis zu 120)</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align:right;">#</th>
                <th>Form</th>
                <th>Param</th>
                <th style="text-align:right;">A geplant px</th>
                <th style="text-align:right;">W px</th>
                <th style="text-align:right;">W Achse geplant px</th>
                <th style="text-align:right;">D effektiv px</th>
                <th style="text-align:right;">W Achse effektiv px</th>
                <th style="text-align:right;">ID</th>
                <th style="text-align:right;">MT ms</th>
                <th style="text-align:right;">Fehler</th>
                <th>Fehlergründe</th>
                <th style="text-align:right;">Klicks</th>
              </tr>
            </thead>
            <tbody>
              {rows_html if rows_html else '<tr><td colspan="13">Keine Trials.</td></tr>'}
            </tbody>
          </table>
        </div>
      </body>
    </html>
    """

    return Response(page, mimetype="text/html")