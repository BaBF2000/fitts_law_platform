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
    Return all saved protocol templates from the database.

    The newest updated protocol is returned first.
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
    Save or update one protocol template.

    Behavior:
    - If a protocol with the same protocol_name exists, update it.
    - Otherwise, create a new protocol row.

    Required payload field:
    - protocol_json
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
    Delete one protocol template by database id.
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
    Build the insert dictionary for the protocol table.
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
    Return an existing protocol row with the same name, if present.
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
    Update an existing protocol template.
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