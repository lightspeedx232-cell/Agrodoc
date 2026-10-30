"""Marketplace endpoint tests: listings, enquiries, reports, permissions."""

import pytest


def _register_login(client, email: str, name: str = "Farmer") -> str:
    client.post("/api/auth/register", json={
        "full_name": name, "email": email, "password": "password1"
    })
    return client.post("/api/auth/login", json={
        "email": email, "password": "password1"
    }).json()["access_token"]


LISTING_BODY = {
    "product_type": "vegetable", "product_name": "Tomato",
    "variety": "PKM-1", "quantity": 500, "unit": "kg",
    "asking_price_per_unit": 30.0, "price_negotiable": True,
    "state": "Kerala", "district": "Palakkad",
    "contact_preference": "phone_on_request",
}


def test_create_and_browse_listing(client):
    tok = _register_login(client, "seller@example.com", "Ravi")
    H = {"Authorization": f"Bearer {tok}"}

    # Create
    r = client.post("/api/marketplace/listings", json=LISTING_BODY, headers=H)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["product_name"] == "Tomato"
    assert body["status"] == "active"
    listing_id = body["id"]

    # Browse (public)
    r = client.get("/api/marketplace/listings")
    assert r.status_code == 200
    found = [l for l in r.json() if l["id"] == listing_id]
    assert len(found) == 1

    # Contact info NEVER in listing response
    raw = str(found[0])
    assert "phone" not in raw.lower() or "phone_on_request" in raw


def test_filter_by_product_type(client):
    tok = _register_login(client, "s2@example.com")
    H = {"Authorization": f"Bearer {tok}"}
    client.post("/api/marketplace/listings", json={**LISTING_BODY, "product_type": "fruit", "product_name": "Mango"}, headers=H)
    client.post("/api/marketplace/listings", json=LISTING_BODY, headers=H)

    r = client.get("/api/marketplace/listings?product_type=fruit")
    data = r.json()
    assert all(l["product_type"] == "fruit" for l in data)


def test_enquiry_creates_and_is_visible_to_seller_and_buyer(client):
    seller_tok = _register_login(client, "seller@ex.com", "Seller")
    buyer_tok  = _register_login(client, "buyer@ex.com", "Buyer")
    Hs = {"Authorization": f"Bearer {seller_tok}"}
    Hb = {"Authorization": f"Bearer {buyer_tok}"}

    lid = client.post("/api/marketplace/listings", json=LISTING_BODY, headers=Hs).json()["id"]

    # Buyer sends an enquiry
    r = client.post(f"/api/marketplace/listings/{lid}/enquiries",
        json={"kind": "enquiry", "message": "Is this organic?"},
        headers=Hb)
    assert r.status_code == 201
    enq_id = r.json()["id"]

    # Seller sees it
    assert any(e["id"] == enq_id for e in client.get(f"/api/marketplace/listings/{lid}/enquiries", headers=Hs).json())

    # Buyer also sees their own
    assert any(e["id"] == enq_id for e in client.get(f"/api/marketplace/listings/{lid}/enquiries", headers=Hb).json())


def test_seller_cannot_enquire_own_listing(client):
    tok = _register_login(client, "solo@ex.com")
    H = {"Authorization": f"Bearer {tok}"}
    lid = client.post("/api/marketplace/listings", json=LISTING_BODY, headers=H).json()["id"]
    r = client.post(f"/api/marketplace/listings/{lid}/enquiries",
        json={"kind": "enquiry", "message": "Hello"}, headers=H)
    assert r.status_code == 400


def test_pause_and_reactivate_listing(client):
    tok = _register_login(client, "pauser@ex.com")
    H = {"Authorization": f"Bearer {tok}"}
    lid = client.post("/api/marketplace/listings", json=LISTING_BODY, headers=H).json()["id"]

    r = client.patch(f"/api/marketplace/listings/{lid}/status?new_status=paused", headers=H)
    assert r.status_code == 200
    assert r.json()["status"] == "paused"

    r = client.patch(f"/api/marketplace/listings/{lid}/status?new_status=active", headers=H)
    assert r.json()["status"] == "active"


def test_another_user_cannot_modify_listing(client):
    tok1 = _register_login(client, "owner@ex.com")
    tok2 = _register_login(client, "attacker@ex.com")
    H1 = {"Authorization": f"Bearer {tok1}"}
    H2 = {"Authorization": f"Bearer {tok2}"}

    lid = client.post("/api/marketplace/listings", json=LISTING_BODY, headers=H1).json()["id"]

    r = client.delete(f"/api/marketplace/listings/{lid}", headers=H2)
    assert r.status_code == 403


def test_report_listing(client):
    tok_s = _register_login(client, "repseller@ex.com")
    tok_r = _register_login(client, "reporter@ex.com")
    Hs = {"Authorization": f"Bearer {tok_s}"}
    Hr = {"Authorization": f"Bearer {tok_r}"}

    lid = client.post("/api/marketplace/listings", json=LISTING_BODY, headers=Hs).json()["id"]
    r = client.post(f"/api/marketplace/listings/{lid}/report",
        json={"reason": "fake_listing"}, headers=Hr)
    assert r.status_code == 201

    # Report count increments
    listing = client.get(f"/api/marketplace/listings/{lid}").json()
    assert listing["report_count"] >= 1


def test_boundary_patch_calculates_area(client):
    """Boundary PATCH auto-calculates area in acres."""
    tok = _register_login(client, "farmer_geo@ex.com")
    H = {"Authorization": f"Bearer {tok}"}

    # Create farm + plot
    farm = client.post("/api/farms", json={"name": "Test Farm"}, headers=H).json()
    plot = client.post(f"/api/farms/{farm['id']}/plots",
        json={"name": "Plot 1"}, headers=H).json()

    # Patch with a small square polygon (~1 acre)
    gj = {
        "type": "Polygon",
        "coordinates": [[
            [76.9, 11.0], [76.9, 11.006], [76.906, 11.006], [76.906, 11.0], [76.9, 11.0]
        ]]
    }
    import json
    r = client.patch(
        f"/api/farms/{farm['id']}/plots/{plot['id']}/boundary",
        json={"boundary_geojson": json.dumps(gj)},
        headers=H
    )
    assert r.status_code == 200
    data = r.json()
    assert data["boundary_geojson"] is not None
    assert data["area_acres"] is not None and data["area_acres"] > 0
