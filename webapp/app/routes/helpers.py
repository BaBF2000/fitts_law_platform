from __future__ import annotations

from pathlib import Path

from flask import current_app, request

from app.db import CSV_SELECT

def get_static_folder() -> str:
    """
    Return the configured Flask static folder.

    Flask normally provides this value, but Pylance types it as optional.
    """
    static_folder = current_app.static_folder

    if static_folder is None:
        return str(Path(current_app.root_path) / "static")

    return static_folder


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

    token = (
        request.args.get("token") or
        request.headers.get("X-Admin-Token") or
        ""
    ).strip()

    return token == required


def admin_qs() -> str:
    """
    Preserve ?token=... across dashboard links.
    """
    token = (request.args.get("token") or "").strip()
    return f"?token={token}" if token else ""


def as_int_bool(value):
    """
    Convert truthy/falsy frontend values to SQLite-friendly integers.
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
    Return CSV_SELECT without its final ORDER BY block.
    """
    return CSV_SELECT.rsplit("ORDER BY", 1)[0]