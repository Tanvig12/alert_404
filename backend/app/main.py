"""SOC Sentinel AI — FastAPI surface: analyze, jobs+WS, HITL, eval, handoff."""
import asyncio
import csv
import io
import json
import os
import secrets
from collections import Counter
from datetime import datetime, timezone

import redis.asyncio as redis
import structlog
from fastapi import (Depends, FastAPI, File, Header, HTTPException, Query,
                     UploadFile, WebSocket, WebSocketDisconnect)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend.app.database import SessionLocal, get_db, lifespan
from backend.app.models import (Alert, AnalystAudit, Asset, Incident,
                                IncidentAlert, SuppressionRule)
from backend.app.schemas import (AlertIn, AnalyzeRequest, AnalystAction,
                                 AssetIn)
from backend.app.services.ai_service import generate_brief, generate_shift_summary
from backend.app.services.brain_client import brain_state, ensemble_anomaly
from backend.app.services.correlator_client import correlate_via_rust
from backend.app.services.correlation import correlate as mirror_correlate
from backend.app.services.mitre_mapper import (attack_stage, build_graph,
                                               enrich, map_alert,
                                               primary_technique,
                                               tactic_for)
from backend.app.services.risk_scoring import (alert_risk, incident_risk,
                                               to_priority)
from backend.app.services.triage import triage_incident

log = structlog.get_logger()
DEMO_API_KEY = os.getenv("DEMO_API_KEY", "demo-key-change-me")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CORRELATOR_URL = os.getenv("CORRELATOR_URL", "")
BRAIN_URL = os.getenv("BRAIN_URL", "")

