"""
Database package.

Organigram reference:
- Persistence & Backend
  -> SQLite Database

Responsibility:
Groups internal database-related modules used by the backend.

Contains:
- connection.py: SQLite path configuration, write lock and connection factory
- schema.py: database table creation
- csv_export.py: shared CSV export query and response generation
- utils.py: small database-related helper functions

Important:
Route modules should normally import database helpers through app.db instead of
importing directly from this package. app.db acts as the stable database facade.
"""