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
    Build HTML table rows for recent sessions

    Args:
        sessions (list[dict]): Session records loaded from the database
        qs (str): Admin query string, usually used to preserve ?token=...
            across dashboard links

    Returns:
        str: Concatenated HTML table rows

    Side effects:
        None. This function only builds an HTML string

    Related modules:
        Called by app.routes.montecarlo_dashboard.dashboard_montecarlo()
        The full page layout is created in page_builder.py
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
    Build one HTML table row for one saved session

    Args:
        session (dict): One session record containing identifiers, protocol
            metadata and stored Monte Carlo diagnostic values
        qs (str): Admin query string appended to internal dashboard links

    Returns:
        str: HTML <tr> element for the Monte Carlo session table

    Side effects:
        None

    Security:
        Dynamic values are escaped with html_escape() before being inserted into
        the HTML output. This is especially important because the protocol JSON
        is embedded into a data-protocol attribute for frontend reloading

    Related usage:
        The generated row contains a button that allows the frontend dashboard
        to reload the saved protocol snapshot
    """
    # Escape protocol JSON before embedding it into a data attribute
    # The frontend uses this value to reload the saved protocol snapshot
    protocol_json = html_escape(session.get("protocol_json") or "")

    diagnostic = session.get("monte_carlo_worst_diagnostic") or "—"

    # Convert the stored diagnostic label into a CSS class for severity styling
    diagnostic_class = get_diagnostic_class(diagnostic)

    clamp = session.get("monte_carlo_worst_clamp_pct")
    
        # Format optional Monte Carlo summary values for table display
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
    Map a Monte Carlo diagnostic label to a CSS class

    Args:
        diagnostic (str): Stored diagnostic label, for example
            'strong_distortion', 'moderate_distortion' or 'low_distortion'

    Returns:
        str: CSS class name used for visual severity highlighting. Returns an
        empty string for unknown or missing diagnostic labels

    Side effects:
        None

    Related modules:
        The returned class names are styled in the Monte Carlo dashboard page
        built by page_builder.py
    """
    if diagnostic == "strong_distortion":
        return "diag-high"

    if diagnostic == "moderate_distortion":
        return "diag-medium"

    if diagnostic == "low_distortion":
        return "diag-low"

    return ""