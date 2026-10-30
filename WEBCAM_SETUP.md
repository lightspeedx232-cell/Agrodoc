# AgroDoc Webcam Setup Guide

This guide explains, in plain language, how to use your webcam with AgroDoc's
AI Crop Doctor. You do **not** need to install any special camera driver — your
normal web browser handles everything.

---

## 1. How the webcam works in a browser

Browsers (Firefox, Chrome, etc.) can talk to your webcam through a built-in
feature called the **MediaDevices API**. When a website wants to use the camera,
it asks for permission. You see a popup asking "Allow this site to use your
camera?" Once you allow it, the website shows a live video preview and can take
a still photo.

For security, browsers only allow camera access on **secure** addresses:

- `http://localhost` and `http://127.0.0.1` are treated as secure (safe for development).
- Any other `http://...` address is NOT secure, so the camera is blocked.
- `https://...` is always secure (used for a public website).

That is why AgroDoc's development setup keeps everything on `localhost`.

---

## 2. Connecting a webcam

**USB webcam:** Plug it into a USB port before starting the browser. Linux Mint
usually detects it automatically. To check, open a terminal and run:

```bash
ls /dev/video*
```

You should see something like `/dev/video0`. If you do, the webcam is
connected. (If nothing appears, try unplugging and replugging, or check that
your user is in the `video` group: `groups | grep video`. If not, run
`sudo usermod -aG video $USER` and log out and back in.)

**Built-in laptop camera:** Nothing to plug in. It usually appears as
`/dev/video0`. You can test it quickly with the Cheese app
(`sudo apt install cheese` then open "Cheese") to confirm the camera works at the
OS level before using AgroDoc.

---

## 3. Starting the AgroDoc development servers

AgroDoc has two parts that run at the same time:

1. The **backend** (Python/FastAPI) on port `8000`.
2. The **frontend** (the website you open in a browser) on port `5173`.

Open **two terminals**.

### Terminal 1 — start the backend

```bash
cd ~/Desktop/AgriDoc/backend
source .venv/bin/activate
cp -n .env.example .env          # create settings file once (already done in setup)
python -m uvicorn app.main:app --reload --port 8000
```

You should see: `Uvicorn running on http://127.0.0.1:8000`.
Test it in a browser: open `http://localhost:8000/docs` — you will see the API docs.

### Terminal 2 — start the frontend

```bash
cd ~/Desktop/AgriDoc/frontend
npm run dev
```

You should see: `Local: http://localhost:5173/`.

> Note: If `node` or `npm` are "command not found", your PATH may not be set.
> Run `export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"` in each
> terminal first (this is already added to `~/.bashrc` during setup, so a new
> terminal usually has it).

---

## 4. Opening the website and using the scanner

1. In your browser, go to **http://localhost:5173**
   (use `localhost`, not your IP address, so the camera works).
2. Click **Register**, create an account, and sign in.
3. Open the menu and go to **Leaf Scanner**
   (the path is `http://localhost:5173/crop-doctor/scanner`).

### Giving camera permission

- When you click **Start Camera**, the browser shows a permission popup.
- In **Firefox**: click "Allow" on the "Allow this site to access your camera?" bar.
  To review later: click the padlock icon left of the address bar →
  "Clear permissions" or toggle the camera permission.
- In **Chrome**: click "Allow" on the popup.
  To review later: click the camera icon left of the address bar.

### Selecting a camera

After you allow permission, the **camera dropdown** fills with your available
cameras. If you have more than one (for example a laptop camera and a USB
webcam), pick the one you want from the dropdown. The live preview switches to it.

### Capturing a leaf image

1. Make sure the live preview is showing (the red "Camera live" dot appears).
2. Point the camera at the affected leaf (see the tips on the page).
3. Click **Capture Leaf**. A still photo appears.
4. If the photo is blurry or wrong, click **Retake Image** and try again.
5. Click **Analyze Image** to send it to the AI Crop Doctor.

You can also click **"upload a photo"** to pick an existing image file instead
of using the live camera.

---

## 5. Understanding the result

