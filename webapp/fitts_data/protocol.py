"""
Protocol helpers for the Fitts data framework.

Responsibility:
Reads and interprets protocol snapshots stored with experiment sessions.

Important:
Protocol snapshots are stored inside each session.
This means old sessions remain reproducible even if the original protocol
template is later changed or deleted.
"""

from __future__ import annotations

import json
from typing import Any

from .queries import (
    get_protocol_snapshot,
)


def get_protocol(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> dict[str, Any] | None:
    """
    Return the protocol snapshot as a dictionary.
    """
    raw = get_protocol_snapshot(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not raw:
        return None

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None

    if not isinstance(parsed, dict):
        return None

    return parsed


def get_blocks(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> list[dict[str, Any]]:
    """
    Return protocol block definitions.
    """
    protocol = get_protocol(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    blocks = protocol.get("sessionBlocks") if protocol else None

    if not isinstance(blocks, list):
        return []

    return [
        block
        for block in blocks
        if isinstance(block, dict)
    ]


def get_sampling(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> dict[str, str | None]:
    """
    Return sampling settings from the stored protocol snapshot.
    """
    protocol = get_protocol(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not protocol:
        return {
            "a_sampling": None,
            "w_sampling": None,
            "id_sampling": None,
        }

    return {
        "a_sampling": protocol.get("a_sampling"),
        "w_sampling": protocol.get("w_sampling"),
        "id_sampling": protocol.get("id_sampling"),
    }


def get_protocol_name(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> str | None:
    """
    Return the stored protocol name.
    """
    protocol = get_protocol(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not protocol:
        return None

    return (
        protocol.get("protocol_name")
        or protocol.get("protocolName")
        or protocol.get("name")
    )


def get_protocol_comment(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> str | None:
    """
    Return the stored protocol comment.
    """
    protocol = get_protocol(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not protocol:
        return None

    return (
        protocol.get("protocol_comment")
        or protocol.get("protocolComment")
        or protocol.get("comment")
    )


def get_block_count(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> int:
    """
    Return number of protocol blocks.
    """
    return len(
        get_blocks(
            participant=participant,
            session=session,
            session_id=session_id,
        )
    )


def get_shapes(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> list[str]:
    """
    Return unique target shapes used by the protocol.
    """
    shapes = []

    for block in get_blocks(
        participant=participant,
        session=session,
        session_id=session_id,
    ):
        shape = block.get("shape")

        if shape and shape not in shapes:
            shapes.append(str(shape))

    return shapes


def get_param_modes(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> list[str]:
    """
    Return unique parameter modes used by the protocol.
    """
    modes = []

    for block in get_blocks(
        participant=participant,
        session=session,
        session_id=session_id,
    ):
        mode = block.get("param_mode")

        if mode and mode not in modes:
            modes.append(str(mode))

    return modes