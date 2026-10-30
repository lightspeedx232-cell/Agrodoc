"""General scam report model — for reporting fraud, fake portals, phishing."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ScamReport(Base):
    __tablename__ = "scam_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    reporter_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    scam_type: Mapped[str] = mapped_column(String(50))
    # e.g. "fake_govt_portal" | "phishing_link" | "fake_listing" | "fake_buyer" | "other"
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    suspected_source: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # The URL / phone / name the user suspects
    reported_at_str: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # When the scam happened (user-entered)
    contact_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optional: how the scammer contacted them
    financial_loss: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # e.g. "₹5,000" or "No loss"
    status: Mapped[str] = mapped_column(String(20), default="submitted")
    # submitted | forwarded | resolved
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
