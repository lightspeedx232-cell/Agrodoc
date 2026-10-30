"""Farmers' Trade / Marketplace endpoints.

Security design
───────────────
* Only authenticated farmers can create listings.
* Contact details (phone, email) are NEVER returned in public listing responses.
  The buyer uses the contact_preference field to request details via the
  authenticated enquiry system.
* Listing owner is always checked before mutation.
* Buyers cannot see other buyers' enquiries on the same listing.
* Enquiry messages are stored and accessible only to the listing owner and the
  buyer who sent them.
* Reports are always stored; a flagged listing still shows but gets a warning
  flag. Admins can act on reports.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..core.deps import CurrentUser, DbSession
from ..models.marketplace import (
    ContactPref,
    ListingReport,
    ListingStatus,
    MarketEnquiry,
    MarketListing,
)
from ..services.audit import log_audit_event

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

# ── Schemas ─────────────────────────────────────────────────────────────────

PRODUCT_TYPES = {"vegetable","fruit","grain","pulse","spice","coconut","other"}
UNITS = {"kg","quintal","tonne","piece","dozen","bunch","litre","bag","box","other"}


class ListingCreate(BaseModel):
    product_type: str = Field(pattern="^(vegetable|fruit|grain|pulse|spice|coconut|other)$")
    product_name: str = Field(min_length=1, max_length=200)
    variety: str | None = Field(default=None, max_length=150)
    quality_grade: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    quantity: float = Field(gt=0)
    unit: str = Field(max_length=30)
    asking_price_per_unit: float | None = Field(default=None, ge=0)
    price_negotiable: bool = True
    harvest_date: str | None = Field(default=None, max_length=20)
    available_from: str | None = Field(default=None, max_length=20)
    available_until: str | None = Field(default=None, max_length=20)
    state: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    pickup_location: str | None = Field(default=None, max_length=300)
    delivery_available: bool = False
    contact_preference: ContactPref = ContactPref.phone_on_request
    farm_id: int | None = None


class ListingOut(BaseModel):
    id: int
    seller_id: int
    product_type: str
    product_name: str
    variety: str | None
    quality_grade: str | None
    description: str | None
    quantity: float
    unit: str
    asking_price_per_unit: float | None
    currency: str
    price_negotiable: bool
    harvest_date: str | None
    available_from: str | None
    available_until: str | None
    state: str | None
    district: str | None
    pickup_location: str | None
    delivery_available: bool
    contact_preference: str
    status: str
    enquiry_count: int = 0
    report_count: int = 0
    created_at: datetime
    updated_at: datetime
    # Seller name shown (no phone/email).
    seller_name: str = ""

    model_config = {"from_attributes": True}


class EnquiryCreate(BaseModel):
    kind: str = Field(pattern="^(enquiry|offer)$")
    message: str = Field(min_length=1, max_length=1500)
    offered_price: float | None = Field(default=None, ge=0)
    offered_quantity: float | None = Field(default=None, gt=0)


class EnquiryOut(BaseModel):
    id: int
    listing_id: int
    buyer_id: int
    kind: str
    message: str
    offered_price: float | None
    offered_quantity: float | None
    response: str | None
    response_status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class EnquiryResponse(BaseModel):
    response: str = Field(min_length=1, max_length=1500)
    response_status: str = Field(pattern="^(accepted|rejected|counter)$")


class ReportCreate(BaseModel):
    reason: str = Field(pattern="^(fake_listing|wrong_price|scam_contact|other)$")
    detail: str | None = Field(default=None, max_length=1000)


def _listing_out(listing: MarketListing) -> ListingOut:
    # We avoid loading a relationship that isn't defined on the model.
    # Seller name is populated by the router when available.
    return ListingOut(
        id=listing.id,
        seller_id=listing.seller_id,
        product_type=listing.product_type,
        product_name=listing.product_name,
        variety=listing.variety,
        quality_grade=listing.quality_grade,
        description=listing.description,
        quantity=listing.quantity,
        unit=listing.unit,
        asking_price_per_unit=listing.asking_price_per_unit,
        currency=listing.currency,
        price_negotiable=listing.price_negotiable,
        harvest_date=listing.harvest_date,
        available_from=listing.available_from,
        available_until=listing.available_until,
        state=listing.state,
        district=listing.district,
        pickup_location=listing.pickup_location,
        delivery_available=listing.delivery_available,
        contact_preference=listing.contact_preference,
        status=listing.status,
        enquiry_count=len(listing.enquiries),
        report_count=len(listing.reports),
        created_at=listing.created_at,
        updated_at=listing.updated_at,
        seller_name="",  # populated by caller when needed
    )


# ── Listing endpoints ────────────────────────────────────────────────────────

@router.get("/listings", response_model=list[ListingOut])
def browse_listings(
    db: DbSession,
    product_type: str | None = Query(None),
    state: str | None = Query(None),
    district: str | None = Query(None),
    search: str | None = Query(None, max_length=100),
    limit: int = Query(40, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[ListingOut]:
    """Public endpoint — browse active listings. No contact info returned."""
    q = (
        select(MarketListing)
        .where(MarketListing.status == ListingStatus.active)
        .order_by(MarketListing.created_at.desc())
    )
    if product_type:
        q = q.where(MarketListing.product_type == product_type)
    if state:
        q = q.where(MarketListing.state.ilike(f"%{state}%"))
    if district:
        q = q.where(MarketListing.district.ilike(f"%{district}%"))
    if search:
        term = f"%{search}%"
        q = q.where(
            or_(MarketListing.product_name.ilike(term), MarketListing.description.ilike(term))
        )
    rows = db.scalars(q.offset(offset).limit(limit)).all()
    return [_listing_out(r) for r in rows]


@router.get("/listings/mine", response_model=list[ListingOut])
def my_listings(user: CurrentUser, db: DbSession) -> list[ListingOut]:
    """Return all of the authenticated user's listings (any status)."""
    rows = db.scalars(
        select(MarketListing)
        .where(MarketListing.seller_id == user.id)
        .order_by(MarketListing.created_at.desc())
    ).all()
    return [_listing_out(r) for r in rows]


