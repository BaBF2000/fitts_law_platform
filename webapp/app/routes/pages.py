"""
Page and PWA route handlers.

Organigram reference:
- Backend
  -> Routing Layer
  -> Page and PWA Routes

Responsibility:
Defines routes for the main experiment page, Progressive Web App assets and a
small admin-protected route map endpoint.

This module does not handle experiment results, protocol persistence or exports.
It only serves frontend entry points and PWA-related files.
"""

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
    Render the main experiment user interface.

    Returns:
        str: Rendered HTML template for the Fitts Display Lab frontend.

    Related files:
        templates/index.html defines the main UI structure.
        static/javascript/main.js initializes the frontend behavior.
    """
    return render_template("index.html")


@bp.get("/manifest.webmanifest")
def manifest_root():
    """
    Serve the PWA manifest from the root-level manifest URL.

    Returns:
        flask.Response: Manifest file response with the correct PWA MIME type.

    Purpose:
        Some browsers expect the web manifest to be reachable from a root-level
        URL. This route maps that request to the manifest stored in static/pwa.
    """
    return send_from_directory(
        get_static_folder(),
        "pwa/manifest.webmanifest",
        mimetype="application/manifest+json",
    )


@bp.get("/static/pwa/manifest.webmanifest")
def manifest_static():
    """
    Serve the PWA manifest through its static-compatible path.

    Returns:
        flask.Response: Manifest file response with the correct PWA MIME type.

    Purpose:
        Keeps compatibility with frontend references that directly use the
        static/pwa path.
    """
    return send_from_directory(
        get_static_folder(),
        "pwa/manifest.webmanifest",
        mimetype="application/manifest+json",
    )


@bp.get("/sw.js")
def service_worker():
    """
    Serve the Service Worker from the root scope.

    Returns:
        flask.Response: JavaScript service worker file response.

    Side effects:
        Adds the Service-Worker-Allowed header so the service worker can control
        the application scope starting at '/'.

    Related files:
        static/pwa/sw.js contains the service worker implementation.
    """
    response = send_from_directory(
        get_static_folder(),
        "pwa/sw.js",
        mimetype="application/javascript",
    )

    # Allow the service worker to control the root application scope.
    response.headers["Service-Worker-Allowed"] = "/"

    return response


@bp.get("/routes")
def route_map():
    """
    Return the Flask route map for debugging.

    Returns:
        flask.Response: Plain-text representation of current_app.url_map.
        Returns HTTP 403 if the current request is not admin-authorized.

    Security:
        This route is admin-protected because it exposes internal backend
        endpoints and should not be visible during normal experiment use.

    Related modules:
        Uses require_admin() from app.routes.helpers.
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