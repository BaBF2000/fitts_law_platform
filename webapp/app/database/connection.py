"""
SQLite connection helpers.

Organigram reference:
- Persistence & Backend
  -> SQLite Database
  -> Connection Layer

Responsibility:
Defines database paths, the global write lock and the SQLite connection factory.

Important:
SQLite is used with WAL mode and a write lock to reduce short write conflicts
during experiment saves.
"""

from __future__ import annotations

import os
import sqlite3
from threading import Lock


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "fitts.db")


# ---------------------------------------------------------------------------
# Write lock
# ---------------------------------------------------------------------------

# Serializes concurrent writes and reduces short SQLite lock spikes.
DB_WRITE_LOCK = Lock()


# ---------------------------------------------------------------------------
# Connection factory
# ---------------------------------------------------------------------------

def db() -> sqlite3.Connection:
    """
    Create a SQLite connection configured for concurrent web usage.
    """
    conn = sqlite3.connect(
        DB_PATH,
        timeout=10,
        check_same_thread=False,
    )

    conn.row_factory = sqlite3.Row

    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=5000;")

    return conn