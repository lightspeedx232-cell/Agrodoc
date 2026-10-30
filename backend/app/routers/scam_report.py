"""Anti-scam report endpoints.

Lets users report scams (fake government portals, phishing, fraudulent
listings, fake buyers) through AgroDoc. Reports are stored and can be
forwarded. The page also links to official Indian government reporting portals.
"""

from fastapi import APIRouter, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from ..core.deps import CurrentUser, DbSession
from ..models.scam_report import ScamReport
from ..services.audit import log_audit_event

router = APIRouter(prefix="/scam-reports", tags=["scam-reports"])


SCAM_TYPES = {
    "fake_govt_portal", "phishing_link", "fake_listing",
    "fake_buyer", "payment_fraud", "other",
}


class ScamReportCreate(BaseModel):
    scam_type: str = Field(pattern="^(fake_govt_portal|phishing_link|fake_listing|fake_buyer|payment_fraud|other)$")
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1, max_length=3000)
    suspected_source: str | None = Field(default=None, max_length=500)
    reported_at_str: str | None = Field(default=None, max_length=30)
    contact_info: str | None = Field(default=None, max_length=500)
    financial_loss: str | None = Field(default=None, max_length=100)


class ScamReportOut(ScamReportCreate):
    id: int
    status: str
    created_at: str
    model_config = {"from_attributes": True}


@router.post("", response_model=ScamReportOut, status_code=status.HTTP_201_CREATED)
def create_scam_report(payload: ScamReportCreate, user: CurrentUser, db: DbSession) -> ScamReport:
    report = ScamReport(reporter_id=user.id, **payload.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    log_audit_event(db, actor_id=user.id, action="scam_reported",
                    target=f"report:{report.id}", detail=payload.scam_type)
    return report


@router.get("/mine", response_model=list[ScamReportOut])
def my_scam_reports(user: CurrentUser, db: DbSession) -> list[ScamReport]:
    return list(db.scalars(
        select(ScamReport).where(ScamReport.reporter_id == user.id)
        .order_by(ScamReport.created_at.desc())
    ).all())


# Official Indian government reporting portals (publicly known).
GOV_PORTALS = [
    {
        "name": "National Cyber Crime Reporting Portal",
        "url": "https://cybercrime.gov.in",
        "desc": "Report online fraud, phishing, and cyber crimes to the Government of India.",
        "phone": "1930 (cyber crime helpline)",
    },
    {
        "name": "National Consumer Helpline",
        "url": "https://consumerhelpline.gov.in",
        "desc": "File a consumer complaint against fraudulent sellers or services.",
        "phone": "1915 / 1800-11-4000",
    },
    {
        "name": "Public Grievance Portal (CPGRAMS)",
        "url": "https://pgportal.gov.in",
        "desc": "Lodge a grievance against any government or private service.",
        "phone": None,
    },
    {
        "name": "RBI Ombudsman (banking fraud)",
        "url": "https://cms.rbi.org.in",
        "desc": "Complain about banking fraud, unauthorised transactions, or loan scams.",
        "phone": "14440 (RBI helpline)",
    },
    {
        "name": "Kerala Police Cyber Cell",
        "url": "https://keralapolice.gov.in/cyber-crimes",
        "desc": "Kerala-specific cyber crime reporting.",
        "phone": "9497900000",
    },
]


@router.get("/portals")
def list_portals() -> dict:
    return {"portals": GOV_PORTALS}
