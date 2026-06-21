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

Design rule:
This module should only define connection-related infrastructure. It should not
contain schema creation, route logic or experiment-specific database queries.
"""

from __future__ import annotations

import os
import sqlite3
from threading import Lock


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# Absolute project root directory.
# Used as a stable base for data and database paths independent of the
# current working directory.
BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

# Directory for persistent application data.
# It is created at import time to ensure that the SQLite file can be placed there.
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Main SQLite database file used by the backend.
DB_PATH = os.path.join(DATA_DIR, "fitts.db")


# ---------------------------------------------------------------------------
# Write lock
# ---------------------------------------------------------------------------

# Serializes write operations that may be triggered by overlapping HTTP requests.
# This does not make SQLite fully concurrent, but it reduces short write conflicts
# during experiment result saves and export-related operations.
DB_WRITE_LOCK = Lock()


# ---------------------------------------------------------------------------
# Connection factory
# ---------------------------------------------------------------------------

def db() -> sqlite3.Connection:
    """
    Create and configure a SQLite connection for backend database access

    Returns:
        sqlite3.Connection: Open SQLite connection with sqlite3.Row as row
        factory, foreign key support enabled and WAL-related pragmas applied

    Side effects:
        Opens a new connection to DB_PATH and applies SQLite PRAGMA settings
        for the returned connection

    Caller responsibility:
        The caller must close the returned connection after use, preferably with
        a context manager or a try/finally block

    Concurrency notes:
        check_same_thread=False allows the connection object to be used outside
        the thread in which it was created. The application still uses
        DB_WRITE_LOCK for write operations to reduce short SQLite lock conflicts

    Related modules:
        Used indirectly through app.db by route handlers and database helpers
        Schema creation is handled in app.database.schema, not in this module
    """
    conn = sqlite3.connect(
        DB_PATH,
        timeout=10,
        check_same_thread=False,
    )
  
    # Return rows as mapping-like objects, so columns can be accessed by name
    conn.row_factory = sqlite3.Row
    
     # Enforce relational integrity for connections that modify related tables
    conn.execute("PRAGMA foreign_keys=ON;")
    # Enable Write-Ahead Logging to improve read/write behavior for the web app
    conn.execute("PRAGMA journal_mode=WAL;")
    # Use a balanced durability/performance setting suitable for local experiments
    conn.execute("PRAGMA synchronous=NORMAL;")
    # Let SQLite wait briefly instead of failing immediately when the database is busy
    conn.execute("PRAGMA busy_timeout=5000;")

    return conn