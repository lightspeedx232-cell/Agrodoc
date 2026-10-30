# AgroDoc — Your AI Farming Assistant

A complete, responsive web application for Indian farmers: AI crop disease
diagnosis via webcam, plot-level weather, farm & plot management, government
schemes, official agricultural stores, and mandi price sources.

AgroDoc runs in a normal web browser (Chrome/Firefox) on Linux Mint desktop and
mobile, is mobile-first, installable as a PWA, and is ready to deploy over HTTPS.

## Tech stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + React Router + Leaflet (mapping) + PWA
- **Backend:** Python + FastAPI + SQLAlchemy 2.0 + PyJWT + bcrypt + Pillow + slowapi
- **Database:** SQLite for local development; PostgreSQL + PostGIS for production (Docker Compose included)
- **AI:** An adapter pattern (`backend/app/services/inference.py`) — safe "unavailable" by default, pluggable OpenAI/local model
- **Weather:** Real data via Open-Meteo (free, no key)
- **Tests:** pytest (backend) + Vitest (frontend webcam lifecycle)

## Project structure

```
AgroDoc/
├── backend/                 # FastAPI app
│   ├── app/
│   │   ├── main.py           # app entry, CORS, rate limiting, routers
│   │   ├── config.py          # env-based settings
│   │   ├── database.py       # SQLAlchemy engine/session
│   │   ├── models/            # User, Farm, Plot, CropImage, DiagnosisReport, AuditLog
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── routers/           # auth, users, farms, crop_diagnosis, weather, system
│   │   ├── services/          # inference adapter, images, weather, audit
│   │   └── core/              # security, deps, limiter
│   ├── tests/                 # pytest suite
│   ├── requirements.txt
│   └── .env.example
├── frontend/                # React + Vite app
│   ├── src/
│   │   ├── pages/             # Landing, Login, Register, Dashboard, Scanner, ...
│   │   ├── components/        # Navbar, Layout, ui
│   │   ├── hooks/useCamera.ts # webcam lifecycle (getUserMedia)
│   │   ├── lib/               # api client, auth, i18n, types, content
│   │   └── test/              # vitest webcam tests + media mock
│   └── package.json
├── docker-compose.yml         # production stack (PostgreSQL+PostGIS, backend, frontend)
├── WEBCAM_SETUP.md            # beginner webcam guide
└── README.md
```

## Quick start (local development)

### One-time setup

```bash
# 1. Backend dependencies (Python 3.12 + pip)
cd ~/Desktop/AgriDoc/backend
python3 -m pip install --user --break-system-packages virtualenv   # if venv module is missing
python3 -m virtualenv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# 2. Frontend dependencies
cd ~/Desktop/AgriDoc/frontend
npm install
```

> If `node`/`npm` are not on your PATH, run:
> `export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"`
> (already added to `~/.bashrc` during the initial setup).

### Run both servers (two terminals)

```bash
# Terminal 1 — backend on :8000
cd ~/Desktop/AgriDoc/backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend on :5173
cd ~/Desktop/AgriDoc/frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

> Use `localhost` (not an IP address) so the webcam works — browsers only allow
> camera access on a secure context. See [WEBCAM_SETUP.md](WEBCAM_SETUP.md) for full details.

## Testing

```bash
# Backend tests
cd ~/Desktop/AgriDoc/backend
source .venv/bin/activate
pytest

# Frontend tests (webcam/camera lifecycle)
cd ~/Desktop/AgriDoc/frontend
npm test
```

## Enabling AI diagnosis (optional)

AgroDoc never fakes a diagnosis. By default it reports "AI diagnosis is
unavailable". To enable real analysis, edit `backend/.env`:

```env
AI_PROVIDER=openai            # or "local"
OPENAI_API_KEY=sk-...         # for openai
LOCAL_MODEL_PATH=/path/model  # for local
```

Then restart the backend. See `backend/.env.example` for all options.

## Configuration reference

All settings are in `backend/.env` (copy from `.env.example`):

| Setting | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./agrodoc.db` | SQLite (dev) or PostgreSQL URL (prod) |
| `SECRET_KEY` | dev value | **Change in production** (`secrets.token_urlsafe(48)`) |
| `BACKEND_CORS_ORIGINS` | `http://localhost:5173,...` | Allowed frontend origins |
| `MAX_IMAGE_UPLOAD_MB` | `10` | Max leaf image size |
| `AI_PROVIDER` | `none` | `none` / `openai` / `local` |
| `OPENAI_API_KEY` | empty | OpenAI-compatible vision API key |
| `WEATHER_PROVIDER` | `open-meteo` | Free weather, no key needed |

## Production deployment (Docker Compose)

```bash
cp backend/.env.example backend/.env   # then edit SECRET_KEY, AI keys, DATABASE_URL
docker compose up --build -d
```

This starts PostgreSQL+PostGIS, the backend (serving on :8000), and builds the
frontend. Put both behind an HTTPS reverse proxy (Caddy/nginx + Let's Encrypt).
The frontend should set `VITE_API_URL` to the public backend URL at build time.

## Features implemented

- ✅ Responsive landing, registration, login, dashboard, navigation
- ✅ Secure JWT auth (access + refresh), bcrypt hashing, role-based access
- ✅ Rate limiting, input validation, audit logs, private image storage
- ✅ Account deletion + data export (GDPR-style)
- ✅ English / Malayalam / Hindi i18n (extensible)
- ✅ Webcam leaf scanner (`/crop-doctor/scanner`) — real `getUserMedia`
- ✅ Image upload + validation + AI inference adapter (honest "unavailable")
- ✅ Farm & plot management
- ✅ Real plot-level weather (Open-Meteo) with source + timestamp
- ✅ Government schemes directory (verified official portals)
- ✅ Government agricultural stores directory (verified, never faked)
- ✅ Mandi price sources (official, with source/date/units)
- ✅ PWA installable
- ✅ Backend + frontend test suites

## License & data honesty

AgroDoc never invents prices, schemes, or diagnoses. Every external data source
is named and dated. Government portals listed are publicly known official
sources; verify each before use.