- If an AI provider is **configured** (see section 7), you get a diagnosis with
  a suspected condition, a confidence percentage, symptoms, next steps, and
  prevention advice.
- If no AI provider is configured, AgroDoc honestly says
  **"AI diagnosis is unavailable"** and explains how to enable it.
  It will **never** invent a disease or fake a confidence score.

---

## 6. Troubleshooting

### Black screen / no video
- The camera may be in use by another app (e.g. Cheese, Zoom). Close it and click **Start Camera** again.
- Try a different camera from the dropdown.
- Refresh the page, then click **Start Camera** again.

### "Camera permission was denied"
- Click the padlock/camera icon next to the address bar and set the camera to **Allow**, then refresh.
- Make sure you opened the site as `http://localhost:5173` (not an IP address).

### "No camera was found"
- Confirm the camera shows up: `ls /dev/video*`.
- Plug the USB webcam into a different port.
- Check your user is in the `video` group (see section 2).

### The page loads but "Analyze Image" fails
- That is a **backend** problem, not a camera problem. Check Terminal 1: is
  the backend running on port 8000? Is `http://localhost:8000/docs` reachable?
- If you see "AI diagnosis is unavailable", that is expected until you configure
  an AI provider (section 7) — the camera is working fine.

### How to tell camera problems from AI problems
- **Camera problem** → the live preview is black/frozen or you get a camera
  error message. Fix this first (sections 2 and 6).
- **AI problem** → the live preview and capture work, but the result says
  "AI diagnosis is unavailable" or "could not reach the analysis service".
  Fix this by configuring an AI provider (section 7) or checking the backend.

---

## 7. Enabling real AI diagnosis (optional)

By default AgroDoc reports diagnosis as "unavailable" (the safe, honest default).
To enable real analysis, edit `backend/.env`:

### Option A — OpenAI-compatible vision API

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-real-key-here
OPENAI_VISION_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=https://api.openai.com/v1   (default; change for a compatible API)
```

### Option B — a local model

```env
AI_PROVIDER=local
LOCAL_MODEL_PATH=/path/to/your/model
```

Then restart the backend (Terminal 1) so it picks up the new settings.

> AgroDoc calls the configured provider through an **adapter**. To add a new
> AI service, implement `analyze()` in `backend/app/services/inference.py`
> and register it in `get_inference_adapter()`. The scanner and the API endpoint
> do not need to change.

---

## 8. Camera privacy

- The camera turns on **only after you click "Start Camera"**, never automatically.
- The red "Camera live" indicator shows when the camera is active.
- An image is sent to the backend **only after you click "Analyze Image"**.
- When you click **Stop Camera** or leave the scanner page, AgroDoc stops all
  camera tracks and releases the device.
- Images are stored privately and can only be viewed by the owner.

---

## 9. Using HTTPS for a deployed (public) website

On a public server you must serve the site over **HTTPS** for the camera to work.
The simplest options:

- Put AgroDoc behind a reverse proxy with a free **Let's Encrypt** certificate
  (for example with Caddy or nginx + certbot).
- Or deploy the frontend to a host that provides HTTPS automatically
  (for example Vercel/Netlify) and point `VITE_API_URL` to your HTTPS backend.

Once the site is at `https://your-domain`, the camera works the same way as on
`localhost`.

---

## 10. Quick test checklist (manual)

Use this when verifying with real hardware:

- [ ] `http://localhost:8000/docs` loads (backend running).
- [ ] `http://localhost:5173` loads (frontend running).
- [ ] Can register and sign in.
- [ ] Scanner page: clicking Start Camera shows a permission popup.
- [ ] Allowing permission shows a live preview.
- [ ] Camera dropdown lists the connected camera(s).
- [ ] Switching cameras changes the preview.
- [ ] Capture Leaf produces a still preview.
- [ ] Retake Image clears the still and returns to live.
- [ ] Upload a file from disk also produces a preview.
- [ ] Analyze Image sends to the backend (check Terminal 1 logs).
- [ ] Without AI configured: result says "AI diagnosis is unavailable".
- [ ] Stop Camera / leaving the page releases the camera (no "live" dot).
- [ ] A second user cannot fetch another user's captured image (private).