app = FastAPI(title="SOC Sentinel AI", lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])
app.add_middleware(
    CORSMiddleware, allow_origins=[FRONTEND_URL], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"])
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

_redis: redis.Redis | None = None


def get_redis() -> redis.Redis | None:
    global _redis
    if _redis is None:
        try:
            _redis = redis.from_url(REDIS_URL, decode_responses=True)
        except Exception:
            return None
    return _redis


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


@app.get("/readyz")
async def readyz() -> dict:
    out: dict = {}
    try:
        async with SessionLocal() as s:
            await s.execute(select(1))
        out["db"] = "ok"
    except Exception:
        out["db"] = "down"
    try:
        r = get_redis()
        if r is not None:
            await r.ping()
            out["redis"] = "ok"
        else:
            out["redis"] = "down"
    except Exception:
        out["redis"] = "down"
    try:
        import httpx
        if CORRELATOR_URL:
            async with httpx.AsyncClient(timeout=3.0) as c:
                rr = await c.get(CORRELATOR_URL.replace("/correlate", "") + "/healthz"
                                 if "/correlate" in CORRELATOR_URL
                                 else CORRELATOR_URL.rstrip("/") + "/healthz")
                out["correlator"] = "ok" if rr.status_code == 200 else "down"
        else:
            out["correlator"] = "mirror"
    except Exception:
        out["correlator"] = "down"
    out["brain"] = "ok" if BRAIN_URL else "degraded"
    out["triage"] = "jeff" if os.getenv("JEFF_URL") else "none"
    return out


# ---------------------------------------------------------------- pipeline
async def run_pipeline(alerts: list[AlertIn], assets: list[AssetIn],
                       db: AsyncSession,
                       progress_cb=None) -> tuple[list[dict], dict]:
    async def prog(stage: str, done: int, total: int) -> None:
        if progress_cb:
            await progress_cb(stage, done, total)

    crit = {a.asset_id: a.criticality for a in assets}
    # Auto-provision assets referenced by alerts but missing from the batch
    # (e.g. CSV upload without an asset manifest). Known-critical hosts keep 5.
    KNOWN_CRITICAL = {"dc-01", "erp-prod-01", "vpn-gw-01", "db-finance-01",
                      "ad-01"}
    seen = {a.asset_id for a in assets}
    for a in alerts:
        if a.asset_id not in seen:
            seen.add(a.asset_id)
            c = 5 if a.asset_id in KNOWN_CRITICAL or a.hostname in KNOWN_CRITICAL else 3
            assets = [*assets, AssetIn(asset_id=a.asset_id, hostname=a.hostname,
                                      asset_type="unknown", department="unknown",
                                      owner="unknown", criticality=c)]
            crit[a.asset_id] = c
    await prog("ingest", 0, len(alerts))
    # persist assets/alerts (idempotent upsert-lite)
    for a in assets:
        existing = await db.get(Asset, a.asset_id)
        if existing is None:
            db.add(Asset(asset_id=a.asset_id, hostname=a.hostname,
                         asset_type=a.asset_type, department=a.department,
                         owner=a.owner, criticality=a.criticality))
    try:
        await db.flush()
    except Exception:
        await db.rollback()
    gt = {}
    for a in alerts:
        if await db.get(Alert, a.alert_id) is None:
            db.add(Alert(alert_id=a.alert_id, timestamp=a.timestamp,
                         asset_id=a.asset_id, hostname=a.hostname,
                         source_ip=str(a.source_ip), username=a.username,
                         event_type=a.event_type, severity=a.severity,
                         description=a.description, confidence=a.confidence,
                         ioc_match=a.ioc_match,
                         ground_truth_incident_id=getattr(a, "gt", "noise")))
        gt[a.alert_id] = getattr(a, "gt", "noise")
    try:
        await db.commit()
    except Exception:
        await db.rollback()
    await prog("ingest", len(alerts), len(alerts))

    tactics = {a.alert_id: tactic_for(map_alert(a.event_type)) for a in alerts}
    tech_ids = {a.alert_id: map_alert(a.event_type) for a in alerts}
    await prog("correlate", 0, len(alerts))
    groups = await correlate_via_rust(alerts, tactics)
    if groups is None:
        dicts = [a.model_dump(mode="json") | {"source_ip": str(a.source_ip)}
                 for a in alerts]
        # mirror needs str timestamps
        for d, a in zip(dicts, alerts):
            d["timestamp"] = a.timestamp.isoformat()
        mgroups = mirror_correlate(dicts, {k: v for k, v in tactics.items()})
        by_id = {a.alert_id: a for a in alerts}
        groups = [[by_id[d["alert_id"]] for d in g] for g in mgroups]
    await prog("correlate", len(alerts), len(alerts))

    await prog("risk", 0, len(groups))
    anomalies = await ensemble_anomaly(alerts, crit)
    anom_by_id = {a.alert_id: v for a, v in zip(alerts, anomalies)}
    bstate = brain_state()
    rules = (await db.execute(select(SuppressionRule))).scalars().all()
    suppressed_count = 0

    def is_suppressed(a: AlertIn) -> bool:
        return any(r.event_type == a.event_type
                   and (r.asset_id is None or r.asset_id == a.asset_id)
                   for r in rules)

    incidents: list[dict] = []
    for i, g in enumerate(groups):
        scores, tids = [], []
        for a in g:
            tid = tech_ids.get(a.alert_id)
            if tid:
                tids.append(tid)
            s, parts = alert_risk(a.severity, crit.get(a.asset_id, 3),
                                  a.confidence, a.ioc_match,
                                  anom_by_id.get(a.alert_id, 50.0),
                                  suppressed=is_suppressed(a))
            if is_suppressed(a):
                suppressed_count += 1
            scores.append(s)
        r = incident_risk(scores, len(set(tids)))
        pri = to_priority(r)
        g_sorted = sorted(g, key=lambda a: a.timestamp)
        first, last = g_sorted[0].timestamp, g_sorted[-1].timestamp
        pt = primary_technique(tids)
        asset0 = g_sorted[0].asset_id
        iid = f"INC-{i + 1:04d}"
        # brief top-30 by risk only — defer: compute risk first, brief after sort
        incidents.append({
            "id": iid, "asset_id": asset0, "risk_score": r,
            "severity": pri, "alert_count": len(g),
            "first_seen": first.isoformat(), "last_seen": last.isoformat(),
            "primary_technique": pt, "status": "open",
            "_alerts": g_sorted, "_tids": tids, "_scores": scores,
        })
        await prog("risk", i + 1, len(groups))
    incidents.sort(key=lambda d: d["risk_score"], reverse=True)
    # re-id by rank, offset past existing rows so repeat runs never collide
    existing = (await db.execute(
        select(func.count()).select_from(Incident))).scalar() or 0
    for i, d in enumerate(incidents):
        d["id"] = f"INC-{existing + i + 1:04d}"

    await prog("mitre", 0, len(incidents))
    for d in incidents:
        d["mitre"] = enrich(sorted(set(d["_tids"])))
        d["attack_stage"] = attack_stage(d["_tids"])
        risks = {a.alert_id: s for a, s in zip(d["_alerts"], d["_scores"])}
        d["graph"] = build_graph(d["_alerts"], tech_ids, risks)
        d["risk_factors"] = {"anomaly_part_mean": round(
            sum(anom_by_id.get(a.alert_id, 50.0) for a in d["_alerts"])
            / max(1, len(d["_alerts"])), 1), "brain": bstate,
            "distinct_techniques": len(set(d["_tids"]))}
        await prog("mitre", incidents.index(d) + 1, len(incidents))

    await prog("brief", 0, len(incidents))
    for idx, d in enumerate(incidents):
        if idx < 30:
            brief = await generate_brief(
                {k: d[k] for k in ("id", "asset_id", "risk_score", "severity",
                                   "alert_count", "primary_technique")},
                d["_alerts"], d["mitre"],
                {"risk_factors": d["risk_factors"]})
        else:
            from backend.app.services.ai_service import rules_brief
            brief = rules_brief(
                {"id": d["id"], "severity": d["severity"],
                 "asset_id": d["asset_id"], "alert_count": d["alert_count"],
                 "primary_technique": d["primary_technique"]},
                [{"alert_id": a.alert_id, "event_type": a.event_type,
                  "hostname": a.hostname} for a in d["_alerts"]])
            brief["deferred"] = False
        # jeff triage for P1/P2 (max 30)
        if d["severity"] in ("P1", "P2") and idx < 30:
            jev = await triage_incident(
                brief.get("headline", d["id"]),
                [a.description for a in d["_alerts"]], d["severity"])
            brief["jev"] = jev
        else:
            brief["jev"] = None
        d["ai_brief"] = brief
        await prog("brief", idx + 1, len(incidents))

    # persist incidents
    for d in incidents:
        db.add(Incident(
            id=d["id"], asset_id=d["asset_id"], risk_score=d["risk_score"],
            severity=d["severity"], alert_count=d["alert_count"],
            first_seen=datetime.fromisoformat(d["first_seen"]),
            last_seen=datetime.fromisoformat(d["last_seen"]),
            primary_technique=d["primary_technique"], status="open",
            ai_brief=d["ai_brief"], risk_factors=d["risk_factors"],
            graph=d["graph"]))
        for a in d["_alerts"]:
            db.add(IncidentAlert(incident_id=d["id"], alert_id=a.alert_id))
    await db.commit()
    await prog("done", len(incidents), len(incidents))

    out = [{k: v for k, v in d.items() if not k.startswith("_")} for d in incidents]
    dash = {"total_alerts": len(alerts), "total_incidents": len(incidents),
            "suppressed_count": suppressed_count}
    return out, dash


def _parse_rows(rows: list[dict]) -> tuple[list[AlertIn], str | None]:
    alerts = []
    for i, r in enumerate(rows):
        try:
            g = r.pop("ground_truth_incident_id", "noise")
            a = AlertIn(**r)
            a.gt = g  # type: ignore[attr-defined]
            alerts.append(a)
        except Exception as e:
            return [], f"row {i}: {e}"
    return alerts, None


# ---------------------------------------------------------------- routes


async def _key(x_api_key: str = Header(default="", alias="X-API-Key")) -> None:
    if x_api_key != DEMO_API_KEY:
        raise HTTPException(status_code=401, detail="bad api key")


@app.post("/api/v1/analyze")
async def analyze(req: AnalyzeRequest, db: AsyncSession = Depends(get_db),
                  _k: None = Depends(_key)) -> dict:
    if not req.alerts:
        raise HTTPException(status_code=400, detail="empty alert batch")
    incidents, dash = await run_pipeline(req.alerts, req.assets, db)
    dash.update(_dashboard_extra(incidents, req.alerts))
    return {"incidents": incidents, "dashboard": dash}


def _dashboard_extra(incidents: list[dict],
                     alerts: list[AlertIn]) -> dict:
    sev = Counter(a.severity for a in alerts)
    top = sorted(incidents, key=lambda d: d["risk_score"], reverse=True)[:10]
    techs = Counter(d["primary_technique"] for d in incidents if d["primary_technique"])
    n_alerts, n_inc = len(alerts), len(incidents)
    mttt_before = n_alerts * 3
    mttt_after = n_inc * 5
    red = round(100 * (1 - mttt_after / mttt_before), 1) if mttt_before else 0.0
    triage_counts: dict[str, int] = {"jeff": 0, "none": 0}
    for d in incidents:
        jev = (d.get("ai_brief") or {}).get("jev")
        if jev and jev.get("source") == "jeff":
            triage_counts["jeff"] += 1
        else:
            triage_counts["none"] += 1
    return {
        "high_risk": sum(1 for d in incidents if d["severity"] in ("P1", "P2")),
        "critical": sum(1 for d in incidents if d["severity"] == "P1"),
        "triage_source_counts": triage_counts,
        "top_incidents": [{"id": d["id"], "risk_score": d["risk_score"],
                           "severity": d["severity"],
                           "asset_id": d["asset_id"]} for d in top],
        "techniques": [{"id": t, "count": c} for t, c in techs.most_common()],
        "severity_counts": dict(sev),
        "mttt_before_min": mttt_before, "mttt_after_min": mttt_after,
        "reduction_pct": red,
    }


@app.post("/api/v1/upload")
async def upload(file: UploadFile = File(...),
                 db: AsyncSession = Depends(get_db),
                 _k: None = Depends(_key)) -> dict:
    raw = (await file.read()).decode("utf-8", errors="replace")
    if file.filename and file.filename.endswith(".json"):
        try:
            data = json.loads(raw)
            rows = data if isinstance(data, list) else data.get("alerts", [])
            assets_raw = data.get("assets", []) if isinstance(data, dict) else []
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=422, detail=f"bad json: {e}")
    else:
        reader = csv.DictReader(io.StringIO(raw))
        rows = list(reader)
        assets_raw = []
    alerts, err = _parse_rows(rows)
    if err:
        raise HTTPException(status_code=422, detail=err)
    if not alerts:
        raise HTTPException(status_code=400, detail="empty alert batch")
    assets = [AssetIn(**a) for a in assets_raw] if assets_raw else []
    incidents, dash = await run_pipeline(alerts, assets, db)
    dash.update(_dashboard_extra(incidents, alerts))
    return {"incidents": incidents, "dashboard": dash}