@router.get("/listings/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: int, db: DbSession) -> ListingOut:
    listing = db.get(MarketListing, listing_id)
    if not listing or listing.status == ListingStatus.deleted:
        raise HTTPException(status_code=404, detail="Listing not found.")
    return _listing_out(listing)


@router.post("/listings", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(
    payload: ListingCreate, user: CurrentUser, db: DbSession
) -> ListingOut:
    from ..models.user import User
    listing = MarketListing(seller_id=user.id, **payload.model_dump())
    db.add(listing)
    db.commit()
    db.refresh(listing)
    log_audit_event(db, actor_id=user.id, action="listing_created", target=f"listing:{listing.id}")
    return _listing_out(listing)


@router.put("/listings/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: int, payload: ListingCreate, user: CurrentUser, db: DbSession
) -> ListingOut:
    listing = _own_listing(db, listing_id, user.id)
    for k, v in payload.model_dump().items():
        setattr(listing, k, v)
    listing.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(listing)
    return _listing_out(listing)


@router.patch("/listings/{listing_id}/status", response_model=ListingOut)
def set_listing_status(
    listing_id: int,
    user: CurrentUser,
    db: DbSession,
    new_status: str = Query(pattern="^(active|paused|sold)$"),
) -> ListingOut:
    listing = _own_listing(db, listing_id, user.id)
    listing.status = new_status
    listing.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(listing)
    return _listing_out(listing)


@router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(listing_id: int, user: CurrentUser, db: DbSession) -> None:
    listing = _own_listing(db, listing_id, user.id)
    # Soft-delete for audit trail.
    listing.status = ListingStatus.deleted
    listing.updated_at = datetime.now(timezone.utc)
    db.commit()
    log_audit_event(db, actor_id=user.id, action="listing_deleted", target=f"listing:{listing_id}")


# ── Enquiry endpoints ────────────────────────────────────────────────────────

@router.post("/listings/{listing_id}/enquiries",
             response_model=EnquiryOut, status_code=status.HTTP_201_CREATED)
def create_enquiry(
    listing_id: int, payload: EnquiryCreate, user: CurrentUser, db: DbSession
) -> EnquiryOut:
    listing = db.get(MarketListing, listing_id)
    if not listing or listing.status != ListingStatus.active:
        raise HTTPException(status_code=404, detail="Listing not found or not active.")
    if listing.seller_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot enquire about your own listing.")
    enq = MarketEnquiry(listing_id=listing_id, buyer_id=user.id, **payload.model_dump())
    db.add(enq)
    db.commit()
    db.refresh(enq)
    return EnquiryOut.model_validate(enq)


@router.get("/listings/{listing_id}/enquiries", response_model=list[EnquiryOut])
def list_enquiries(listing_id: int, user: CurrentUser, db: DbSession) -> list[EnquiryOut]:
    """Seller sees all enquiries; buyer sees only their own."""
    listing = db.get(MarketListing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")
    if listing.seller_id == user.id:
        rows = db.scalars(select(MarketEnquiry).where(MarketEnquiry.listing_id == listing_id)).all()
    else:
        rows = db.scalars(
            select(MarketEnquiry).where(
                MarketEnquiry.listing_id == listing_id,
                MarketEnquiry.buyer_id == user.id,
            )
        ).all()
    return [EnquiryOut.model_validate(r) for r in rows]


@router.patch("/enquiries/{enquiry_id}/respond", response_model=EnquiryOut)
def respond_to_enquiry(
    enquiry_id: int, payload: EnquiryResponse, user: CurrentUser, db: DbSession
) -> EnquiryOut:
    enq = db.get(MarketEnquiry, enquiry_id)
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    listing = db.get(MarketListing, enq.listing_id)
    if not listing or listing.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Only the listing seller can respond.")
    enq.response = payload.response
    enq.response_status = payload.response_status
    db.commit()
    db.refresh(enq)
    return EnquiryOut.model_validate(enq)


# ── Report endpoint ───────────────────────────────────────────────────────────

@router.post("/listings/{listing_id}/report", status_code=status.HTTP_201_CREATED)
def report_listing(
    listing_id: int, payload: ReportCreate, user: CurrentUser, db: DbSession
) -> dict:
    listing = db.get(MarketListing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")
    rep = ListingReport(listing_id=listing_id, reporter_id=user.id, **payload.model_dump())
    db.add(rep)
    db.commit()
    log_audit_event(db, actor_id=user.id, action="listing_reported",
                    target=f"listing:{listing_id}", detail=payload.reason)
    return {"message": "Report submitted. Our team will review it."}


# ── Helper ─────────────────────────────────────────────────────────────────

def _own_listing(db: Session, listing_id: int, user_id: int) -> MarketListing:
    listing = db.get(MarketListing, listing_id)
    if not listing or listing.status == ListingStatus.deleted:
        raise HTTPException(status_code=404, detail="Listing not found.")
    if listing.seller_id != user_id:
        raise HTTPException(status_code=403, detail="You do not own this listing.")
    return listing
