"""
Monte Carlo dashboard session row rendering.

Organigram reference:
- Persistence & Backend
  -> Admin Dashboard
     -> Monte Carlo Analysis
     -> Session Table

Responsibility:
Builds the HTML table rows for the saved-session list shown on the
Monte Carlo dashboard.

Important:
This module only renders table rows.
The full page layout belongs in page_builder.py.
"""

from __future__ import annotations

from app.db import html_escape


def build_session_rows_html(
    *,
    sessions: list[dict],
    qs: str,
) -> str:
    """
    Build HTML table rows for recent sessions.
    """
    rows = [
        build_session_row_html(
            session=session,
            qs=qs,
        )
        for session in sessions
    ]

    return "".join(rows)


def build_session_row_html(
    *,
    session: dict,
    qs: str,
) -> str:
    """
    Build one HTML table row for one saved session.
    """
    protocol_json = html_escape(session.get("protocol_json") or "")

    diagnostic = session.get("monte_carlo_worst_diagnostic") or "—"

    diagnostic_class = get_diagnostic_class(diagnostic)

    clamp = session.get("monte_carlo_worst_clamp_pct")

    clamp_text = "—" if clamp is None else f"{clamp:.1f}%"

    warning_count = session.get("monte_carlo_warning_count")

    warning_text = "—" if warning_count is None else str(warning_count)

    session_id = session.get("session_id")

    return f"""
    <tr>
      <td>{html_escape(session.get("participant_id"))}</td>
      <td>{html_escape(session.get("session_code"))}</td>
      <td>{html_escape(session.get("started_at") or "—")}</td>
      <td>{html_escape(session.get("protocol_name") or "—")}</td>
      <td style="text-align:right;">{html_escape(warning_text)}</td>
      <td style="text-align:right;">{html_escape(clamp_text)}</td>
      <td>
        <span class="{diagnostic_class}">
          {html_escape(diagnostic)}
        </span>
      </td>
      <td>
        <button
          type="button"
          class="btnLoadProtocol"
          data-protocol="{protocol_json}">
          Laden
        </button>
        &nbsp;·&nbsp;
        <a href="/dashboard/session/{session_id}{qs}">Ansehen</a>
      </td>
    </tr>
    """


def get_diagnostic_class(diagnostic: str) -> str:
    """
    Return the CSS class for a Monte-Carlo diagnostic label.
    """
    if diagnostic == "strong_distortion":
        return "diag-high"

    if diagnostic == "moderate_distortion":
        return "diag-medium"

    if diagnostic == "low_distortion":
        return "diag-low"

    return ""