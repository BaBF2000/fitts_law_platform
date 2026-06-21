"""
Shared route helper functions

Organigram reference:
- Backend
  -> Routing Layer
  -> Route Helper Functions

Responsibility:
Provides small helper functions used by backend route modules for static file
resolution, optional admin-token checks, result-row conversion, SQLite inserts
and CSV query reuse

Important:
This module supports route handlers but should not contain route definitions
itself. Database schema definitions remain in app.database.schema, and the
shared CSV export query remains in app.database.csv_export
"""
from __future__ import annotations

from pathlib import Path

from flask import current_app, request

from app.db import CSV_SELECT

def get_static_folder() -> str:
    """
    Return the configured Flask static folder path.

    Returns:
        str: Absolute path to the static folder.

    Fallback behavior:
        If current_app.static_folder is None, a fallback path based on
        current_app.root_path is returned.

    Related usage:
        Used by page/PWA routes to serve manifest and service worker files.
    """
    static_folder = current_app.static_folder

    if static_folder is None:
        return str(Path(current_app.root_path) / "static")

    return static_folder


def require_admin() -> bool:
    """
    Check whether the current request is allowed to access admin-only routes

    Returns:
        bool: True if no ADMIN_TOKEN is configured or if the provided token
        matches the configured token. False otherwise

    Accepted token locations:
        - Query parameter: ?token=...
        - HTTP header: X-Admin-Token

    Side effects:
        None. This function only reads Flask request data and application config

    Security note:
        If ADMIN_TOKEN is empty, admin access is open. This is convenient during
        local development but should be configured carefully for shared networks
    """
    required = (current_app.config.get("ADMIN_TOKEN") or "").strip()

    if not required:
        return True

    token = (
        request.args.get("token") or
        request.headers.get("X-Admin-Token") or
        ""
    ).strip()

    return token == required


def admin_qs() -> str:
    """
    Build a query string that preserves the current admin token

    Returns:
        str: '?token=...' if a token is present in the current request,
        otherwise an empty string.

    Related usage:
        Used by dashboard pages to keep admin-protected navigation links usable
        across multiple internal pages
    """
    token = (request.args.get("token") or "").strip()
    return f"?token={token}" if token else ""


def as_int_bool(value):
    """
    Convert frontend truthy/falsy values to SQLite-friendly integer flags

    Args:
        value: Raw frontend value or Python boolean-like value

    Returns:
        int | None: 1 for truthy values, 0 for falsy values, or None if the
        input value is None

    Related usage:
        Used when storing boolean-like frontend/device values in SQLite columns
    """
    if value is None:
        return None

    return 1 if value else 0


def get_field(row: dict, key: str):
    """
    Safely read a value from a result row dictionary

    Args:
        row (dict): Result row received or assembled by a route handler
        key (str): Field name to read

    Returns:
        The value stored under key, or None if the key is missing

    Side effects:
        None
    """
    return row.get(key)


def insert_dict(cur, table: str, data: dict) -> None:
    """
    Insert a dictionary into a SQLite table

    Args:
        cur: SQLite cursor used to execute the INSERT statement
        table (str): Target table name
        data (dict): Mapping of column names to values

    Returns:
        None

    Side effects:
        Executes an INSERT statement using the provided cursor

    Important:
        Values are passed as SQL parameters, but table and column names are
        interpolated into the SQL string. Therefore, table names and dictionary
        keys must come from trusted backend code, not from direct user input

    Related usage:
        Used by route handlers that convert frontend result payloads into
        database rows
    """
    columns = list(data.keys())
    placeholders = ", ".join(["?"] * len(columns))
    column_sql = ", ".join(columns)

    cur.execute(
        f"INSERT INTO {table} ({column_sql}) VALUES ({placeholders})",
        [data[column] for column in columns],
    )


def csv_select_base() -> str:
    """
    Return CSV_SELECT without its final ORDER BY block

    Returns:
        str: Base SELECT query that can be extended with additional WHERE
        clauses before applying a custom ORDER BY

    Related modules:
        Uses CSV_SELECT from app.db, which re-exports the centralized export
        query from app.database.csv_export

    Important:
        This helper assumes that CSV_SELECT contains exactly one final
        'ORDER BY' block. If the shared query structure changes, this helper
        must be checked as well
    """
    return CSV_SELECT.rsplit("ORDER BY", 1)[0]