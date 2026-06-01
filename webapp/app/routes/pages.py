from __future__ import annotations


from flask import (
    Response,
    current_app,
    render_template,
    send_from_directory,
)

from app.routes import bp

from .helpers import require_admin, get_static_folder


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
        get_static_folder(),
        "pwa/manifest.webmanifest",
        mimetype="application/manifest+json",
    )


@bp.get("/static/pwa/manifest.webmanifest")
def manifest_static():
    """
    Compatibility route for direct static manifest access.
    """
    return send_from_directory(
        get_static_folder(),
        "pwa/manifest.webmanifest",
        mimetype="application/manifest+json",
    )


@bp.get("/sw.js")
def service_worker():
    """
    Serve the Service Worker at root scope.
    """
    response = send_from_directory(
        get_static_folder(),
        "pwa/sw.js",
        mimetype="application/javascript",
    )

    response.headers["Service-Worker-Allowed"] = "/"

    return response


@bp.get("/routes")
def route_map():
    """
    Debug endpoint showing the Flask route map.

    Admin-protected to avoid exposing internal routes unintentionally.
    """
    if not require_admin():
        return Response(
            "Forbidden (admin)",
            status=403,
            mimetype="text/plain",
        )

    return Response(
        str(current_app.url_map),
        mimetype="text/plain",
    )