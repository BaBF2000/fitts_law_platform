from __future__ import annotations

from flask import (
    Blueprint,
    request,
    jsonify,
    Response,
    send_from_directory,
    render_template,
    current_app,
)

from .db import (
    db,
    DB_WRITE_LOCK,
    safe_name,
    html_escape,
    now_iso_seconds,
    rows_to_csv_response,
    CSV_SELECT,
)

bp = Blueprint("routes", __name__)


# ---------------- Auth helpers ----------------

def require_admin() -> bool:
    """
    Optional admin protection for dashboard and exports.

    If ADMIN_TOKEN is empty, access is open.
    If ADMIN_TOKEN is set, access is allowed only when:
      - ?token=... matches, or
      - X-Admin-Token header matches.
    """
    required = (current_app.config.get("ADMIN_TOKEN") or "").strip()
    if not required:
        return True

    token = (request.args.get("token") or request.headers.get("X-Admin-Token") or "").strip()
    return token == required


def admin_qs() -> str:
    """
    Preserve ?token=... across dashboard links.

    Browser links cannot attach custom headers, so token-based URL navigation
    needs the token to remain in the query string.
    """
    token = (request.args.get("token") or "").strip()
    return f"?token={token}" if token else ""


# ---------------- Small helpers ----------------

def as_int_bool(value):
    """
    Convert truthy/falsy frontend values to SQLite-friendly integers.

    Returns:
      - 1 for truthy values
      - 0 for falsy values
      - None if the value is None
    """
    if value is None:
        return None
    return 1 if value else 0


def get_field(row: dict, key: str):
    """
    Safely read one value from a result row.
    """
    return row.get(key)


def insert_dict(cur, table: str, data: dict) -> None:
    """
    Insert a dictionary into a SQLite table.

    The dictionary keys are used as column names.
    This avoids long fragile INSERT statements with mismatched placeholder counts.
    """
    columns = list(data.keys())
    placeholders = ", ".join(["?"] * len(columns))
    column_sql = ", ".join(columns)

    cur.execute(
        f"INSERT INTO {table} ({column_sql}) VALUES ({placeholders})",
        [data[col] for col in columns],
    )


def csv_select_base() -> str:
    """
    Return CSV_SELECT without its final ORDER BY block.

    CSV_SELECT is used as a shared base query. For filtered exports, WHERE must
    be inserted before ORDER BY.
    """
    return CSV_SELECT.rsplit("ORDER BY", 1)[0]


# ---------------- Pages ----------------

@bp.get("/")
def index():
    """
    Render the main experiment UI.
    """
    return render_template("index.html")


@bp.get("/manifest.webmanifest")
def manifest_root():
    """
    Serve the PWA manifest at the root path.
    """
    return send_from_directory(
        current_app.static_folder,
        "pwa/manifest.webmanifest",
        mimetype="application/manifest+json",
    )


@bp.get("/static/pwa/manifest.webmanifest")
def manifest_static():
    """
    Compatibility route for direct static manifest access.
    """
    return send_from_directory(
        current_app.static_folder,
        "pwa/manifest.webmanifest",
        mimetype="application/manifest+json",
    )


@bp.get("/sw.js")
def sw():
    """
    Serve the Service Worker at the root scope.
    """
    resp = send_from_directory(
        current_app.static_folder,
        "pwa/sw.js",
        mimetype="application/javascript",
    )
    resp.headers["Service-Worker-Allowed"] = "/"
    return resp


@bp.get("/routes")
def routes():
    """
    Debug endpoint showing the Flask route map.

    Admin-protected to avoid exposing internal routes unintentionally.
    """
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    return Response(str(current_app.url_map), mimetype="text/plain")


# ---------------- API ----------------

@bp.get("/check_ids")
def check_ids():
    """
    Check whether participant/session IDs already exist.

    Used by the frontend before starting or saving a run.
    """
    participant_id = safe_name(request.args.get("participant_id"), "P")
    session_code = safe_name(request.args.get("session_id"), "S")

    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            "SELECT 1 FROM participant WHERE participant_id = ? LIMIT 1",
            (participant_id,),
        )
        participant_exists = cur.fetchone() is not None

        cur.execute(
            """
            SELECT 1
            FROM session
            WHERE participant_id = ? AND session_code = ?
            LIMIT 1
            """,
            (participant_id, session_code),
        )
        session_exists = cur.fetchone() is not None

    return jsonify(
        {
            "ok": True,
            "participant_id": participant_id,
            "session_id": session_code,
            "participant_exists": participant_exists,
            "session_exists": session_exists,
        }
    )


