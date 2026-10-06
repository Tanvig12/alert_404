# SOC Sentinel AI

3,000 alerts in, ranked incidents with AI briefs out. One command:

```bash
docker compose -f infra/docker-compose.yml up --build
# open http://localhost:3000 → "Process 3,000 Alerts"
```

Full brain + triage on the demo laptop:

```bash
docker compose -f infra/docker-compose.yml --profile full up --build
```

## What runs where

| Service | Image | Port | Profile |
|---|---|---|---|
| db (Postgres 16) | `postgres:16-alpine` | 5432 | default |
| redis (Redis 7) | `redis:7-alpine` | 6379 | default |
| correlator (Rust Axum) | built | 8081 | default |
| backend (FastAPI, 2 workers) | built | 8000 | default |
| frontend (Next.js 15, Bun) | built | 3000 | `full` |
| brain (PyTorch CPU) | built | 8082 | `full` |
| triage (jeff placeholder) | built | 8083 | `full` |

Local env lives in `infra/.env` (copy from `.env.example`). Cloud ships
`BRAIN_URL`/`JEFF_URL` empty: the API reports `brain:"degraded"` /
`triage:"none"` honestly and the pipeline keeps working.

## Seed the demo

```bash
uv run --project backend python backend/scripts/generate_dataset.py --count 3000 --seed 42
BACKEND_URL=http://localhost:8000 DEMO_API_KEY=demo-key-change-me \
  uv run --project backend python backend/scripts/seed_demo.py
# alerts=3000 incidents=120 P1=5 campaign_recovery_pct=100.0 reduction_pct=93.3 ...
```

## Verify

```bash
cd backend && uv run pytest tests -q -p no:cacheprovider   # 26 passed
cd ../correlator && cargo test                              # 7 passed
cd ../brain && uv run --with pytest python -m pytest tests # 4 passed
cd ../frontend && bun run typecheck && bun run test && bun run build
```

Judge checks: `curl -H "X-API-Key: $DEMO_API_KEY" localhost:8000/api/v1/evaluation`
is mirrored on the Overview strip; `/api/v1/dashboard` triage counts match the
Incidents badges; `grep -r "api_key=" frontend/hooks frontend/components` is empty.
