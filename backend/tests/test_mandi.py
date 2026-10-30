"""Mandi price endpoint tests."""

def test_mandi_unconfigured_returns_message(client):
    """Without an API key configured, the endpoint must NOT fabricate prices."""
    resp = client.get("/api/mandi/prices")
    assert resp.status_code == 200
    body = resp.json()
    assert body["configured"] is False
    assert body["records"] == []
    assert body["message"] is not None
    assert "not configured" in body["message"].lower()
    assert "source" in body


def test_mandi_configured_returns_dated_records(client, monkeypatch):
    """When configured, records carry a date and a unit (never relabeled as live)."""
    import types
    from app.config import settings

    monkeypatch.setattr(settings, "MANDI_DATA_GOV_API_KEY", "fake-key")
    monkeypatch.setattr(settings, "MANDI_DATA_GOV_RESOURCE_ID", "res-123")

    class FakeResp:
        status_code = 200
        def json(self):
            return {
                "records": [
                    {
                        "commodity": "Onion",
                        "market": "Lasalgaon",
                        "state": "Maharashtra",
                        "modal_price": "2400",
                        "unit": "Rs/Quintal",
                        "arrival_date": "2024-06-01",
                    }
                ]
            }

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False
        def get(self, *args, **kwargs):
            return FakeResp()

    # Patch only the httpx reference inside the mandi service so the test
    # client's own httpx transport is unaffected.
    fake_httpx = types.SimpleNamespace(Client=FakeClient)
    monkeypatch.setattr("app.services.mandi.httpx", fake_httpx)

    resp = client.get("/api/mandi/prices")
    assert resp.status_code == 200
    body = resp.json()
    assert body["configured"] is True
    assert len(body["records"]) == 1
    rec = body["records"][0]
    assert rec["commodity"] == "Onion"
    assert rec["price"] == "2400"
    assert rec["unit"] == "Rs/Quintal"
    assert rec["arrival_date"] == "2024-06-01"
    assert rec["source"]  # source is always present
