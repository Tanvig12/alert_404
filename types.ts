export type Incident = {
  id: string;
  risk_score: number;
  severity: string;
  alert_count: number;
  asset_id: string;
  hostname?: string;
  criticality?: number;
  first_seen: string;
  last_seen: string;
  primary_technique?: string;
  status?: string;
  ai_summary?: string;
  why_it_matters?: string;
  investigation_steps?: string[];
  analyst_action?: string;
  asset_type?: string;
  department?: string;
  owner?: string;
  alerts?: Alert[];
  techniques?: Technique[];
};

export type Alert = {
  id: string;
  timestamp: string;
  source_ip: string;
  destination_ip: string;
  username: string;
  asset_id: string;
  event_type: string;
  severity: string;
  description: string;
  confidence: number;
  ioc_match: number;
};

export type Technique = {
  id: string;
  name: string;
  tactic: string;
};
