/**
 * Pure bucketing: navigator techniques -> tactic x severity cells.
 * Mirrors backend/app/services/mitre_mapper.py::TECHNIQUE_TO_TACTIC (12 entries)
 * and TACTIC_ORDER (10 tactics); frontend map wins on drift, backend unchanged.
 */
export const TACTIC_ORDER = [
  "Initial-Access",
  "Execution",
  "Persistence",
  "Privilege-Escalation",
  "Defense-Evasion",
  "Credential-Access",
  "Lateral-Movement",
  "Exfiltration",
  "Command-And-Control",
  "Impact",
] as const;

export const TECHNIQUE_TO_TACTIC: Record<string, string> = {
  T1110: "Credential-Access",
  T1021: "Lateral-Movement",
  "T1059.001": "Execution",
  "T1003.001": "Credential-Access",
  "T1566.002": "Initial-Access",
  "T1548.002": "Privilege-Escalation",
  T1486: "Impact",
  "T1071.001": "Command-And-Control",
  T1567: "Exfiltration",
  T1078: "Defense-Evasion",
  T1190: "Initial-Access",
  T1133: "Persistence",
};

export type SeverityBucket = "P1" | "P2" | "P3" | "P4";

export interface MatrixCell {
  tactic: string;
  severity: SeverityBucket;
  count: number;
  /** First technique id in the cell — cell click navigates to it. */
  topTechnique: string | null;
}

export const SEVERITIES: SeverityBucket[] = ["P1", "P2", "P3", "P4"];

export function severityOf(score: number): SeverityBucket {
  if (score > 3) return "P1";
  if (score > 1) return "P2";
  return "P3";
}

export function bucketByTactic(
  techniques: Array<{ techniqueID: string; score: number }>,
): MatrixCell[][] {
  const cells = new Map<string, MatrixCell>();
  for (const tactic of TACTIC_ORDER) {
    for (const sev of SEVERITIES) {
      cells.set(`${tactic}|${sev}`, { tactic, severity: sev, count: 0, topTechnique: null });
    }
  }
  for (const t of techniques) {
    const tactic = TECHNIQUE_TO_TACTIC[t.techniqueID];
    if (!tactic) continue;
    const sev = severityOf(t.score);
    const cell = cells.get(`${tactic}|${sev}`);
    if (!cell) continue;
    cell.count += 1;
    if (!cell.topTechnique) cell.topTechnique = t.techniqueID;
  }
  return TACTIC_ORDER.map((tactic) =>
    SEVERITIES.map((sev) => cells.get(`${tactic}|${sev}`) as MatrixCell),
  );
}