@app.post("/api/v1/generate")
async def generate(count: int = Query(default=100, ge=1, le=3000),
                   db: AsyncSession = Depends(get_db),
                   _k: None = Depends(_key)) -> dict:
    import csv as _csv
    from pathlib import Path
    p = Path("data/synthetic_alerts_3000.csv")
    if not p.exists():
        p = Path("../data/synthetic_alerts_3000.csv")
    with open(p) as f:
        rows = list(_csv.DictReader(f))[:count]
    alerts, err = _parse_rows(rows)
    if err:
        raise HTTPException(status_code=422, detail=err)
    ap = Path("data/assets.csv")
    if not ap.exists():
        ap = Path("../data/assets.csv")
    assets = []
    if ap.exists():
        with open(ap) as f:
            assets = [AssetIn(**r) for r in _csv.DictReader(f)]
    incidents, dash = await run_pipeline(alerts, assets, db)
    dash.update(_dashboard_extra(incidents, alerts))
    return {"incidents": incidents, "dashboard": dash}


# jobs + WS tickets -------------------------------------------------------
_jobs: dict[str, dict] = {}


async def _job_write(jid: str, record: dict) -> None:
    """Mirror job record to memory + Redis (workers share Redis)."""
    _jobs[jid] = record
    r = get_redis()
    if r is not None:
        try:
            slim = {k: v for k, v in record.items() if k != "result"}
            await r.hset(f"job:{jid}", mapping={
                k: (json.dumps(v) if isinstance(v, (dict, list)) else v)
                for k, v in slim.items()})
            await r.expire(f"job:{jid}", 3600)
            if record.get("result") is not None:
                await r.set(f"job:{jid}:result",
                            json.dumps(record["result"]), ex=3600)
        except Exception:
            pass


