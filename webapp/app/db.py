"""
Database facade.

Organigram reference:
- Persistence & Backend
  -> SQLite Database
  -> Database Facade

Responsibility:
Provides a stable import interface for database helpers.

Important:
Route modules should import from app.db, not directly from app.database.*.
This keeps the backend architecture easy to refactor.
"""

from __future__ import annotations

from .database.connection import (
    BASE_DIR,
    DATA_DIR,
    DB_PATH,
    DB_WRITE_LOCK,
    db,
)

from .database.utils import (
    safe_name,
    html_escape,
    now_iso_seconds,
)

from .database.csv_export import (
    csv_clean,
    rows_to_csv_response,
    CSV_SELECT,
)

from .database.schema import (
    init_db,
    ensure_columns,
)