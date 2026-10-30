"""Farmers' Trade / Marketplace models.

Design notes
─────────────
* Listings: produce available for sale. A farmer can pause, reactivate or delete.
* Enquiries: a buyer sends an enquiry on a listing; seller can respond.
* Offers: a buyer can make a price offer; seller accepts or rejects.
* Reports: any user can flag a listing as suspicious (anti-scam).

Personal contact details are NOT stored on listings. The seller chooses a
contact preference (phone_on_request, whatsapp_on_request, email_on_request,
or in_app). Actual contact info is only shared via authenticated messaging,
never exposed in public listing responses.

Status machine:
  active → paused → active  (seller can toggle)
  active → sold             (seller marks sold)
  active → deleted          (soft-delete, never hard-delete for audit trail)
"""

from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class ListingStatus(str, Enum):
    active   = "active"
    paused   = "paused"
    sold     = "sold"
    deleted  = "deleted"


class ContactPref(str, Enum):
    phone_on_request    = "phone_on_request"
    whatsapp_on_request = "whatsapp_on_request"
    email_on_request    = "email_on_request"
    in_app              = "in_app"


class MarketListing(Base):
    __tablename__ = "market_listings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    farm_id: Mapped[int | None] = mapped_column(
        ForeignKey("farms.id", ondelete="SET NULL"), nullable=True
    )

    # Product details
    product_type: Mapped[str] = mapped_column(String(50))   # vegetable|fruit|grain|pulse|spice|coconut|other
    product_name: Mapped[str] = mapped_column(String(200))
    variety: Mapped[str | None] = mapped_column(String(150), nullable=True)
    quality_grade: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Quantity and price
    quantity: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(30))            # kg|quintal|tonne|piece|dozen|bunch
    asking_price_per_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    price_negotiable: Mapped[bool] = mapped_column(Boolean, default=True)

    # Availability
    harvest_date: Mapped[str | None] = mapped_column(String(20), nullable=True)  # YYYY-MM-DD
    available_from: Mapped[str | None] = mapped_column(String(20), nullable=True)
    available_until: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Location
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pickup_location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    delivery_available: Mapped[bool] = mapped_column(Boolean, default=False)

    # Contact preference (not the actual contact)
    contact_preference: Mapped[str] = mapped_column(
        SAEnum(ContactPref, name="contact_pref"),
        default=ContactPref.phone_on_request,
    )

    status: Mapped[str] = mapped_column(
        SAEnum(ListingStatus, name="listing_status"),
        default=ListingStatus.active,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    enquiries: Mapped[list["MarketEnquiry"]] = relationship(
        back_populates="listing", cascade="all, delete-orphan"
    )
    reports: Mapped[list["ListingReport"]] = relationship(
        back_populates="listing", cascade="all, delete-orphan"
    )


class MarketEnquiry(Base):
    """A buyer's enquiry or offer on a listing."""
    __tablename__ = "market_enquiries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("market_listings.id", ondelete="CASCADE"), index=True
    )
    buyer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    kind: Mapped[str] = mapped_column(String(20), default="enquiry")  # enquiry|offer
    message: Mapped[str] = mapped_column(Text)
    offered_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    offered_quantity: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Seller's response
    response: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|accepted|rejected|counter

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    listing: Mapped["MarketListing"] = relationship(back_populates="enquiries")


class ListingReport(Base):
    """Anti-scam: any user can report a suspicious listing."""
    __tablename__ = "listing_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("market_listings.id", ondelete="CASCADE"), index=True
    )
    reporter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(100))   # fake_listing|wrong_price|scam_contact|other
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    listing: Mapped["MarketListing"] = relationship(back_populates="reports")