async def _job_read(jid: str) -> dict | None:
    j = _jobs.get(jid)
    if j:
        return j
    r = get_redis()
    if r is not None:
        try:
            raw = await r.hgetall(f"job:{jid}")
            if raw:
                out = {"job_id": jid}
                for k, v in raw.items():
                    try:
                        out[k] = json.loads(v)
                    except (ValueError, TypeError):
                        try:
                            out[k] = int(v)
                        except (ValueError, TypeError):
                            out[k] = v
                res = await r.get(f"job:{jid}:result")
                out["result"] = json.loads(res) if res else None
                return out
        except Exception:
            pass
    return None


@app.post("/api/v1/jobs")
async def create_job(req: AnalyzeRequest,
                     _k: None = Depends(_key)) -> dict:
    if not req.alerts:
        raise HTTPException(status_code=400, detail="empty alert batch")
    jid = secrets.token_hex(8)
    await _job_write(jid, {"status": "running", "stage": "ingest", "done": 0,
                           "total": len(req.alerts), "result": None})

    async def runner() -> None:
        try:
            async with SessionLocal() as db:
                async def cb(stage: str, done: int, total: int) -> None:
                    cur = await _job_read(jid) or {}
                    cur.update({"stage": stage, "done": done,
                                "total": total})
                    await _job_write(jid, cur)
                incidents, dash = await run_pipeline(req.alerts, req.assets,
                                                     db, progress_cb=cb)
                dash.update(_dashboard_extra(incidents, req.alerts))
                cur = await _job_read(jid) or {}
                cur.update({"status": "done", "stage": "done",
                            "result": {"incidents": incidents,
                                       "dashboard": dash}})
                await _job_write(jid, cur)
        except Exception as e:
            cur = await _job_read(jid) or {}
            cur.update({"status": "error", "detail": str(e)})
            await _job_write(jid, cur)

    asyncio.create_task(runner())
    return {"job_id": jid}


