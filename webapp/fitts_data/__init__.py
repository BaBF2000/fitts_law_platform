"""
Fitts data framework.

Provides a Python API for reading, cleaning and analysing experiment data
stored in the SQLite database.
"""

from .client import FittsDataClient

from . import queries
from . import metrics
from . import summaries
from . import interactions
from . import diagnostics
from . import statistics
from . import protocol
from . import regression
from . import quality
from . import grouping
from . import plots
from . import datasets
from .datasets import SessionDataset

from .models import (
    Participant,
    Session,
    TrialRow,
    SessionSummary,
    ParticipantSummary,
)

from .regression import (
    LinearRegressionResult,
)

__all__ = [
    # Main entry point
    "FittsDataClient",

    # Core modules
    "queries",
    "metrics",
    "summaries",
    "statistics",

    # Analysis modules
    "protocol",
    "regression",
    "quality",
    "grouping",
    "plots",

    # Models
    "Participant",
    "Session",
    "TrialRow",
    "SessionSummary",
    "ParticipantSummary",

    # Analysis results
    "LinearRegressionResult",

    "datasets",
    "SessionDataset",

    "diagnostics",
    "interactions",
]