@bp.post("/save_results")
def save_results():
    """
    Persist one completed experiment run.

    Stored levels:
      - participant: one participant identifier
      - session: metadata stored once per run
      - trial: exported result rows stored per trial summary row
    """
    payload = request.get_json(silent=True) or {}
    rows = payload.get("rows") or []
    meta = payload.get("meta") or {}

    if not isinstance(rows, list) or not rows:
        return jsonify({"ok": False, "error": "No rows"}), 400

    if not all(isinstance(row, dict) for row in rows):
        return jsonify({"ok": False, "error": "Rows must be objects"}), 400

    pid = safe_name(meta.get("participant_id"), "P")
    session_code = safe_name(meta.get("session_id"), "S")
    started_at = now_iso_seconds()

    session_data = {
        "participant_id": pid,
        "session_code": session_code,
        "started_at": started_at,
        "is_demo": 1 if meta.get("is_demo") else 0,

        "session_comment": meta.get("session_comment"),
        "protocol_name": meta.get("protocol_name"),
        "protocol_comment": meta.get("protocol_comment"),
        "protocol_json": meta.get("protocol_json"),

        "monte_carlo_summary_json": meta.get("monte_carlo_summary_json"),
        "monte_carlo_warning_count": meta.get("monte_carlo_warning_count"),
        "monte_carlo_worst_clamp_pct": meta.get("monte_carlo_worst_clamp_pct"),
        "monte_carlo_worst_diagnostic": meta.get("monte_carlo_worst_diagnostic"),
        "monte_carlo_mean_clamped_min_pct": meta.get("monte_carlo_mean_clamped_min_pct"),
        "monte_carlo_mean_clamped_max_pct": meta.get("monte_carlo_mean_clamped_max_pct"),

        "unit": meta.get("unit"),
        "formula": meta.get("formula"),
        "timeout_ms": meta.get("timeout_ms"),
        "trial_count": meta.get("trial_count"),
        "interactions_per_trial": meta.get("interactions_per_trial"),

        "target_shape": meta.get("target_shape"),
        "param_mode": meta.get("param_mode"),
        "required_overlap": meta.get("required_overlap"),
        "touch_diameter_px": meta.get("touch_diameter_px"),
        "touch_diameter_mm": meta.get("touch_diameter_mm"),

        "mm_per_px": meta.get("mm_per_px"),
        "viewport_w": meta.get("viewport_w"),
        "viewport_h": meta.get("viewport_h"),
        "dpr": meta.get("dpr"),
        "user_agent": meta.get("user_agent"),
        "device_context_json": meta.get("device_context_json"),
    }

    # Serialize writes to reduce short SQLite lock conflicts.
    with DB_WRITE_LOCK:
        with db() as conn:
            cur = conn.cursor()

            cur.execute(
                """
                SELECT id
                FROM session
                WHERE participant_id = ? AND session_code = ?
                LIMIT 1
                """,
                (pid, session_code),
            )
            if cur.fetchone():
                return jsonify({"ok": False, "error": "Session already exists"}), 409

            cur.execute(
                "INSERT OR IGNORE INTO participant(participant_id) VALUES (?)",
                (pid,),
            )

            insert_dict(cur, "session", session_data)
            session_db_id = cur.lastrowid

            for row in rows:
                trial_data = {
                    "session_id": session_db_id,
                    "trial_no": get_field(row, "trial_no"),
                    "timestamp_iso": get_field(row, "timestamp_iso"),

                    "interaction_no": get_field(row, "interaction_no"),
                    "active_target_key": get_field(row, "active_target_key"),
                    "interactions_per_trial": get_field(row, "interactions_per_trial"),
                    "trial_summary": as_int_bool(get_field(row, "trial_summary")),

                    "unit": get_field(row, "unit"),
                    "formula": get_field(row, "formula"),
                    "shape": get_field(row, "shape"),
                    "target_shape": get_field(row, "target_shape"),

                    "param_mode": get_field(row, "param_mode"),
                    "random_A": as_int_bool(get_field(row, "random_A")),
                    "random_W": as_int_bool(get_field(row, "random_W")),
                    "random_ID": as_int_bool(get_field(row, "random_ID")),

                    "target_x": get_field(row, "target_x"),
                    "target_y": get_field(row, "target_y"),
                    "target_width_px": get_field(row, "target_width_px"),
                    "target_height_px": get_field(row, "target_height_px"),

                    "target_hit_geom_json": get_field(row, "target_hit_geom_json"),

                    "A_in": get_field(row, "A_in"),
                    "W_in": get_field(row, "W_in"),
                    "ID_in": get_field(row, "ID_in"),

                    "A_px_planned": get_field(row, "A_px_planned"),
                    "W_px": get_field(row, "W_px"),
                    "W_axis_planned_px": get_field(row, "W_axis_planned_px"),

                    "A_mm_planned": get_field(row, "A_mm_planned"),
                    "W_mm": get_field(row, "W_mm"),
                    "W_axis_planned_mm": get_field(row, "W_axis_planned_mm"),

                    "ID_planned": get_field(row, "ID_planned"),

                    "axis_planned_c_x": get_field(row, "axis_planned_c_x"),
                    "axis_planned_c_y": get_field(row, "axis_planned_c_y"),
                    "axis_planned_d_x": get_field(row, "axis_planned_d_x"),
                    "axis_planned_d_y": get_field(row, "axis_planned_d_y"),

                    "D_px_effective": get_field(row, "D_px_effective"),
                    "D_mm_effective": get_field(row, "D_mm_effective"),
                    "W_axis_effective_px": get_field(row, "W_axis_effective_px"),
                    "W_axis_effective_mm": get_field(row, "W_axis_effective_mm"),
                    "ID_effective": get_field(row, "ID_effective"),

                    "measured_overlap": get_field(row, "measured_overlap"),
                    "required_overlap": get_field(row, "required_overlap"),
                    "hit_valid": as_int_bool(get_field(row, "hit_valid")),

                    "touch_x": get_field(row, "touch_x"),
                    "touch_y": get_field(row, "touch_y"),
                    "touch_diameter_px": get_field(row, "touch_diameter_px"),
                    "touch_radius_px": get_field(row, "touch_radius_px"),
                    "touch_diameter_px_session": get_field(row, "touch_diameter_px_session"),
                    "touch_diameter_mm_session": get_field(row, "touch_diameter_mm_session"),

                    "prev_x": get_field(row, "prev_x"),
                    "prev_y": get_field(row, "prev_y"),
                    "x": get_field(row, "x"),
                    "y": get_field(row, "y"),
                    "placed": get_field(row, "placed"),

                    "mt_ms": get_field(row, "mt_ms"),
                    "errors": get_field(row, "errors"),
                    "error_reasons": get_field(row, "error_reasons"),
                    "clicks_before_hit": get_field(row, "clicks_before_hit"),

                    "ua": get_field(row, "ua"),
                    "platform": get_field(row, "platform"),
                    "mobile_ua": as_int_bool(get_field(row, "mobile_ua")),
                    "screen_w": get_field(row, "screen_w"),
                    "screen_h": get_field(row, "screen_h"),
                    "viewport_w": get_field(row, "viewport_w"),
                    "viewport_h": get_field(row, "viewport_h"),
                    "dpr": get_field(row, "dpr"),
                    "touch_support": as_int_bool(get_field(row, "touch_support")),
                    "max_touch_points": get_field(row, "max_touch_points"),
                    "pointer_coarse": as_int_bool(get_field(row, "pointer_coarse")),
                    "pointer_fine": as_int_bool(get_field(row, "pointer_fine")),
                    "hover_capable": as_int_bool(get_field(row, "hover_capable")),
                    "hardware_concurrency": get_field(row, "hardware_concurrency"),
                    "device_memory_gb": get_field(row, "device_memory_gb"),
                    "prefers_reduced_motion": as_int_bool(get_field(row, "prefers_reduced_motion")),
                    "language": get_field(row, "language"),
                    "timezone": get_field(row, "timezone"),
                }

                insert_dict(cur, "trial", trial_data)

            conn.commit()

    return jsonify(
        {
            "ok": True,
            "saved_to": "data/fitts.db",
            "session_row_id": session_db_id,
        }
    ), 200