@app.get("/api/v1/jobs/{jid}")
async def job_status(jid: str, _k: None = Depends(_key)) -> dict:
    j = await _job_read(jid)
    if not j:
        raise HTTPException(status_code=404, detail="unknown job")
    return {"job_id": jid, "status": j["status"], "stage": j.get("stage"),
            "done": j.get("done"), "total": j.get("total"),
            "result": j.get("result"), "detail": j.get("detail")}


@app.post("/api/v1/jobs/{jid}/ticket")
async def mint_ticket(jid: str, _k: None = Depends(_key)) -> dict:
    if not await _job_read(jid):
        raise HTTPException(status_code=404, detail="unknown job")
    tok = secrets.token_urlsafe(24)
    stored = False
    r = get_redis()
    if r is not None:
        try:
            await r.setex(f"ticket:{jid}:{tok}", 60, "1")
            stored = True
        except Exception:
            stored = False
    if not stored:
        _jobs[jid].setdefault("tickets", set()).add(tok)
    return {"ticket": tok}


async def _check_ticket(jid: str, ticket: str) -> bool:
    r = get_redis()
    if r is not None:
        try:
            k = f"ticket:{jid}:{ticket}"
            v = await r.get(k)
            if v:
                await r.delete(k)
                return True
            return False
        except Exception:
            pass
    toks = _jobs.get(jid, {}).get("tickets", set())
    if ticket in toks:
        toks.discard(ticket)
        return True
    return False


@app.websocket("/api/v1/jobs/{jid}")
async def job_ws(ws: WebSocket, jid: str, ticket: str = "") -> None:
    await ws.accept()
    if not await _check_ticket(jid, ticket):
        await ws.close(code=4401)
        return
    last = ""
    try:
        while True:
            j = await _job_read(jid) or {}
            stage, done, total = (j.get("stage", ""), j.get("done", 0),
                                  j.get("total", 0))
            key = f"{stage}:{done}:{total}:{j.get('status')}"
            if key != last:
                if j.get("status") == "done":
                    await ws.send_json({"stage": "done", "done": total,
                                        "total": total})
                    await ws.send_json({"status": "done"})
                    break
                await ws.send_json({"stage": stage, "done": done,
                                    "total": total})
                last = key
            if j.get("status") == "error":
                await ws.send_json({"status": "error",
                                    "detail": j.get("detail")})
                break
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass


