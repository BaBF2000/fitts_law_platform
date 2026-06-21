from __future__ import annotations

import os

from flask import Flask, Response, request
from werkzeug.middleware.proxy_fix import ProxyFix

from .db import ensure_columns, init_db
from .routes import bp as routes_bp
from .security import is_private_client


def create_app() -> Flask:
    """
    Flask application factory.

    Centralizes:
      - environment-driven configuration
      - LAN-only restriction (optional public override)
      - optional admin-token protection for admin endpoints
      - cache-control behavior (dev vs production)
      - optional trusted reverse-proxy support (ProxyFix)
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    app = Flask(
        __name__,
        static_folder=os.path.join(base_dir, "static"),
        static_url_path="/static",
        template_folder=os.path.join(base_dir, "templates"),
    )

    # ---------------------------------------------------------------------
    # Environment configuration
    # ---------------------------------------------------------------------

    # DEV_NO_CACHE=1 disables caching for static/PWA assets to avoid stale JS/CSS
    # during tablet testing or rapid iteration.
    app.config["DEV_NO_CACHE"] = os.environ.get("DEV_NO_CACHE", "0") == "1"

    # ADMIN_TOKEN enables a lightweight protection for admin endpoints.
    # Token can be passed via ?token=... or X-Admin-Token: ...
    app.config["ADMIN_TOKEN"] = os.environ.get("ADMIN_TOKEN", "").strip()

    # ALLOW_PUBLIC=1 disables LAN-only restriction (useful for controlled external testing).
    # Keep it OFF for real deployments on a local network.
    app.config["ALLOW_PUBLIC"] = os.environ.get("ALLOW_PUBLIC", "0") == "1"

    # TRUST_PROXY=1 enables ProxyFix to trust exactly one proxy hop (e.g., ngrok/nginx).
    # Only enable this if you control the proxy and understand the risk.
    if os.environ.get("TRUST_PROXY", "0") == "1":
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # Admin route prefixes can be overridden via ADMIN_PREFIXES="..., ...".
    prefixes_env = os.environ.get("ADMIN_PREFIXES", "").strip()
    if prefixes_env:
        app.config["ADMIN_PREFIXES"] = tuple(
            p.strip() for p in prefixes_env.split(",") if p.strip()
        )
    else:
        app.config["ADMIN_PREFIXES"] = ("/dashboard", "/export/", "/routes")

    # ---------------------------------------------------------------------
    # Helper utilities
    # ---------------------------------------------------------------------

    def get_client_ip() -> str:
        """
        Return the client IP address as seen by Flask. 
        Returns: 
            str: Client IP address or an empty string if Flask does not provide one. 
        Notes: 
            If TRUST_PROXY=1 is enabled, ProxyFix updates request.remote_addr 
            based on the X-Forwarded-For header. This should only be used behind 
            a trusted reverse proxy. 
        """
        return request.remote_addr or ""

    def is_admin_path(path: str) -> bool:
        """ 
        Check whether a request path belongs to an admin-protected route group. 
        Args: 
            path (str): Current HTTP request path. 
        Returns: 
            bool: True if the path matches one of the configured admin prefixes. 
        Notes: 
            The prefixes are read from app.config["ADMIN_PREFIXES"] and can be 
            configured through the ADMIN_PREFIXES environment variable. 
        """
        prefixes = app.config.get("ADMIN_PREFIXES", ())
        return any(path == p or path.startswith(p) for p in prefixes)

    def has_valid_admin_token() -> bool:
        """ 
        Validate the optional admin token for protected backend routes.
        Returns: 
            bool: True if the configured token matches either the query parameter 
            'token' or the HTTP header 'X-Admin-Token'. False if no token is 
            configured or if the provided token is invalid. 
        Side effects: 
            None. This function only reads request data and application config. 
        """
        required = app.config.get("ADMIN_TOKEN", "")
        if not required:
            return False

        q = (request.args.get("token") or "").strip()
        h = (request.headers.get("X-Admin-Token") or "").strip()
        return (q == required) or (h == required)

    # ---------------------------------------------------------------------
    # Request guard
    # ---------------------------------------------------------------------

    @app.before_request
    def lan_only_guard():
        """
        Enforce the access policy before each request.
    
        Access rules:
            1. If ALLOW_PUBLIC=1, all clients are accepted.
            2. Otherwise, only private/LAN client IP addresses are accepted.
            3. If ADMIN_TOKEN is configured, admin route prefixes require a valid token.
    
        Returns:
            None: The request is allowed to continue.
            Response: A plain-text 403 response if the request is forbidden.
    
        Side effects:
            May stop request processing before the matched route handler is executed.
    
        Related modules:
            Uses security.is_private_client() to classify client IP addresses.
            Uses ADMIN_PREFIXES from app.config to identify admin-protected routes.
        """
        if app.config.get("ALLOW_PUBLIC", False):
            return None

        if not is_private_client(get_client_ip()):
            # Keep responses simple (no HTML) for kiosk-like clients.
            return Response("Forbidden (LAN only)", status=403, mimetype="text/plain")

        if is_admin_path(request.path) and app.config.get("ADMIN_TOKEN", ""):
            if not has_valid_admin_token():
                return Response(
                    "Forbidden (admin token required)", status=403, mimetype="text/plain"
                )

        return None

    # ---------------------------------------------------------------------
    # Cache headers
    # ---------------------------------------------------------------------

    @app.after_request
    def add_cache_headers(resp):
        """
        Add cache-related HTTP headers after each request
    
        Args:
            resp: Flask response object generated by the route handler
    
        Returns:
            The modified response object
    
        Side effects:
            Changes the Cache-Control header for static assets, CSS, JavaScript,
            webmanifest files and the service worker depending on DEV_NO_CACHE
    
        Notes:
            This is especially relevant during tablet testing because cached
            JavaScript or CSS files can otherwise cause outdated frontend behavior
        """
        path = request.path or ""

        if app.config.get("DEV_NO_CACHE", False):
            if (
                path.startswith("/static/")
                or path.endswith(".webmanifest")
                or path.endswith(".js")
                or path.endswith(".css")
                or path.endswith("/sw.js")
            ):
                resp.headers["Cache-Control"] = "no-store"
                return resp

        # In production, keep SW/manifest revalidated frequently.
        if path.endswith(".webmanifest") or path.endswith("/sw.js"):
            resp.headers["Cache-Control"] = "no-cache"

        return resp

    # ---------------------------------------------------------------------
    # Blueprint + DB init
    # ---------------------------------------------------------------------

    app.register_blueprint(routes_bp)

    # Create tables on startup
    # ensure_columns() is kept for compatibility and intentionally does not migrate
    init_db()
    ensure_columns()

    return app