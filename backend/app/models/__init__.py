"""SQLAlchemy ORM models.

Importing this package registers every model on ``Base.metadata`` so that
``database.init_db()`` and Alembic autogenerate can see them all.
"""

from .audit import AuditLog
from .diagnosis import CropImage, DiagnosisReport
from .farm import Farm, Plot
from .marketplace import ListingReport, MarketEnquiry, MarketListing
from .scam_report import ScamReport
from .tasks import Expense, FarmTask
from .user import User

__all__ = [
    "User", "Farm", "Plot",
    "CropImage", "DiagnosisReport",
    "AuditLog",
    "FarmTask", "Expense",
    "MarketListing", "MarketEnquiry", "ListingReport",
    "ScamReport",
]