# incidents / HITL ----------------------------------------------------------
@app.get("/api/v1/incidents")
async def list_incidents(severity: str = "", status: str = "",
                         technique: str = "", page: int = 1,
                         db: AsyncSession = Depends(get_db),
                         _k: None = Depends(_key)) -> dict:
    q = select(Incident).order_by(Incident.risk_score.desc())
    if severity:
        q = q.where(Incident.severity == severity)
    if status:
        q = q.where(Incident.status == status)
    if technique:
        q = q.where(Incident.primary_technique == technique)
    total = (await db.execute(
        select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.offset((page - 1) * 50).limit(50))).scalars().all()
    return {"total": total, "page": page,
            "incidents": [_ser_inc(r) for r in rows]}


def _ser_inc(r: Incident) -> dict:
    return {"id": r.id, "asset_id": r.asset_id, "risk_score": r.risk_score,
            "severity": r.severity, "alert_count": r.alert_count,
            "first_seen": r.first_seen.isoformat()
            if isinstance(r.first_seen, datetime) else r.first_seen,
            "last_seen": r.last_seen.isoformat()
            if isinstance(r.last_seen, datetime) else r.last_seen,
            "primary_technique": r.primary_technique, "status": r.status,
            "ai_brief": r.ai_brief, "risk_factors": r.risk_factors,
            "graph": r.graph}


@app.get("/api/v1/incidents/{iid}")
async def get_incident(iid: str, db: AsyncSession = Depends(get_db),
                       _k: None = Depends(_key)) -> dict:
    r = (await db.execute(select(Incident).where(Incident.id == iid))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="unknown incident")
    alerts = (await db.execute(
        select(Alert).join(IncidentAlert,
                           IncidentAlert.alert_id == Alert.alert_id)
        .where(IncidentAlert.incident_id == iid))).scalars().all()
    d = _ser_inc(r)
    d["alerts"] = [{"alert_id": a.alert_id,
                    "timestamp": a.timestamp.isoformat(),
                    "asset_id": a.asset_id, "hostname": a.hostname,
                    "source_ip": a.source_ip, "username": a.username,
                    "event_type": a.event_type, "severity": a.severity,
                    "description": a.description,
                    "confidence": a.confidence,
                    "ioc_match": a.ioc_match} for a in alerts]
    return d


@app.post("/api/v1/incidents/{iid}/action")
async def incident_action(iid: str, act: AnalystAction,
                          db: AsyncSession = Depends(get_db),
                          _k: None = Depends(_key)) -> dict:
    r = (await db.execute(select(Incident).where(Incident.id == iid))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="unknown incident")
    mapping = {"acknowledge": "acknowledged", "escalate": "escalated",
               "false_positive": "false_positive"}
    r.status = mapping[act.action]
    db.add(AnalystAudit(incident_id=iid, action=act.action,
                        analyst_id=act.analyst_id, note=act.note))
    if act.action == "false_positive":
        alerts = (await db.execute(
            select(Alert).join(IncidentAlert,
                               IncidentAlert.alert_id == Alert.alert_id)
            .where(IncidentAlert.incident_id == iid))).scalars().all()
        ets = {a.event_type for a in alerts}
        for et in ets:
            db.add(SuppressionRule(event_type=et, asset_id=r.asset_id,
                                   reason=act.note or "marked FP",
                                   created_by=act.analyst_id))
    await db.commit()
    return {"status": r.status}


@app.get("/api/v1/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db),
                    _k: None = Depends(_key)) -> dict:
    n_alerts = (await db.execute(select(func.count()).select_from(Alert))).scalar() or 0
    n_inc = (await db.execute(select(func.count()).select_from(Incident))).scalar() or 0
    rows = (await db.execute(select(Incident))).scalars().all()
    incs = [_ser_inc(r) for r in rows]
    d = {"total_alerts": n_alerts, "total_incidents": n_inc,
         "suppressed_count": (await db.execute(
             select(func.count()).select_from(SuppressionRule))).scalar() or 0}
    d.update(_dashboard_extra(incs, []))
    # fix mttt with real counts
    d["mttt_before_min"] = n_alerts * 3
    d["mttt_after_min"] = n_inc * 5
    d["reduction_pct"] = round(100 * (1 - (n_inc * 5) / (n_alerts * 3)), 1) if n_alerts else 0.0
    return d


