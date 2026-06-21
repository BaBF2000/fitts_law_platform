"""
Fitts data framework.

This package provides a Python API for reading, cleaning, analysing,
diagnosing and visualising experiment data stored in the Fitts Display Lab
SQLite database.

The package is designed as a data-analysis layer separated from the web
application. It exposes a stable public interface through this __init__.py file,
so external scripts, notebooks or reports can access the main tools without
needing to know the internal module structure.
"""

# Main client used as the primary entry point for database access and analysis.
from .client import FittsDataClient

# Core data access and analysis modules.
# These modules are re-exported to make them available directly from fitts_data.
from . import queries
from . import metrics
from . import summaries
from . import statistics
from . import filters

# Analysis modules.
from . import protocol
from . import regression
from . import quality
from . import grouping
from . import interactions
from . import diagnostics
from . import plots

# Dataset tools used to work with all rows belonging to one session.
from . import datasets
from .datasets import (
    SessionDataset,
    load_session_dataset,
)

# Data models representing the main entities used by the analysis framework.
from .models import (
    Participant,
    Session,
    TrialRow,
    SessionSummary,
    ParticipantSummary,
)

# Result models used by analysis modules.
from .regression import LinearRegressionResult
from .statistics import StatisticsSummary


# Public API of the package.
# Only the names listed here are exported when using:
# from fitts_data import *
__all__ = [
    # Main entry point
    "FittsDataClient",

    # Core modules
    "queries",
    "metrics",
    "summaries",
    "statistics",
    "filters",

    # Analysis modules
    "protocol",
    "regression",
    "quality",
    "grouping",
    "interactions",
    "diagnostics",
    "plots",

    # Dataset tools
    "datasets",
    "SessionDataset",
    "load_session_dataset",

    # Data models
    "Participant",
    "Session",
    "TrialRow",
    "SessionSummary",
    "ParticipantSummary",

    # Analysis result models
    "LinearRegressionResult",
    "StatisticsSummary",
]