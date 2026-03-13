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
    Optional admin protection for dashboard/exports.

    If ADMIN_TOKEN is empty => access is open.
    If token is set => allow access only if:
      - ?token=... matches, OR
      - X-Admin-Token header matches
    """
    required = (current_app.config.get("ADMIN_TOKEN") or "").strip()
    if not required:
        return True

    token = (request.args.get("token") or request.headers.get("X-Admin-Token") or "").strip()
    return token == required


def admin_qs() -> str:
    """
    Return a query string that preserves ?token=... across dashboard links.

    Note:
      - Browsers cannot add custom headers via <a href>, so if the user authenticates
        with headers only, dashboard links would fail. Preserving ?token keeps the
        navigation working when a token is used in the URL.
      - If no token is present in the URL, we do not add anything.
    """
    t = (request.args.get("token") or "").strip()
    return f"?token={t}" if t else ""


# ---------------- Pages ----------------

@bp.get("/")
def index():
    return render_template("index.html")


@bp.get("/manifest.webmanifest")
def manifest_root():
    # Served from /static/pwa/manifest.webmanifest but exposed at root for PWA install.
    return send_from_directory(
        current_app.static_folder,
        "pwa/manifest.webmanifest",
        mimetype="application/manifest+json",
    )


@bp.get("/static/pwa/manifest.webmanifest")
def manifest_static():
    # Compatibility route for direct static access.
    return send_from_directory(
        current_app.static_folder,
        "pwa/manifest.webmanifest",
        mimetype="application/manifest+json",
    )


@bp.get("/sw.js")
def sw():
    # Service Worker must be served at the scope root to control "/" and subpaths.
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
    Optional debug endpoint: prints Flask route map.

    Keep it admin-protected to avoid exposing internal endpoints by accident.
    """
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")
    return Response(str(current_app.url_map), mimetype="text/plain")


# ---------------- API ----------------

@bp.get("/check_ids")
def check_ids():
    """
    Check whether participant/session IDs already exist.

    Used by the frontend to prevent accidental overwrites before saving a run.
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
    Persist one full experiment run:
      - Create participant row if needed
      - Create a session row
      - Insert all trials belonging to that session

    The endpoint rejects duplicates (participant_id, session_code).
    """
    payload = request.get_json(silent=True) or {}
    rows = payload.get("rows") or []
    meta = payload.get("meta") or {}

    if not isinstance(rows, list) or not rows:
        return jsonify({"ok": False, "error": "No rows"}), 400
    if not isinstance(rows[0], dict):
        return jsonify({"ok": False, "error": "Rows must be objects"}), 400

    pid = safe_name(meta.get("participant_id"), "P")
    scode = safe_name(meta.get("session_id"), "S")

    # Session metadata (stored once per run)
    unit = meta.get("unit")
    formula = meta.get("formula")
    timeout_ms = meta.get("timeout_ms")
    trial_count = meta.get("trial_count")
    target_shape = meta.get("target_shape")

    mm_per_px = meta.get("mm_per_px")
    viewport_w = meta.get("viewport_w")
    viewport_h = meta.get("viewport_h")
    dpr = meta.get("dpr")
    user_agent = meta.get("user_agent")
    device_context_json = meta.get("device_context_json")

    is_demo = 1 if meta.get("is_demo") else 0
    started_at = now_iso_seconds()

    def get_field(r: dict, key: str):
        return r.get(key)

    # Serialize writes to reduce "database is locked" spikes under concurrent requests.
    with DB_WRITE_LOCK:
        with db() as conn:
            cur = conn.cursor()

            # Enforce uniqueness at application level to return a clear error code.
            cur.execute(
                """
                SELECT id
                FROM session
                WHERE participant_id = ? AND session_code = ?
                LIMIT 1
                """,
                (pid, scode),
            )
            if cur.fetchone():
                return jsonify({"ok": False, "error": "Session already exists"}), 409

            cur.execute(
                "INSERT OR IGNORE INTO participant(participant_id) VALUES (?)",
                (pid,),
            )

            cur.execute(
                """
                INSERT INTO session(
                  participant_id, session_code, started_at, is_demo,
                  unit, formula, timeout_ms, trial_count, target_shape,
                  mm_per_px, viewport_w, viewport_h, dpr, user_agent, device_context_json
                )
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    pid,
                    scode,
                    started_at,
                    is_demo,
                    unit,
                    formula,
                    timeout_ms,
                    trial_count,
                    target_shape,
                    mm_per_px,
                    viewport_w,
                    viewport_h,
                    dpr,
                    user_agent,
                    device_context_json,
                ),
            )
            session_db_id = cur.lastrowid

            for r in rows:
                cur.execute(
                    """
                    INSERT INTO trial(
                      session_id, trial_no, timestamp_iso,
                      target_shape, target_bbox_left, target_bbox_top, target_bbox_w, target_bbox_h,
                      target_hit_geom_json,
                      A_in, W_in, ID_in,
                      A_px_planned, W_px, A_mm_planned, W_mm, ID_planned,
                      D_px_effective, D_mm_effective, ID_effective,
                      prev_x, prev_y, x, y, placed,
                      mt_ms, errors, error_reasons, clicks_before_hit
                    )
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        session_db_id,
                        get_field(r, "trial_no"),
                        get_field(r, "timestamp_iso"),
                        get_field(r, "target_shape"),
                        get_field(r, "target_bbox_left"),
                        get_field(r, "target_bbox_top"),
                        get_field(r, "target_bbox_w"),
                        get_field(r, "target_bbox_h"),
                        get_field(r, "target_hit_geom_json"),
                        get_field(r, "A_in"),
                        get_field(r, "W_in"),
                        get_field(r, "ID_in"),
                        get_field(r, "A_px_planned"),
                        get_field(r, "W_px"),
                        get_field(r, "A_mm_planned"),
                        get_field(r, "W_mm"),
                        get_field(r, "ID_planned"),
                        get_field(r, "D_px_effective"),
                        get_field(r, "D_mm_effective"),
                        get_field(r, "ID_effective"),
                        get_field(r, "prev_x"),
                        get_field(r, "prev_y"),
                        get_field(r, "x"),
                        get_field(r, "y"),
                        get_field(r, "placed"),
                        get_field(r, "mt_ms"),
                        get_field(r, "errors"),
                        get_field(r, "error_reasons"),
                        get_field(r, "clicks_before_hit"),
                    ),
                )

            conn.commit()

    return jsonify({"ok": True, "saved_to": "data/fitts.db", "session_row_id": session_db_id}), 200