@app.get("/api/v1/metrics")
async def metrics(db: AsyncSession = Depends(get_db),
                  _k: None = Depends(_key)) -> dict:
    n_alerts = (await db.execute(select(func.count()).select_from(Alert))).scalar() or 0
    n_inc = (await db.execute(select(func.count()).select_from(Incident))).scalar() or 0
    return {
        "compression_ratio": round(n_alerts / n_inc, 1) if n_inc else 0.0,
        "mttt_before_min": n_alerts * 3,
        "mttt_after_min": n_inc * 5,
        "reduction_pct": round(100 * (1 - (n_inc * 5) / (n_alerts * 3)), 1) if n_alerts and n_inc else 0.0,
        "method": "estimate_3min_per_alert_5min_per_incident",
    }


@app.get("/api/v1/evaluation")
async def evaluation(db: AsyncSession = Depends(get_db),
                     _k: None = Depends(_key)) -> dict:
    alerts = (await db.execute(select(Alert))).scalars().all()
    incs = (await db.execute(select(Incident))).scalars().all()
    links = (await db.execute(select(IncidentAlert))).scalars().all()
    inc_of: dict[str, str] = {li.alert_id: li.incident_id for li in links}
    sev_of = {i.id: i.severity for i in incs}
    camps: dict[str, list[str]] = {}
    for a in alerts:
        if a.ground_truth_incident_id != "noise":
            camps.setdefault(a.ground_truth_incident_id, []).append(a.alert_id)
    recovered = 0
    for cid, aids in camps.items():
        buckets: Counter = Counter(inc_of.get(x, "") for x in aids)
        top, cnt = buckets.most_common(1)[0]
        if top and cnt / len(aids) >= 0.6:
            recovered += 1
    # precision/recall over P1-P2 vs campaign alerts
    camp_set = {a.alert_id for a in alerts
                if a.ground_truth_incident_id != "noise"}
    flagged = {li.alert_id for li in links
               if sev_of.get(li.incident_id) in ("P1", "P2")}
    tp = len(camp_set & flagged)
    fp = len(flagged - camp_set)
    fn = len(camp_set - flagged)
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    noise_total = sum(1 for a in alerts
                      if a.ground_truth_incident_id == "noise")
    fp_rate = fp / noise_total if noise_total else 0.0
    n_alerts, n_inc = len(alerts), len(incs)
    drift: dict = {"oov_rate": 0.0, "recon_shift": 0.0,
                   "retrain_recommended": False}
    if BRAIN_URL:
        try:
            import httpx as _hx
            async with _hx.AsyncClient(timeout=5.0) as c:
                rr = await c.get(BRAIN_URL.replace("/score", "") + "/drift"
                                 if "/score" in BRAIN_URL
                                 else BRAIN_URL.rstrip("/") + "/drift")
                if rr.status_code == 200:
                    drift = rr.json()
        except Exception:
            pass
    return {
        "campaign_recovery_pct": round(100 * recovered / len(camps), 1) if camps else 0.0,
        "precision": round(prec, 3), "recall": round(rec, 3),
        "f1": round(f1, 3), "fp_rate": round(fp_rate, 4),
        "noise_reduction_pct": round(100 * (1 - n_inc / n_alerts), 1) if n_alerts else 0.0,
        "drift": drift, "brain": brain_state(),
    }


@app.get("/api/v1/handoff.md")
async def handoff(db: AsyncSession = Depends(get_db),
                  _k: None = Depends(_key)) -> PlainTextResponse:
    rows = (await db.execute(
        select(Incident).order_by(Incident.risk_score.desc()))).scalars().all()
    p1p2 = [r for r in rows if r.severity in ("P1", "P2")]
    p3 = [r for r in rows if r.severity == "P3"]
    audits = (await db.execute(
        select(AnalystAudit).order_by(AnalystAudit.created_at.desc()).limit(20))).scalars().all()
    L = ["# SOC Shift Handoff", f"_Generated {datetime.now(timezone.utc).isoformat()}_", "",
         "## P1/P2 — act now"]
    for r in p1p2[:15]:
        b = (r.ai_brief or {})
        L.append(f"- **{r.id}** {r.severity} {r.asset_id} risk={r.risk_score} "
                 f"tech={r.primary_technique}: {b.get('headline', '')}")
        for a in (b.get("recommended_actions") or [])[:3]:
            L.append(f"  - [ ] {a}")
    L += ["", "## P3 watchlist"]
    for r in p3[:15]:
        L.append(f"- **{r.id}** {r.asset_id} risk={r.risk_score} tech={r.primary_technique}")
    L += ["", "## Queue health",
          f"- incidents={len(rows)} open={sum(1 for r in rows if r.status == 'open')} "
          f"ack={sum(1 for r in rows if r.status == 'acknowledged')} "
          f"esc={sum(1 for r in rows if r.status == 'escalated')} "
          f"fp={sum(1 for r in rows if r.status == 'false_positive')}",
          "", "## Open analyst actions"]
    for a in audits:
        L.append(f"- {a.incident_id} {a.action} by {a.analyst_id}: {a.note}")
    return PlainTextResponse("\n".join(L) + "\n", media_type="text/markdown")