@bp.get("/sessions/<participant_id>")
def list_sessions(participant_id: str):
    """
    Return a lightweight JSON list of sessions for one participant.
    """
    pid = safe_name(participant_id, "P")

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
              id,
              session_code,
              started_at,
              is_demo,
              session_comment,
              protocol_name,
              protocol_comment,
              unit,
              formula,
              timeout_ms,
              trial_count,
              interactions_per_trial,
              target_shape,
              param_mode
            FROM session
            WHERE participant_id = ?
            ORDER BY started_at DESC
            """,
            (pid,),
        )
        rows = [dict(row) for row in cur.fetchall()]

    return jsonify({"ok": True, "participant_id": pid, "sessions": rows})


# ---------------- Export CSV (admin) ----------------

@bp.get("/export/participant/<participant_id>.csv")
def export_participant_csv(participant_id: str):
    """
    Export all sessions for one participant as CSV.
    """
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    pid = safe_name(participant_id, "P")

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            csv_select_base()
            + """
            WHERE p.participant_id = ?
            ORDER BY s.started_at ASC, t.trial_no ASC, t.interaction_no ASC
            """,
            (pid,),
        )
        rows = cur.fetchall()

    if not rows:
        return jsonify({"ok": False, "error": "No data"}), 404

    return rows_to_csv_response(rows, f"{pid}.csv")


@bp.get("/export/session/<participant_id>/<session_code>.csv")
def export_session_csv(participant_id: str, session_code: str):
    """
    Export one participant/session pair as CSV.
    """
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    pid = safe_name(participant_id, "P")
    scode = safe_name(session_code, "S")

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            csv_select_base()
            + """
            WHERE p.participant_id = ? AND s.session_code = ?
            ORDER BY t.trial_no ASC, t.interaction_no ASC
            """,
            (pid, scode),
        )
        rows = cur.fetchall()

    if not rows:
        return jsonify({"ok": False, "error": "No data"}), 404

    return rows_to_csv_response(rows, f"{pid}_{scode}.csv")


@bp.get("/export/session_id/<int:session_id>.csv")
def export_session_by_id_csv(session_id: int):
    """
    Export one session by internal DB id as CSV.
    """
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            csv_select_base()
            + """
            WHERE s.id = ?
            ORDER BY t.trial_no ASC, t.interaction_no ASC
            """,
            (session_id,),
        )
        rows = cur.fetchall()

    if not rows:
        return jsonify({"ok": False, "error": f"No data for session_id={session_id}"}), 404

    pid = rows[0]["participant_id"]
    filename = f"{pid}_{session_id}.csv"

    return rows_to_csv_response(rows, filename)


# ---------------- Dashboard (admin) ----------------

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
              <p>
                <a href="/dashboard/montecarlo{qs}">Monte Carlo Analyse öffnen</a>
              </p>
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

@bp.get("/dashboard/montecarlo")
def dashboard_montecarlo():
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
              s.protocol_name,
              s.protocol_json,
              s.monte_carlo_warning_count,
              s.monte_carlo_worst_clamp_pct,
              s.monte_carlo_worst_diagnostic
            FROM session s
            ORDER BY s.started_at DESC
            LIMIT 50
            """
        )
        sessions = [dict(row) for row in cur.fetchall()]
    
    session_rows_html = []

    for s in sessions:
        
        protocol_json = html_escape(s.get("protocol_json") or "")
        diag = s.get("monte_carlo_worst_diagnostic") or "—"
        diag_class = (
            "diag-high" if diag == "strong_distortion"
            else "diag-medium" if diag == "moderate_distortion"
            else "diag-low" if diag == "low_distortion"
            else ""
        )
    
        clamp = s.get("monte_carlo_worst_clamp_pct")
        clamp_txt = "—" if clamp is None else f"{clamp:.1f}%"
    
        warn = s.get("monte_carlo_warning_count")
        warn_txt = "—" if warn is None else str(warn)
    
        session_rows_html.append(
            f"""
            <tr>
              <td>{html_escape(s.get("participant_id"))}</td>
              <td>{html_escape(s.get("session_code"))}</td>
              <td>{html_escape(s.get("started_at") or "—")}</td>
              <td>{html_escape(s.get("protocol_name") or "—")}</td>
              <td style="text-align:right;">{html_escape(warn_txt)}</td>
              <td style="text-align:right;">{html_escape(clamp_txt)}</td>
              <td><span class="{diag_class}">{html_escape(diag)}</span></td>
              <td>
                <button type="button" class="btnLoadProtocol" data-protocol="{protocol_json}">
                  Laden 
                </button>
                &nbsp;·&nbsp;
                <a href="/dashboard/session/{s.get("session_id")}{qs}">Ansehen</a>
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
        <title>Fitts Monte Carlo Analyse</title>

        <style>
          body {{
            font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
            margin: 20px;
            color: #111;
            background: #f6f6f6;
          }}

          h1 {{ margin: 0 0 8px; }}
          h2 {{ margin: 22px 0 10px; font-size: 18px; }}

          .muted {{ color: #666; line-height: 1.45; }}

          .top {{
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
            margin-bottom: 14px;
          }}

          .btn {{
            display: inline-block;
            padding: 8px 10px;
            border: 1px solid #ddd;
            border-radius: 10px;
            background: #fff;
            color: #0b62d6;
            text-decoration: none;
            cursor: pointer;
          }}

          .btn:hover {{ background: #f2f2f2; }}

          .grid {{
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(4, minmax(180px, 1fr));
            max-width: 1400px;
          }}

          @media (max-width: 900px) {{
            .grid {{ grid-template-columns: repeat(2, minmax(180px, 1fr)); }}
          }}

          @media (max-width: 520px) {{
            .grid {{ grid-template-columns: 1fr; }}
          }}

          .card,
          .kpi {{
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            padding: 14px;
          }}

          .kpi b {{
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
          }}

          .kpi span {{
            font-size: 16px;
            font-variant-numeric: tabular-nums;
          }}

          .controls {{
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(4, minmax(160px, 1fr));
            max-width: 1400px;
          }}

          @media (max-width: 900px) {{
            .controls {{ grid-template-columns: repeat(2, minmax(160px, 1fr)); }}
          }}

          @media (max-width: 520px) {{
            .controls {{ grid-template-columns: 1fr; }}
          }}

          label {{
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
          }}

          input,
          select {{
            width: 100%;
            padding: 9px 10px;
            border-radius: 10px;
            border: 1px solid #ddd;
            font: inherit;
            box-sizing: border-box;
          }}

          table {{
            border-collapse: collapse;
            width: 100%;
            min-width: 1100px;
          }}

          th,
          td {{
            border-bottom: 1px solid #e5e5e5;
            padding: 8px 6px;
            text-align: right;
            font-variant-numeric: tabular-nums;
          }}

          th {{
            background: #fafafa;
            position: sticky;
            top: 0;
            z-index: 1;
          }}

          th:first-child,
          td:first-child {{
            text-align: left;
          }}

          .tableWrap {{ overflow-x: auto; }}

          .barRow {{
            display: grid;
            grid-template-columns: 110px 1fr 70px;
            gap: 10px;
            align-items: center;
            margin: 5px 0;
          }}

          .barBg {{
            height: 20px;
            background: #eee;
            border-radius: 999px;
            overflow: hidden;
            position: relative;
          }}

          .bar {{
            height: 100%;
            position: absolute;
            left: 0;
            top: 0;
          }}

          .bar.planned {{ background: rgba(120, 120, 120, 0.35); }}
          .bar.effective {{ background: #7cc4ff; }}

          .legend {{
            display: flex;
            gap: 18px;
            margin-bottom: 12px;
            font-size: 13px;
            flex-wrap: wrap;
          }}

          .legendItem {{
            display: flex;
            align-items: center;
            gap: 8px;
          }}

          .legendColor {{
            width: 14px;
            height: 14px;
            border-radius: 4px;
          }}

          .plannedColor {{ background: rgba(120, 120, 120, 0.35); }}
          .effectiveColor {{ background: #7cc4ff; }}

          svg {{
            width: 100%;
            height: 260px;
            background: #fff;
            border: 1px solid #eee;
            border-radius: 12px;
          }}

          .profileCard {{
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            padding: 14px;
          }}

          .profileCard b {{
            display: block;
            margin-bottom: 8px;
          }}
          
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
          <button class="btn" id="btnRun">Analyse starten</button>
        </div>

        <h1>Monte Carlo Analyse</h1>

        <p class="muted">
          Diese Seite simuliert geplante und effektive Zielbreiten unter
          Berücksichtigung von Viewport-, Touchability- und Clamp-Grenzen.
          Die Analyse verändert keine gespeicherten Experimente.
        </p>

        <h2>Gespeicherte Sessions</h2>
        <div class="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>Teilnehmer</th>
                <th>Session</th>
                <th>Start</th>
                <th>Protokoll</th>
                <th style="text-align:right;">Warnungen</th>
                <th style="text-align:right;">Worst Clamp</th>
                <th>Diagnose</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {''.join(session_rows_html) if session_rows_html else '<tr><td colspan="8">Keine gespeicherten Sessions.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="controls">
            <div>
              <label>Samples</label>
              <input id="n" type="number" value="50000" min="100" max="100000">
            </div>

            <div>
              <label>Histogram bins</label>
              <input id="histogramBins" type="number" value="100" min="10" max="200">
            </div>

            <div>
              <label>Sampling</label>
              <select id="sampling">
                <option value="uniform">Uniform</option>
                <option value="truncated_uniform">Safe uniform</option>
                <option value="normal">Centered normal</option>
                <option value="truncated_normal">Truncated normal</option>
              </select>
            </div>

            <div>
              <label>Protokoll-Block</label>
              <select id="protocolBlock">
                <option value="0">Block 1</option>
              </select>
            </div>

            <div>
              <label>Modus</label>
              <select id="mode">
                <option value="A_W">A_W</option>
                <option value="ID_W">ID_W</option>
                <option value="ID_A">ID_A</option>
              </select>
            </div>

            <div>
              <label>Viewport W</label>
              <input id="viewportW" type="number" value="1920">
            </div>

            <div>
              <label>Viewport H</label>
              <input id="viewportH" type="number" value="1080">
            </div>

            <div>
              <label>Touch Ø px</label>
              <input id="touchPx" type="number" value="40">
            </div>

            <div>
              <label>Required overlap</label>
              <input id="overlap" type="number" value="1" min="0" max="1" step="0.05">
            </div>

            <div>
              <label>A min relativ</label>
              <input id="aMin" type="number" value="0.05" step="0.01">
            </div>

            <div>
              <label>A max relativ</label>
              <input id="aMax" type="number" value="0.8" step="0.01">
            </div>

            <div>
              <label>W min relativ</label>
              <input id="wMin" type="number" value="0.02" step="0.01">
            </div>

            <div>
              <label>W max relativ</label>
              <input id="wMax" type="number" value="0.3" step="0.01">
            </div>

            <div>
              <label>ID min</label>
              <input id="idMin" type="number" value="1" step="0.1">
            </div>

            <div>
              <label>ID max</label>
              <input id="idMax" type="number" value="7" step="0.1">
            </div>
          </div>
        </div>

        <h2>Kontext</h2>
        <div class="grid" id="contextGrid"></div>

        <h2>Statistik</h2>
        <div class="grid" id="statsGrid"></div>

        <h2>Histogramm / PDF-Annäherung</h2>
        <div class="card">
          <div class="legend">
            <div class="legendItem">
              <div class="legendColor plannedColor"></div>
              <span>Planned distribution</span>
            </div>
            <div class="legendItem">
              <div class="legendColor effectiveColor"></div>
              <span>Effective distribution</span>
            </div>
          </div>
          <div id="histogram"></div>
        </div>

        <h2>CDF</h2>
        <div class="card">
          <p class="muted">
            Die CDF zeigt kumulative Wahrscheinlichkeiten. Sprünge an den Grenzen
            zeigen die durch Clamp erzeugte Masse an den Rändern.
          </p>
          <div id="cdf"></div>
        </div>

        <h2>Alternative Sampling Profiles</h2>
        <div class="grid" id="profileGrid"></div>

        <h2>Beispiel-Tabelle</h2>
        <div class="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Sampling</th>
                <th>A px</th>
                <th>W planned px</th>
                <th>W effective px</th>
                <th>Radius px</th>
                <th>ID</th>
                <th>Clamp min</th>
                <th>Clamp max</th>
              </tr>
            </thead>
            <tbody id="sampleRows"></tbody>
          </table>
        </div>

        <script type="module">
          import {{ runMonteCarloW }} from "/static/javascript/modules/monteCarlo.js";

          let loadedProtocol = null;

          function val(id) {{
            return Number(document.getElementById(id).value);
          }}

          function kpi(label, value) {{
            return `
              <div class="kpi">
                <b>${{label}}</b>
                <span>${{value}}</span>
              </div>
            `;
          }}

          function applyProtocolToControls(protocol, blockIndex = 0) {{
            loadedProtocol = protocol;

            const blocks = protocol.sessionBlocks || [];
            const block = blocks[blockIndex];
          
            if (!block) return;

            const blockSelect = document.getElementById("protocolBlock");

            blockSelect.innerHTML = blocks.map((_, index) =>
              `<option value="${index}">Block ${{index + 1}}</option>`
            ).join("");
          
            blockSelect.value = String(blockIndex);
          
            document.getElementById("sampling").value =
              protocol.w_sampling || "uniform";
          
            document.getElementById("mode").value =
              block.param_mode || "A_W";
          
            document.getElementById("overlap").value =
              block.required_overlap ?? 1;
          
            document.getElementById("aMin").value =
              Number(String(block.dist_entered).replace("[", "").split(",")[0]) || 0.05;
          
            document.getElementById("aMax").value =
              Number(String(block.dist_entered).replace("]", "").split(",").at(-1)) || 0.8;
          
            document.getElementById("wMin").value =
              Number(String(block.width_entered).replace("[", "").split(",")[0]) || 0.02;
          
            document.getElementById("wMax").value =
              Number(String(block.width_entered).replace("]", "").split(",").at(-1)) || 0.3;
          
            document.getElementById("idMin").value =
              Number(String(block.id_entered).replace("[", "").split(",")[0]) || 1;
          
            document.getElementById("idMax").value =
              Number(String(block.id_entered).replace("]", "").split(",").at(-1)) || 7;
          
            render(runDashboardSimulation());
          }}
          
          document.getElementById("protocolBlock").addEventListener("change", () => {{
              if (!loadedProtocol) return;
            
              const index = Number(document.getElementById("protocolBlock").value) || 0;
              applyProtocolToControls(loadedProtocol, index);
          }});

          document.querySelectorAll(".btnLoadProtocol").forEach((btn) => {{
            btn.addEventListener("click", () => {{
              try {{
                const protocol = JSON.parse(btn.dataset.protocol || "{{}}");
                applyProtocolToControls(protocol);
              }} catch (err) {{
                alert("Protokoll konnte nicht geladen werden.");
                console.error(err);
              }}
              }});
          }});

          function getSimulationConfig(samplingOverride = null) {{
            const viewportW = val("viewportW") || window.innerWidth;
            const viewportH = val("viewportH") || window.innerHeight;
            const minSide = Math.min(viewportW, viewportH);

            return {{
              n: Math.max(100, Math.min(100000, val("n") || 50000)),
              mode: document.getElementById("mode").value,
              unit: "relative",
              ARange: [val("aMin"), val("aMax")],
              WRange: [val("wMin"), val("wMax")],
              IDRange: [val("idMin"), val("idMax")],
              requiredOverlap: val("overlap") || 1,
              sampling: samplingOverride || document.getElementById("sampling").value,
              histogramBins: val("histogramBins") || 100,
              overrideViewport: {{
                width: viewportW,
                height: viewportH,
                minSide,
              }},
              state: {{
                touchDiameterPx: val("touchPx") || 40,
                mmPerPx: null,
              }},
            }};
          }}

          function runDashboardSimulation() {{
            return runMonteCarloW(getSimulationConfig());
          }}

          function runProfileComparison() {{
            const profiles = [
              "uniform",
              "truncated_uniform",
              "normal",
              "truncated_normal",
            ];

            return profiles.map((profile) =>
              runMonteCarloW(getSimulationConfig(profile))
            );
          }}

          function renderHistogram(sim) {{
            const planned = sim.distributions.planned_histogram;
            const effective = sim.distributions.effective_histogram;

            const maxValue = Math.max(
              ...planned.map(b => b.pct),
              ...effective.map(b => b.pct),
              1
            );

            document.getElementById("histogram").innerHTML =
              effective.map((bin, i) => {{
                const label = `${{bin.min.toFixed(0)}}–${{bin.max.toFixed(0)}}`;

                const p = maxValue
                  ? (100 * (planned[i]?.pct ?? 0) / maxValue)
                  : 0;

                const e = maxValue
                  ? (100 * bin.pct / maxValue)
                  : 0;

                return `
                  <div class="barRow">
                    <div>${{label}}</div>
                    <div class="barBg">
                      <div class="bar planned" style="width:${{p}}%"></div>
                      <div class="bar effective" style="width:${{e}}%"></div>
                    </div>
                    <div>${{bin.pct.toFixed(2)}}%</div>
                  </div>
                `;
              }}).join("");
          }}

          function makeSvgPolyline(points, minX, maxX, width, height, margin) {{
            return points.map((p) => {{
              const x = margin + ((p.x - minX) / (maxX - minX)) * (width - 2 * margin);
              const y = height - margin - p.y * (height - 2 * margin);
              return `${{x.toFixed(1)}},${{y.toFixed(1)}}`;
            }}).join(" ");
          }}

          function renderCDF(sim) {{
            const planned = sim.distributions.planned_cdf;
            const effective = sim.distributions.effective_cdf;

            const width = 900;
            const height = 260;
            const margin = 32;
            const minX = sim.meta.chart_min_px;
            const maxX = sim.meta.chart_max_px;

            const plannedPoints = makeSvgPolyline(planned, minX, maxX, width, height, margin);
            const effectivePoints = makeSvgPolyline(effective, minX, maxX, width, height, margin);

            document.getElementById("cdf").innerHTML = `
              <svg viewBox="0 0 ${{width}} ${{height}}" preserveAspectRatio="none">
                <line x1="${{margin}}" y1="${{height - margin}}" x2="${{width - margin}}" y2="${{height - margin}}" stroke="#ccc" />
                <line x1="${{margin}}" y1="${{margin}}" x2="${{margin}}" y2="${{height - margin}}" stroke="#ccc" />

                <text x="${{margin}}" y="18" font-size="12" fill="#666">CDF</text>
                <text x="${{width - margin - 90}}" y="${{height - 8}}" font-size="12" fill="#666">W px</text>

                <polyline points="${{plannedPoints}}" fill="none" stroke="rgba(120,120,120,0.8)" stroke-width="3" />
                <polyline points="${{effectivePoints}}" fill="none" stroke="#1687d9" stroke-width="3" />
              </svg>
            `;
          }}

          function renderProfileComparison() {{
            const profileSims = runProfileComparison();

            document.getElementById("profileGrid").innerHTML =
              profileSims.map((p) => `
                <div class="profileCard">
                  <b>${{p.meta.sampling}}</b>
                  <div class="muted">
                    Clamp total: ${{p.counts.clamped_total_pct.toFixed(2)}}%<br>
                    Clamp min: ${{p.counts.clamped_min_pct.toFixed(2)}}%<br>
                    Clamp max: ${{p.counts.clamped_max_pct.toFixed(2)}}%<br>
                    Mean effective W: ${{p.summary.effective_w_px.mean.toFixed(1)}} px<br>
                    SD effective W: ${{p.summary.effective_w_px.sd.toFixed(1)}} px<br>
                    Diagnostic: ${{p.summary.diagnostic}}
                  </div>
                </div>
              `).join("");
          }}

          function render(sim) {{
            const m = sim.meta;
            const c = sim.counts;
            const s = sim.summary;

            document.getElementById("contextGrid").innerHTML = [
              kpi("Machine", navigator.platform || "—"),
              kpi("Viewport", `${{m.viewport_w}}×${{m.viewport_h}}`),
              kpi("Touch Ø", `${{m.touch_diameter_px.toFixed(1)}} px`),
              kpi("W min", `${{m.min_target_px.toFixed(1)}} px`),
              kpi("W max", `${{m.max_target_px.toFixed(1)}} px`),
              kpi("Mode", m.mode),
              kpi("Samples", c.total),
              kpi("Sampling", m.sampling),
            ].join("");

            document.getElementById("statsGrid").innerHTML = [
              kpi("Clamp min", `${{c.clamped_min_pct.toFixed(2)}}%`),
              kpi("Clamp max", `${{c.clamped_max_pct.toFixed(2)}}%`),
              kpi("Clamp total", `${{c.clamped_total_pct.toFixed(2)}}%`),
              kpi("Diagnostic", s.diagnostic),
              kpi("Planned mean", `${{s.planned_w_px.mean.toFixed(1)}} px`),
              kpi("Effective mean", `${{s.effective_w_px.mean.toFixed(1)}} px`),
              kpi("Planned SD", `${{s.planned_w_px.sd.toFixed(1)}} px`),
              kpi("Effective SD", `${{s.effective_w_px.sd.toFixed(1)}} px`),
            ].join("");

            renderHistogram(sim);
            renderCDF(sim);
            renderProfileComparison();

            document.getElementById("sampleRows").innerHTML =
              sim.rows.slice(0, 120).map((r) => `
                <tr>
                  <td>${{r.index}}</td>
                  <td>${{r.sampling}}</td>
                  <td>${{Number.isFinite(r.A_px) ? r.A_px.toFixed(1) : "—"}}</td>
                  <td>${{r.W_px_planned.toFixed(1)}}</td>
                  <td>${{r.W_px_effective.toFixed(1)}}</td>
                  <td>${{r.radius_px_effective.toFixed(1)}}</td>
                  <td>${{Number.isFinite(r.ID_in) ? r.ID_in.toFixed(2) : "—"}}</td>
                  <td>${{r.clamped_min ? "yes" : "no"}}</td>
                  <td>${{r.clamped_max ? "yes" : "no"}}</td>
                </tr>
              `).join("");
          }}

          document.getElementById("btnRun").addEventListener("click", () => {{
            render(runDashboardSimulation());
          }});

          render(runDashboardSimulation());
        </script>
      </body>
    </html>
    """

    return Response(page, mimetype="text/html")