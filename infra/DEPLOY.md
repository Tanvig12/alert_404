# Free deployment mesh — CLI runbook (all cardless, all $0)

Topology: Vercel (frontend) + Render (backend) + Koyeb (correlator) +
Neon (Postgres) + Upstash (Redis). Brain + triage run local-only
(`docker compose --profile full`); cloud ships `BRAIN_URL`/`JEFF_URL` empty
with honest `degraded`/`none` labels. No paid APIs anywhere.

## 0. Prereqs (Bun-managed, no npm globals)

```bash
bun install -g vercel        # Vercel CLI
bun install -g neon          # Neon CLI (neonctl alias kept)
bun install -g @upstash/cli # Upstash CLI
brew install koyeb/tap/koyeb # Koyeb CLI (or curl https://www.koyeb.com/install.sh | bash)
# Render CLI: standalone binary from https://render.com/docs/cli
```

## 1. Postgres — Neon

```bash
neon auth login
neon projects create --name soc-sentinel --output json   # capture connection_string
DATABASE_URL=<neon-pooled-url> uv run --project backend alembic -c backend/alembic.ini upgrade head
```

## 2. Redis — Upstash

```bash
upstash login
upstash redis create --name soc-sentinel --region us-east-1   # capture REST URL + token
```

## 3. Correlator — Koyeb (no secrets)

```bash
docker build -f correlator/Dockerfile -t <registry>/soc-correlator:latest ./correlator
docker push <registry>/soc-correlator:latest
koyeb init
koyeb service create soc-correlator --docker <registry>/soc-correlator:latest \
  --instance-type free --ports 8081:http --regions was
# updates: koyeb service update soc-correlator --docker <registry>/soc-correlator:<new-tag>
```

## 4. Backend — Render (Blueprint, Dashboard-created)

```bash
export RENDER_API_KEY=<key-from-dashboard>
render blueprints validate   # checks infra/render.yaml locally
# New > Blueprint > connect repo (Dashboard-only first creation)
render deploys create <soc-backend-service-id> --wait
```

Render env: `DATABASE_URL` (Neon), `REDIS_URL` (Upstash), `CORRELATOR_URL`
(Koyeb URL), `BRAIN_URL` empty, `JEFF_URL` empty, `OPENROUTER_API_KEY`,
`OPENROUTER_MODEL=qwen/qwen3-next-80b-a3b-instruct:free`, `DEMO_API_KEY`,
`FRONTEND_URL` (Vercel URL).

## 5. Frontend — Vercel

```bash
cd frontend
vercel link --yes
vercel env add BACKEND_URL production
vercel env add DEMO_API_KEY production
vercel env add NEXT_PUBLIC_WS_URL production
vercel deploy && vercel deploy --prod
```

## 6. Keep-awake (two independent pingers, cheap `/healthz` only)

- UptimeRobot monitor on `<render>/healthz` + `<koyeb>/healthz` every 5min (primary).
- GitHub Actions cron `.github/workflows/keepalive.yml` every 10min (backup)
  — set `BACKEND_URL` / `CORRELATOR_URL` repo secrets.

## 7. Verify

```bash
curl <render-backend>/readyz
# {"db":"ok","redis":"ok","correlator":"ok","brain":"degraded","triage":"none"}
curl <koyeb-correlator>/healthz   # {"ok":true}
```

Idle drill: 2h idle with pingers on → reload, first paint <10s.
Fallback order: other PaaS warm-standby → local `docker compose up`.
