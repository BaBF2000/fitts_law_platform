"""
Protocol helpers for the Fitts data framework.

Responsibility:
    Reads and interprets protocol snapshots stored with experiment sessions.

Organigram reference:
    Persistence & Backend
    -> Fitts Data Framework
       -> Protocol Layer

Important:
    Protocol snapshots are stored inside each session.

    This means old sessions remain reproducible even if the original protocol
    template is later changed or deleted. The stored protocol snapshot describes
    the experiment configuration that was active when the session was recorded.
"""

from __future__ import annotations

import json
from typing import Any

from .queries import get_protocol_snapshot


def _optional_str(value: Any) -> str | None:
    """
    Convert a value to string if it is present.

    Args:
        value:
            Raw value extracted from the protocol snapshot.

    Returns:
        String representation of the value, or None if the value is missing.
    """
    if value is None:
        return None

    return str(value)


def _first_existing(
    source: dict[str, Any],
    keys: tuple[str, ...],
) -> Any:
    """
    Return the first existing value from a dictionary.

    This helper is useful because protocol snapshots may contain both snake_case
    and camelCase keys depending on the application version.

    Args:
        source:
            Dictionary to read from.
        keys:
            Possible key names.

    Returns:
        First non-empty value, or None.
    """
    for key in keys:
        value = source.get(key)

        if value is not None:
            return value

    return None


def _unique_strings(values: list[Any]) -> list[str]:
    """
    Return unique string values while preserving their original order.

    Args:
        values:
            Raw values extracted from protocol blocks.

    Returns:
        A list of unique string values.
    """
    result: list[str] = []

    for value in values:
        text = _optional_str(value)

        if text is None:
            continue

        if text not in result:
            result.append(text)

    return result


def get_protocol(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> dict[str, Any] | None:
    """
    Return the stored protocol snapshot as a dictionary.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Parsed protocol dictionary, or None if the snapshot is missing or
        invalid.
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

    The function supports multiple possible key names for compatibility with
    different protocol snapshot versions.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        A list of protocol block dictionaries.
    """
    protocol = get_protocol(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not protocol:
        return []

    blocks = _first_existing(
        protocol,
        (
            "sessionBlocks",
            "session_blocks",
            "blocks",
        ),
    )

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

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Dictionary containing A, W and ID sampling modes.
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
        "a_sampling": _optional_str(
            _first_existing(protocol, ("a_sampling", "aSampling"))
        ),
        "w_sampling": _optional_str(
            _first_existing(protocol, ("w_sampling", "wSampling"))
        ),
        "id_sampling": _optional_str(
            _first_existing(protocol, ("id_sampling", "idSampling"))
        ),
    }


def get_protocol_name(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> str | None:
    """
    Return the stored protocol name.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Protocol name, or None if unavailable.
    """
    protocol = get_protocol(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not protocol:
        return None

    return _optional_str(
        _first_existing(
            protocol,
            (
                "protocol_name",
                "protocolName",
                "name",
            ),
        )
    )


def get_protocol_comment(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> str | None:
    """
    Return the stored protocol comment.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Protocol comment, or None if unavailable.
    """
    protocol = get_protocol(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not protocol:
        return None

    return _optional_str(
        _first_existing(
            protocol,
            (
                "protocol_comment",
                "protocolComment",
                "comment",
            ),
        )
    )


def get_block_count(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> int:
    """
    Return the number of protocol blocks.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Number of valid protocol block definitions.
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

    The function supports multiple key names for compatibility.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        List of unique target shape names.
    """
    values: list[Any] = []

    for block in get_blocks(
        participant=participant,
        session=session,
        session_id=session_id,
    ):
        values.append(
            _first_existing(
                block,
                (
                    "shape",
                    "target_shape",
                    "targetShape",
                ),
            )
        )

    return _unique_strings(values)


def get_param_modes(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> list[str]:
    """
    Return unique parameter modes used by the protocol.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        List of unique parameter modes.
    """
    values: list[Any] = []

    for block in get_blocks(
        participant=participant,
        session=session,
        session_id=session_id,
    ):
        values.append(
            _first_existing(
                block,
                (
                    "param_mode",
                    "paramMode",
                    "mode",
                ),
            )
        )

    return _unique_strings(values)


def get_unit(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> str | None:
    """
    Return the unit setting stored in the protocol snapshot.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Unit string, for example "px", "mm" or "relative", or None.
    """
    protocol = get_protocol(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not protocol:
        return None

    return _optional_str(
        _first_existing(
            protocol,
            (
                "unit",
                "protocol_unit",
                "protocolUnit",
            ),
        )
    )


def get_formula(
    *,
    participant: str | None = None,
    session: str | None = None,
    session_id: int | None = None,
) -> str | None:
    """
    Return the Fitts' Law formula setting stored in the protocol snapshot.

    Args:
        participant:
            Optional participant identifier.
        session:
            Optional session code.
        session_id:
            Optional internal database session ID.

    Returns:
        Formula identifier, or None if unavailable.
    """
    protocol = get_protocol(
        participant=participant,
        session=session,
        session_id=session_id,
    )

    if not protocol:
        return None

    return _optional_str(
        _first_existing(
            protocol,
            (
                "formula",
                "id_formula",
                "idFormula",
            ),
        )
    )