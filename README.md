# OpenVoice Studio

OpenVoice Studio is a local-first web UI for [MyShell OpenVoice](https://myshell.ai/) that mirrors the convenience of projects like OpenWebUI, but stays entirely on your network. The gateway container keeps your private folders mounted read-only and normalises calls to the OpenVoice API so the frontend can focus on UX.

## Features (MVP)
- Upload reference audio clips (label + file) directly to your OpenVoice runtime.
- Browse reference clips and generated outputs with quick preview/download helpers.
- Run cloned TTS with accent, speed and watermark controls.
- Trigger base model TTS without cloning for fast samples.
- Convert a source clip into a target voice.
- Health indicators for the gateway and upstream OpenVoice API.
- Optional basic-auth gate for LAN deployments.
- Per-browser gateway URL picker so each client can point at the correct host without redeploying.
- Built-in microphone capture so you can record new reference clips without leaving the browser.

## Architecture
```
openvoice-studio/
├── docker-compose.yml
├── gateway/        # Express reverse proxy + file metadata endpoints
└── frontend/       # Vite-powered static UI (vanilla for now, React-ready)
```

- **Gateway** – Light Express server living next to OpenVoice. It proxies requests (streaming responses intact), lists reference/output files, and can enable Basic Auth when `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` are set.
- **Frontend** – Vite app that currently ships a minimal vanilla UI to keep the feedback loop tight. Tailwind/shadcn can layer on top once backend flows settle.

## Prerequisites
- An existing OpenVoice runtime reachable from the gateway container (set `OPENVOICE_BASE_URL`).
- Docker Compose (Unraid users can rely on the official Compose plugin).
- Optional: Node 20+ if you want to hack on the gateway/frontend outside of Docker.

## Quick Start (Docker Compose)
```bash
# Inside your projects directory
mkdir -p openvoice-studio
cd openvoice-studio
# drop this repository here, then
cp -r /path/to/this/repo/* .

# Adjust the target OpenVoice URL + host mapping as needed
$EDITOR docker-compose.yml

# Bring up the stack
docker compose up -d
```

Open http://YOUR-SERVER-IP:8099 in a browser. The UI defaults to reaching the gateway on port `3001` of the same host. If your clients connect from another device, update `VITE_GATEWAY_BASE_URL` in `docker-compose.yml` (or pass it via `.env`) to the reachable host/IP for the gateway container.

On first load you can also change the gateway directly from the UI — use the **Gateway** card at the top of the page to enter the reachable URL (the choice is stored in your browser’s local storage).

### Recording samples from the browser
Open the **Voice Library** tab and use **Capture a clip** to record from your microphone. The recording stays in-memory until you upload; leave the file picker empty and the captured audio will be sent alongside the label you provide. Browsers only enable `getUserMedia` on secure contexts, so use HTTPS (or `localhost`) if you plan to capture directly in the UI.

### Environment knobs
- `OPENVOICE_BASE_URL` – Base URL of the upstream OpenVoice API (default `http://localhost:8786`).
- `REF_DIR` / `OUT_DIR` – Where the gateway looks for reference clips and generated audio (mounted read-only).
- `PORT` – Change the gateway listen port (default `3001`). Remember to update the published port and frontend env var if you modify this.
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` – Enable simple Basic Auth for the entire UI/gateway.
- `CORS_ORIGIN` – Restrict cross-origin access (`*` by default). Set to `http://your-host:8099` if you need a tighter policy.
- `VITE_GATEWAY_BASE_URL` – Override how the frontend reaches the gateway (default: infer `http(s)://<host>:3001`).

### Local development
Run services without Docker for faster iteration:

```bash
# Gateway
cd gateway
npm install
npm run start

# Frontend
cd ../frontend
npm install
npm run dev -- --host
```

The dev server will run on http://localhost:5173. If your gateway runs elsewhere, create a `.env` file in `frontend/` with `VITE_GATEWAY_BASE_URL=http://localhost:3001` (or similar).

## Roadmap
- Tailwind + shadcn driven layout pass.
- File manager panels with richer metadata and soft-delete.
- Batch synthesis and archive/export helpers.
- Multi-provider abstraction (OpenVoice, Coqui XTTS, Piper, ElevenLabs).
- n8n webhook integration for automations.
- Expand auth options (LAN allow-list / API tokens).
- One-click “all-in-one” image for single-container deployment.

## License
[MIT](./LICENSE)
