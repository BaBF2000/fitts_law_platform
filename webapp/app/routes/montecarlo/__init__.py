"""
Monte Carlo dashboard helper package.

Organigram reference:
- Persistence & Backend
  -> Admin Dashboard
     -> Monte Carlo Analysis

Responsibility:
Groups helper modules used by the admin Monte Carlo dashboard.

This package contains:
- queries.py: database read access for recent sessions
- session_rows.py: HTML table row rendering
- page_builder.py: full dashboard page construction

Important:
This package does not define Flask routes directly. The route itself is defined
in app.routes.montecarlo_dashboard.
"""