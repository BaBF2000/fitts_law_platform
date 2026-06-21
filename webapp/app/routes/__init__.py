"""
Route package initialization.

Organigram reference:
- Backend
  -> Routing Layer
  -> Shared Blueprint

Responsibility:
Creates the shared Flask Blueprint used by all route modules and imports the
individual route files so their route decorators are registered.

Important:
Route modules import the shared blueprint `bp` from this package. Therefore,
`bp` must be created before importing the route modules below.
"""

from __future__ import annotations

from flask import Blueprint


# Shared backend blueprint
# Individual route modules attach their endpoints to this blueprint using
# decorators such as @bp.get(...) or @bp.post(...)
bp = Blueprint("routes", __name__)


# Import route modules after the blueprint has been created
# These imports are needed for their side effect: registering route handlers
# noqa suppresses linting warnings about imports not being placed at the top
# and about imported modules that are not accessed directly in this file
from . import pages  # noqa: E402,F401
from . import protocols  # noqa: E402,F401
from . import results  # noqa: E402,F401
from . import exports  # noqa: E402,F401
from . import dashboard  # noqa: E402,F401
from . import montecarlo_dashboard  # noqa: E402,F401