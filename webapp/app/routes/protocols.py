"""
Protocol API routes.

Organigram reference:
- Persistence & Backend
  -> Protocol API
- Experiment Design
  -> Protocol Management
     -> Save Protocol
     -> Load Protocol
     -> Delete Protocol

Responsibility:
Provides backend endpoints for managing experiment protocol templates.

This module handles:
- listing saved protocols
- saving or updating a protocol
- deleting a protocol

Important:
A protocol is a reusable experiment template.

It is not the same as a session snapshot.
When an experiment starts, the frontend stores the exact protocol snapshot
inside the session data so later protocol changes do not affect old sessions.

Extension guide:
- Add protocol versioning here.
- Add protocol import/export here.
- Add protocol ownership or sharing here.
"""

from __future__ import annotations

from flask import jsonify, request

from app.db import (
    db,
    DB_WRITE_LOCK,
    now_iso_seconds,
)

from app.routes import bp

from .helpers import insert_dict


@bp.get("/api/protocols")
def api_list_protocols():
    """
    Return all saved protocol templates from the database

    Returns:
        flask.Response: JSON response with:
            - ok: True
            - protocols: list of protocol template rows

    Database access:
        Reads from the protocol table and returns the newest updated protocol
        first

    Side effects:
        None. This endpoint only reads protocol metadata and protocol JSON
    """
    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
              id,
              protocol_name,
              protocol_comment,
              protocol_json,
              a_sampling,
              w_sampling,
              id_sampling,
              admin_settings_json,
              monte_carlo_summary_json,
              monte_carlo_warning_count,
              monte_carlo_worst_clamp_pct,
              monte_carlo_worst_diagnostic,
              created_at,
              updated_at
            FROM protocol
            ORDER BY updated_at DESC
            """
        )

        rows = [
            dict(row)
            for row in cur.fetchall()
        ]

    return jsonify(
        {
            "ok": True,
            "protocols": rows,
        }
    )


@bp.post("/api/protocols")
def api_save_protocol():
    """
    Save or update one reusable protocol template

    Expected JSON payload:
        protocol_json (required): Serialized protocol definition
        protocol_name (optional): Human-readable protocol name. If missing,
            a default name is used
        protocol_comment (optional): Comment entered by the user
        a_sampling, w_sampling, id_sampling (optional): Sampling mode metadata
        admin_settings_json (optional): Serialized admin/default constraint data
        monte_carlo_* (optional): Precomputed Monte Carlo summary values

    Returns:
        flask.Response: JSON response with:
            - ok: True and protocol_id on success
            - ok: False and an error message if protocol_json is missing

    Behavior:
        If a protocol with the same protocol_name already exists, it is updated
        Otherwise, a new protocol row is inserted

    Side effects:
        Inserts or updates one row in the protocol table and commits the change

    Concurrency:
        Uses DB_WRITE_LOCK to serialize write access and reduce SQLite write
        conflicts during overlapping requests

    Important:
        A protocol is a reusable template. It is not the immutable session
        snapshot stored when an experiment is executed
    """
    payload = request.get_json(silent=True) or {}

    protocol_json = payload.get("protocol_json")

    protocol_name = payload.get("protocol_name") or "Unbenanntes Protokoll"

    if not protocol_json:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "protocol_json missing",
                }
            ),
            400,
        )

    now = now_iso_seconds()

    protocol_data = build_protocol_data(
            payload=payload,
            protocol_name=protocol_name,
            protocol_json=protocol_json,
            now=now,
    )

    with DB_WRITE_LOCK:
        with db() as conn:
            cur = conn.cursor()
            
            # Use the protocol name as the logical key for upsert-like behavior.
            
            # The database also enforces protocol_name as UNIQUE.
            existing = find_protocol_by_name(
                cur,
                protocol_name,
            )

            if existing:
                update_existing_protocol(
                    cur=cur,
                    protocol_id=existing["id"],
                    payload=payload,
                    protocol_json=protocol_json,
                    now=now,
                )

                protocol_id = existing["id"]
            else:
                insert_dict(
                    cur,
                    "protocol",
                    protocol_data,
                )

                protocol_id = cur.lastrowid

            conn.commit()

    return jsonify(
        {
            "ok": True,
            "protocol_id": protocol_id,
        }
    )


@bp.delete("/api/protocols/<int:protocol_id>")
def api_delete_protocol(protocol_id: int):
    """
    Delete one protocol template by database id

    Args:
        protocol_id (int): Primary key of the protocol row to delete

    Returns:
        flask.Response: JSON response with ok=True

    Side effects:
        Deletes the matching protocol row from the protocol table and commits
        the change. If the id does not exist, no row is deleted

    Concurrency:
        Uses DB_WRITE_LOCK to serialize write access

    Important:
        Deleting a protocol template does not delete already saved experiment
        sessions, because sessions store their own protocol snapshots
    """
    with DB_WRITE_LOCK:
        with db() as conn:
            cur = conn.cursor()

            cur.execute(
                "DELETE FROM protocol WHERE id = ?",
                (protocol_id,),
            )

            conn.commit()

    return jsonify(
        {
            "ok": True,
        }
    )


def build_protocol_data(
    *,
    payload: dict,
    protocol_name: str,
    protocol_json: str,
    now: str,
) -> dict:
    """
    Build the dictionary used to insert a protocol row

    Args:
        payload (dict): JSON payload received from the frontend
        protocol_name (str): Final protocol name used for the database row
        protocol_json (str): Serialized protocol definition
        now (str): UTC ISO timestamp used for created_at and updated_at

    Returns:
        dict: Column-value mapping compatible with the protocol table

    Side effects:
        None. This function only transforms request data into a database-ready
        dictionary

    Related usage:
        The returned dictionary is passed to insert_dict() in api_save_protocol()
    """
    return {
        "protocol_name": protocol_name,
        "protocol_comment": payload.get("protocol_comment"),
        "protocol_json": protocol_json,

        "a_sampling": payload.get("a_sampling"),
        "w_sampling": payload.get("w_sampling"),
        "id_sampling": payload.get("id_sampling"),

        "admin_settings_json": payload.get("admin_settings_json"),

        "monte_carlo_summary_json":
            payload.get("monte_carlo_summary_json"),

        "monte_carlo_warning_count":
            payload.get("monte_carlo_warning_count"),

        "monte_carlo_worst_clamp_pct":
            payload.get("monte_carlo_worst_clamp_pct"),

        "monte_carlo_worst_diagnostic":
            payload.get("monte_carlo_worst_diagnostic"),

        "created_at": now,
        "updated_at": now,
    }


def find_protocol_by_name(cur, protocol_name: str):
    """
    Find an existing protocol template by its unique protocol name

    Args:
        cur: SQLite cursor used for the SELECT query
        protocol_name (str): Protocol name to look up

    Returns:
        sqlite3.Row | None: Existing protocol row containing id and created_at,
        or None if no matching protocol exists

    Side effects:
        Executes a SELECT query using the provided cursor

    Notes:
        The protocol_name column is unique in the database schema. This helper
        supports the update-or-insert behavior in api_save_protocol()
    """
    cur.execute(
        """
        SELECT id, created_at
        FROM protocol
        WHERE protocol_name = ?
        LIMIT 1
        """,
        (protocol_name,),
    )

    return cur.fetchone()


def update_existing_protocol(
    *,
    cur,
    protocol_id: int,
    payload: dict,
    protocol_json: str,
    now: str,
) -> None:
    """
    Update an existing reusable protocol template

    Args:
        cur: SQLite cursor used for the UPDATE statement
        protocol_id (int): Primary key of the protocol row to update
        payload (dict): JSON payload received from the frontend
        protocol_json (str): Serialized protocol definition
        now (str): UTC ISO timestamp written to updated_at

    Returns:
        None.

    Side effects:
        Executes an UPDATE statement on the protocol table

    Important:
        The created_at timestamp is intentionally preserved. Only updated_at
        and the editable protocol fields are changed
    """
    cur.execute(
        """
        UPDATE protocol
        SET
          protocol_comment = ?,
          protocol_json = ?,
          a_sampling = ?,
          w_sampling = ?,
          id_sampling = ?,
          admin_settings_json = ?,
          monte_carlo_summary_json = ?,
          monte_carlo_warning_count = ?,
          monte_carlo_worst_clamp_pct = ?,
          monte_carlo_worst_diagnostic = ?,
          updated_at = ?
        WHERE id = ?
        """,
        (
            payload.get("protocol_comment"),
            protocol_json,
            payload.get("a_sampling"),
            payload.get("w_sampling"),
            payload.get("id_sampling"),
            payload.get("admin_settings_json"),
            payload.get("monte_carlo_summary_json"),
            payload.get("monte_carlo_warning_count"),
            payload.get("monte_carlo_worst_clamp_pct"),
            payload.get("monte_carlo_worst_diagnostic"),
            now,
            protocol_id,
        ),
    )