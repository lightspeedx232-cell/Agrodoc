"""Authentication endpoint tests."""

import pytest


def test_register_and_me(client):
    resp = client.post("/api/auth/register", json={
        "full_name": "Ravi Kumar",
        "email": "ravi@example.com",
        "password": "mypassword",
        "preferred_language": "ml",
        "state": "Kerala",
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["email"] == "ravi@example.com"
    assert data["preferred_language"] == "ml"

    # login
    resp = client.post("/api/auth/login", json={
        "email": "ravi@example.com",
        "password": "mypassword",
    })
    assert resp.status_code == 200
    tokens = resp.json()
    assert "access_token" in tokens and "refresh_token" in tokens

    # /me with token
    me = client.get("/api/auth/me", headers={
        "Authorization": f"Bearer {tokens['access_token']}"
    })
    assert me.status_code == 200
    assert me.json()["email"] == "ravi@example.com"


def test_register_duplicate_email(client):
    payload = {
        "full_name": "A", "email": "dup@example.com", "password": "password1",
    }
    client.post("/api/auth/register", json=payload)
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 409


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={
        "full_name": "A", "email": "w@example.com", "password": "correctpw",
    })
    resp = client.post("/api/auth/login", json={
        "email": "w@example.com", "password": "wrongpw",
    })
    assert resp.status_code == 401


def test_me_without_token_rejected(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_password_too_short(client):
    resp = client.post("/api/auth/register", json={
        "full_name": "A", "email": "short@example.com", "password": "12345",
    })
    assert resp.status_code == 422


def test_refresh_token_flow(client):
    client.post("/api/auth/register", json={
        "full_name": "A", "email": "rf@example.com", "password": "password1",
    })
    resp = client.post("/api/auth/login", json={
        "email": "rf@example.com", "password": "password1",
    })
    refresh = resp.json()["refresh_token"]
    resp2 = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert resp2.status_code == 200
    assert "access_token" in resp2.json()
