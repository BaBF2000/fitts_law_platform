"""
Monte Carlo dashboard route.

Organigram reference:
- Persistence & Backend
  -> Admin Dashboard
  -> Monte Carlo Dashboard

Responsibility:
Defines the admin-protected route for the Monte Carlo analysis dashboard.

This module acts as a thin route controller:
- it checks admin access,
- loads recent session data,
- builds the session table rows,
- delegates full HTML page construction to the Monte Carlo page builder.

Important:
The SQL query logic and HTML generation are intentionally split into
app.routes.montecarlo.* modules to keep this route file short and readable.
"""

from __future__ import annotations

from flask import Response

from app.routes import bp

from .helpers import (
    require_admin,
    admin_qs,
)

from .montecarlo.queries import (
    load_recent_sessions,
)

from .montecarlo.session_rows import (
    build_session_rows_html,
)

from .montecarlo.page_builder import (
    build_montecarlo_dashboard_page,
)


@bp.get("/dashboard/montecarlo")
def dashboard_montecarlo():
    """
    Render the admin Monte Carlo dashboard

    Returns:
        flask.Response:
            - HTML dashboard page if admin access is allowed
            - 403 plain-text response if admin authorization fails

    Database access:
        Loads recent sessions through load_recent_sessions()

    Side effects:
        None. This route only reads data and returns an HTML response

    Related modules:
        - app.routes.montecarlo.queries loads session data
        - app.routes.montecarlo.session_rows builds table row HTML
        - app.routes.montecarlo.page_builder builds the full dashboard page
    """
    if not require_admin():
        return Response(
            "Forbidden (admin)",
            status=403,
            mimetype="text/plain",
        )

    # Preserve the admin token in links generated inside the dashboard
    qs = admin_qs()

    # Load recent sessions with stored Monte Carlo summary/diagnostic metadata
    sessions = load_recent_sessions()

    # Convert session records into HTML table rows
    session_rows_html = build_session_rows_html(
        sessions=sessions,
        qs=qs,
    )
    
    # Build the complete dashboard HTML page
    page = build_montecarlo_dashboard_page(
        qs=qs,
        session_rows_html=session_rows_html,
    )

    return Response(
        page,
        mimetype="text/html",
    )