@bp.get("/sessions/<participant_id>")
def list_sessions(participant_id: str):
    """
    Lightweight JSON listing of sessions for a participant.
    """
    pid = safe_name(participant_id, "P")

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, session_code, started_at, is_demo, unit, formula, timeout_ms, trial_count, target_shape
            FROM session
            WHERE participant_id = ?
            ORDER BY started_at DESC
            """,
            (pid,),
        )
        rows = [dict(r) for r in cur.fetchall()]

    return jsonify({"ok": True, "participant_id": pid, "sessions": rows})


# ---------------- Export CSV (admin) ----------------

@bp.get("/export/participant/<participant_id>.csv")
def export_participant_csv(participant_id: str):
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    pid = safe_name(participant_id, "P")

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            CSV_SELECT
            + """
            WHERE p.participant_id = ?
            ORDER BY s.started_at ASC, t.trial_no ASC
            """,
            (pid,),
        )
        rows = cur.fetchall()

    if not rows:
        return jsonify({"ok": False, "error": "No data"}), 404

    return rows_to_csv_response(rows, f"{pid}.csv")


@bp.get("/export/session/<participant_id>/<session_code>.csv")
def export_session_csv(participant_id: str, session_code: str):
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    pid = safe_name(participant_id, "P")
    scode = safe_name(session_code, "S")

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            CSV_SELECT
            + """
            WHERE p.participant_id = ? AND s.session_code = ?
            ORDER BY t.trial_no ASC
            """,
            (pid, scode),
        )
        rows = cur.fetchall()

    if not rows:
        return jsonify({"ok": False, "error": "No data"}), 404

    return rows_to_csv_response(rows, f"{pid}_{scode}.csv")


@bp.get("/export/session_id/<int:session_id>.csv")
def export_session_by_id_csv(session_id: int):
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            CSV_SELECT
            + """
            WHERE s.id = ?
            ORDER BY t.trial_no ASC
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
    if not require_admin():
        return Response("Forbidden (admin)", status=403, mimetype="text/plain")

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT p.participant_id,
                   COUNT(s.id) AS session_count,
                   MAX(s.started_at) AS last_started_at
            FROM participant p
            LEFT JOIN session s ON s.participant_id = p.participant_id
            GROUP BY p.participant_id
            ORDER BY (last_started_at IS NULL) ASC, last_started_at DESC, p.participant_id ASC
            """
        )
        participants = [dict(r) for r in cur.fetchall()]

    qs = admin_qs()

    rows_html = []
    for p in participants:
        pid = p["participant_id"]
        sc = p["session_count"] or 0
        last = p["last_started_at"] or "—"
        rows_html.append(
            f"""
            <tr>
              <td><a href="/dashboard/participant/{html_escape(pid)}{qs}">{html_escape(pid)}</a></td>
              <td style="text-align:right;">{sc}</td>
              <td>{html_escape(last)}</td>
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
            </tbody>
          </table>
        </div>

        <script>
          const q = document.getElementById('q');
          const rows = Array.from(document.querySelectorAll('tbody tr'));
          q.addEventListener('input', () => {{
            const v = q.value.toLowerCase().trim();
            rows.forEach(r => {{
              const pid = (r.querySelector('td')?.innerText || '').toLowerCase();
              r.style.display = pid.includes(v) ? '' : 'none';
            }});
          }});
        </script>
      </body>
    </html>
    """
    return Response(page, mimetype="text/html")


@bp.get("/dashboard/participant/<participant_id>")
def dashboard_participant(participant_id: str):
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
              s.unit,
              s.formula,
              s.timeout_ms,
              s.trial_count,
              s.target_shape,

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
        sessions = [dict(r) for r in cur.fetchall()]

    rows_html = []
    for s in sessions:
        sid = s["session_id"]
        scode = s["session_code"]
        started = s["started_at"] or "—"
        demo = "DEMO" if (s["is_demo"] or 0) else "RUN"
        unit = s["unit"] or "—"
        formula = s["formula"] or "—"
        shape = s["target_shape"] or "—"
        tmo = s["timeout_ms"] if s["timeout_ms"] is not None else "—"

        trials = s["trials_saved"] or 0
        errs = s["errors_total"] or 0
        mt_avg = s["mt_avg"]
        id_avg = s["id_avg"]

        mt_txt = f"{mt_avg:.1f} ms" if mt_avg is not None else "—"
        id_txt = f"{id_avg:.3f}" if id_avg is not None else "—"

        rows_html.append(
            f"""
            <tr>
              <td>{html_escape(scode)}</td>
              <td>{html_escape(started)}</td>
              <td>{demo}</td>
              <td>{html_escape(unit)}</td>
              <td>{html_escape(formula)}</td>
              <td>{html_escape(shape)}</td>
              <td style="text-align:right;">{html_escape(tmo)}</td>
              <td style="text-align:right;">{trials}</td>
              <td style="text-align:right;">{errs}</td>
              <td style="text-align:right;">{html_escape(mt_txt)}</td>
              <td style="text-align:right;">{html_escape(id_txt)}</td>
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
          .card {{ border:1px solid #e5e5e5; border-radius: 12px; padding: 14px; max-width: 1200px; }}
          table {{ border-collapse: collapse; width: 100%; max-width: 1200px; }}
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
                <th>Modus</th>
                <th>Einheit</th>
                <th>Formel</th>
                <th>Form</th>
                <th style="text-align:right;">Timeout</th>
                <th style="text-align:right;">Trials</th>
                <th style="text-align:right;">Fehler</th>
                <th style="text-align:right;">MT Ø</th>
                <th style="text-align:right;">ID Ø</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {''.join(rows_html) if rows_html else '<tr><td colspan="12">Keine Sessions.</td></tr>'}
            </tbody>
          </table>
        </div>
      </body>
    </html>
    """
    return Response(page, mimetype="text/html")


@bp.get("/dashboard/session/<int:session_id>")
def dashboard_session(session_id: int):
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
              s.unit,
              s.formula,
              s.timeout_ms,
              s.trial_count,
              s.target_shape,
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
              trial_no, timestamp_iso, mt_ms, errors, error_reasons, clicks_before_hit,
              COALESCE(ID_effective, ID_planned) AS id_used
            FROM trial
            WHERE session_id = ?
            ORDER BY trial_no ASC
            LIMIT 80
            """,
            (session_id,),
        )
        trials = [dict(r) for r in cur.fetchall()]

    def fmt(x, nd=1):
        return "—" if x is None else f"{x:.{nd}f}"

    pid = meta["participant_id"]
    scode = meta["session_code"]
    mode = "DEMO" if (meta.get("is_demo") or 0) else "RUN"

    rows_html = ""
    for t in trials:
        rows_html += f"""
          <tr>
            <td style="text-align:right;">{html_escape(t.get("trial_no"))}</td>
            <td style="text-align:right;">{html_escape(fmt(t.get("mt_ms"), 1))}</td>
            <td style="text-align:right;">{html_escape(t.get("errors", 0))}</td>
            <td>{html_escape(t.get("error_reasons") or "")}</td>
            <td style="text-align:right;">{html_escape(t.get("clicks_before_hit"))}</td>
            <td style="text-align:right;">{html_escape(fmt(t.get("id_used"), 3))}</td>
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
          .grid {{ display:grid; gap:12px; grid-template-columns: repeat(4, minmax(180px, 1fr)); max-width: 1100px; }}
          @media (max-width: 900px) {{ .grid {{ grid-template-columns: repeat(2, minmax(180px, 1fr)); }} }}
          @media (max-width: 520px) {{ .grid {{ grid-template-columns: 1fr; }} }}
          .kpi {{ border:1px solid #e5e5e5; border-radius:12px; padding:12px; background:#fff; }}
          .kpi b {{ display:block; font-size:12px; color:#666; margin-bottom:4px; }}
          .kpi span {{ font-size:16px; }}
          .card {{ border:1px solid #e5e5e5; border-radius: 12px; padding: 14px; max-width: 1100px; background:#fff; }}
          .muted {{ color:#666; }}
          table {{ border-collapse: collapse; width: 100%; }}
          th, td {{ border-bottom: 1px solid #e5e5e5; padding: 8px 6px; }}
          th {{ text-align:left; background:#fafafa; position: sticky; top: 0; }}
          code {{ background:#f6f6f6; padding:2px 6px; border-radius:6px; }}
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
          Einheit: <code>{html_escape(meta.get("unit") or "—")}</code> ·
          Formel: <code>{html_escape(meta.get("formula") or "—")}</code> ·
          Form: <code>{html_escape(meta.get("target_shape") or "—")}</code>
        </p>

        <div class="grid">
          <div class="kpi"><b>Gespeicherte Trials</b><span>{html_escape(meta.get("trials_saved"))}</span></div>
          <div class="kpi"><b>Fehler gesamt</b><span>{html_escape(meta.get("errors_total"))}</span></div>
          <div class="kpi"><b>MT Ø</b><span>{fmt(meta.get("mt_avg"),1)} ms</span></div>
          <div class="kpi"><b>ID Ø</b><span>{fmt(meta.get("id_avg"),3)}</span></div>
          <div class="kpi"><b>MT min</b><span>{fmt(meta.get("mt_min"),1)} ms</span></div>
          <div class="kpi"><b>MT max</b><span>{fmt(meta.get("mt_max"),1)} ms</span></div>
          <div class="kpi"><b>Timeout</b><span>{html_escape(meta.get("timeout_ms") if meta.get("timeout_ms") is not None else "—")}</span></div>
          <div class="kpi"><b>Trial-Anzahl (deklariert)</b><span>{html_escape(meta.get("trial_count") if meta.get("trial_count") is not None else "—")}</span></div>
        </div>

        <div class="card" style="margin-top:14px;">
          <h3 style="margin:0 0 8px;">Trials (bis zu 80)</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align:right;">#</th>
                <th style="text-align:right;">MT (ms)</th>
                <th style="text-align:right;">Fehler</th>
                <th>Fehlergründe</th>
                <th style="text-align:right;">Klicks</th>
                <th style="text-align:right;">ID</th>
              </tr>
            </thead>
            <tbody>
              {rows_html if rows_html else '<tr><td colspan="6">Keine Trials.</td></tr>'}
            </tbody>
          </table>
        </div>
      </body>
    </html>
    """
    return Response(page, mimetype="text/html")