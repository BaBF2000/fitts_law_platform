"""
Database facade.

Organigram reference:
- Persistence & Backend
  -> SQLite Database
  -> Database Facade

Responsibility:
Provides a stable import interface for database helpers used by route modules
and backend services

Important:
Route modules should import database-related helpers from app.db, not directly
from app.database.*. This keeps the backend architecture easier to refactor
because internal database modules can be reorganized without changing route
imports

Design rule:
This module should not contain database logic itself. It should only re-export
selected functions, constants and helpers from the internal database package
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