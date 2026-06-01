"""
Monte Carlo dashboard route.
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
    Render the admin Monte Carlo dashboard.
    """
    if not require_admin():
        return Response(
            "Forbidden (admin)",
            status=403,
            mimetype="text/plain",
        )

    qs = admin_qs()
    sessions = load_recent_sessions()

    session_rows_html = build_session_rows_html(
        sessions=sessions,
        qs=qs,
    )

    page = build_montecarlo_dashboard_page(
        qs=qs,
        session_rows_html=session_rows_html,
    )

    return Response(
        page,
        mimetype="text/html",
    )