_summary_cache: dict = {}


def _queue_snapshot(rows, audits) -> dict:
    """Aggregate the queue into one LLM-sized snapshot dict."""
    by_sev: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for r in rows:
        by_sev[r.severity] = by_sev.get(r.severity, 0) + 1
        by_status[r.status] = by_status.get(r.status, 0) + 1

    def top(sevs: tuple[str, ...], n: int) -> list[dict]:
        out = []
        for r in rows:
            if r.severity in sevs:
                b = r.ai_brief or {}
                out.append({
                    "id": r.id, "asset_id": r.asset_id,
                    "risk_score": r.risk_score, "status": r.status,
                    "primary_technique": r.primary_technique,
                    "headline": str(b.get("headline", ""))[:160],
                    "triage": ((b.get("jev") or {}).get("disposition")
                               if isinstance(b.get("jev"), dict) else None),
                })
                if len(out) >= n:
                    break
        return out

    tech_counts = Counter(r.primary_technique for r in rows
                          if r.primary_technique)
    return {
        "counts": {
            "incidents": len(rows),
            "open": by_status.get("open", 0),
            "acknowledged": by_status.get("acknowledged", 0),
            "escalated": by_status.get("escalated", 0),
            "false_positive": by_status.get("false_positive", 0),
            "P1_open": sum(1 for r in rows
                           if r.severity == "P1" and r.status == "open"),
            "P2_open": sum(1 for r in rows
                           if r.severity == "P2" and r.status == "open"),
        },
        "top_p1": top(("P1",), 5),
        "top_p2": top(("P2",), 3),
        "technique_counts": dict(tech_counts.most_common(8)),
        "uncovered_techniques": [],
        "analyst_actions": [
            {"incident_id": a.incident_id, "action": a.action,
             "analyst_id": a.analyst_id, "note": a.note}
            for a in audits[:10]
        ],
        "brain_state": brain_state(),
    }


@app.get("/api/v1/handoff/summary")
async def handoff_summary(db: AsyncSession = Depends(get_db),
                          _k: None = Depends(_key)) -> dict:
    """Shift summary: one LLM call per queue state, cached otherwise."""
    rows = (await db.execute(
        select(Incident).order_by(Incident.risk_score.desc()))).scalars().all()
    audits = (await db.execute(
        select(AnalystAudit).order_by(
            AnalystAudit.created_at.desc()).limit(20))).scalars().all()
    # fingerprint = exact incident-ID set in risk order + audit count; any
    # new analysis run or analyst action busts the cache honestly
    fingerprint = ([r.id for r in rows],
                   [(a.incident_id, a.action) for a in audits])
    cached = _summary_cache.get("entry")
    if cached and cached.get("fingerprint") == fingerprint:
        return cached["summary"]
    snapshot = _queue_snapshot(rows, audits)
    summary = await generate_shift_summary(snapshot)
    summary["incident_count"] = len(rows)
    _summary_cache["entry"] = {"fingerprint": fingerprint, "summary": summary}
    return summary


@app.get("/api/v1/navigator")
async def navigator(db: AsyncSession = Depends(get_db),
                    _k: None = Depends(_key)) -> dict:
    rows = (await db.execute(select(Incident))).scalars().all()
    counts = Counter(r.primary_technique for r in rows if r.primary_technique)
    return {
        "name": "SOC Sentinel layer", "version": "4.5",
        "domain": "enterprise-attack",
        "techniques": [{"techniqueID": t, "score": c,
                        "color": "#f87171" if c > 3 else "#fbbf24"}
                       for t, c in counts.items()],
    }
