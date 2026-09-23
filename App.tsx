import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Database,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import { analystAction, getDashboard, getIncident, getIncidents, processAlerts } from "./api";
import type { Incident } from "./types";

function RiskBadge({ severity }: { severity: string }) {
  return <span className={`badge ${severity}`}>{severity}</span>;
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="muted">{label}</div>
      </div>
    </div>
  );
}

function Dashboard({ data, onSelect }: { data: any; onSelect: (id: string) => void }) {
  if (!data) return <div className="empty">Process the alert dataset to populate the SOC.</div>;

  return (
    <>
      <div className="stats">
        <Stat label="Alerts processed" value={data.total_alerts} icon={<Database size={20} />} />
        <Stat label="Incidents created" value={data.total_incidents} icon={<Shield size={20} />} />
        <Stat label="High-risk incidents" value={data.high_risk} icon={<AlertTriangle size={20} />} />
        <Stat label="Critical incidents" value={data.critical} icon={<ShieldAlert size={20} />} />
      </div>

      <div className="grid-two">
        <section className="panel">
          <div className="panel-title">Triage impact</div>
          <div className="mttt">
            <div>
              <span className="mttt-label">Before</span>
              <strong>{data.mttt_before_minutes} min</strong>
            </div>
            <div className="arrow">→</div>
            <div>
              <span className="mttt-label">Prototype</span>
              <strong>{data.mttt_after_minutes} min</strong>
            </div>
          </div>
          <p className="muted">Illustrative demo measurement from the synthetic workflow.</p>
        </section>

        <section className="panel">
          <div className="panel-title">MITRE technique distribution</div>
          <div className="bars">
            {(data.techniques || []).map((x: any) => (
              <div className="bar-row" key={x.name}>
                <span>{x.name}</span>
                <div className="bar"><i style={{ width: `${Math.min(100, x.value * 14)}%` }} /></div>
                <b>{x.value}</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Priority incidents</div>
            <div className="muted">Ranked by explainable risk, not raw alert count.</div>
          </div>
        </div>

        <div className="table">
          <div className="tr th">
            <span>Incident</span><span>Asset</span><span>Alerts</span><span>Risk</span><span>Status</span><span />
          </div>
          {data.top_incidents.map((x: any) => (
            <button className="tr row" key={x.id} onClick={() => onSelect(x.id)}>
              <span className="mono">{x.id}</span>
              <span>{x.hostname}</span>
              <span>{x.alert_count}</span>
              <span className="risk-number">{x.risk_score}</span>
              <span><RiskBadge severity={x.severity} /></span>
              <span><ChevronRight size={17} /></span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function IncidentDetail({ incident, onBack, onRefresh }: { incident: Incident; onBack: () => void; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);

  async function action(value: string) {
    setBusy(true);
    await analystAction(incident.id, value);
    setBusy(false);
    onRefresh();
  }

  return (
    <div>
      <button className="back" onClick={onBack}>← Back to incidents</button>

      <div className="incident-header">
        <div>
          <div className="eyebrow">INCIDENT</div>
          <h1>{incident.id}</h1>
          <p className="muted">{incident.first_seen} → {incident.last_seen}</p>
        </div>
        <div className="score-card">
          <span>Risk score</span>
          <strong>{incident.risk_score}</strong>
          <RiskBadge severity={incident.severity} />
        </div>
      </div>

      <div className="grid-two">
        <section className="panel">
          <div className="panel-title"><Sparkles size={18} /> AI incident brief</div>
          <p className="ai-text">{incident.ai_summary}</p>
          <h3>Why it matters</h3>
          <p>{incident.why_it_matters}</p>
        </section>

        <section className="panel">
          <div className="panel-title"><Shield size={18} /> Asset context</div>
          <div className="kv"><span>Hostname</span><b>{incident.hostname}</b></div>
          <div className="kv"><span>Type</span><b>{incident.asset_type}</b></div>
          <div className="kv"><span>Department</span><b>{incident.department}</b></div>
          <div className="kv"><span>Criticality</span><b>{incident.criticality}/5</b></div>
          <div className="kv"><span>Owner</span><b>{incident.owner}</b></div>
        </section>
      </div>

      <div className="grid-two">
        <section className="panel">
          <div className="panel-title"><BrainCircuit size={18} /> MITRE ATT&CK</div>
          <div className="techniques">
            {(incident.techniques || []).map(t => (
              <div className="technique" key={t.id}>
                <span className="tech-id">{t.id}</span>
                <div><b>{t.name}</b><small>{t.tactic}</small></div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title"><UserCheck size={18} /> Analyst workflow</div>
          <ol className="steps">
            {(incident.investigation_steps || []).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <div className="actions">
            <button disabled={busy} className="action green" onClick={() => action("acknowledge")}><CheckCircle2 size={16} /> Acknowledge</button>
            <button disabled={busy} className="action orange" onClick={() => action("escalate")}><ShieldAlert size={16} /> Escalate</button>
            <button disabled={busy} className="action gray" onClick={() => action("false_positive")}><XCircle size={16} /> False positive</button>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-title"><CircleDot size={18} /> Evidence timeline ({incident.alerts?.length || 0} alerts)</div>
        <div className="timeline">
          {(incident.alerts || []).map(a => (
            <div className="timeline-row" key={a.id}>
              <span className="time">{a.timestamp}</span>
              <span className={`dot ${a.severity}`} />
              <div>
                <b>{a.event_type.replaceAll("_", " ")}</b>
                <p>{a.description}</p>
                <small>Source: {a.source_ip} · User: {a.username} · Confidence: {a.confidence}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function App() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);
  const [processed, setProcessed] = useState(false);

  async function refresh() {
    const [d, list] = await Promise.all([getDashboard(), getIncidents()]);
    setDashboard(d);
    setIncidents(list);
    if (selected) {
      setSelected(await getIncident(selected.id));
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function runProcess() {
    setLoading(true);
    await processAlerts();
    await refresh();
    setProcessed(true);
    setLoading(false);
  }

  async function openIncident(id: string) {
    setSelected(await getIncident(id));
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="logo"><ShieldAlert size={22} /></div>
          <div>
            <div className="brand-name">SOC SENTINEL AI</div>
            <div className="brand-sub">Tier-1 alert triage assistant</div>
          </div>
        </div>

        <div className="header-actions">
          <button className="process" onClick={runProcess} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            {loading ? "Processing..." : processed ? "Reprocess 3,000 Alerts" : "Process 3,000 Alerts"}
          </button>
        </div>
      </header>

      <main>
        {selected ? (
          <IncidentDetail
            incident={selected}
            onBack={() => setSelected(null)}
            onRefresh={refresh}
          />
        ) : (
          <>
            <div className="hero">
              <div>
                <div className="eyebrow">SECURITY OPERATIONS CENTER</div>
                <h1>3,000 alerts. One analyst.</h1>
                <p>Correlate noisy alerts into incidents, prioritize by asset criticality and generate an evidence-based incident brief.</p>
              </div>
              <div className="hero-chip"><Sparkles size={17} /> AI-assisted · human-controlled</div>
            </div>

            <Dashboard data={dashboard} onSelect={openIncident} />

            {incidents.length > 0 && (
              <section className="panel">
                <div className="panel-title">All incidents</div>
                <div className="table">
                  <div className="tr th"><span>Incident</span><span>Asset</span><span>Alerts</span><span>Risk</span><span>Status</span><span /></div>
                  {incidents.slice(0, 30).map(i => (
                    <button className="tr row" key={i.id} onClick={() => openIncident(i.id)}>
                      <span className="mono">{i.id}</span>
                      <span>{i.hostname}</span>
                      <span>{i.alert_count}</span>
                      <span className="risk-number">{i.risk_score}</span>
                      <span><RiskBadge severity={i.severity} /></span>
                      <span><ChevronRight size={17} /></span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer>
        <span>Synthetic dataset · Prototype risk model · Human-in-the-loop</span>
        <span>FastAPI + React</span>
      </footer>
    </div>
  );
}

export default App;
