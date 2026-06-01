from __future__ import annotations

from flask import Blueprint

bp = Blueprint("routes", __name__)

from . import pages  # noqa: E402,F401
from . import protocols  # noqa: E402,F401
from . import results  # noqa: E402,F401
from . import exports  # noqa: E402,F401
from . import dashboard  # noqa: E402,F401
from . import montecarlo_dashboard  # noqa: E402,F401