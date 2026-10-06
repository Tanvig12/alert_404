import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BriefSection } from "./incident-detail-client";

const FULL_BRIEF = {
  headline: "P1 incident on db-finance-01 (9 alerts)",
  executive_summary: "Rules-based brief for INC-0001: 9 alerts.",
  attack_hypothesis: "Pending analyst review (rules fallback).",
  key_evidence: [
    { alert_id: "ALT-02244", event_type: "external_exploit", hostname: "db-finance-01" },
  ],
  mitre_attack: ["T1071.001"],
  recommended_actions: ["Isolate host from network immediately"],
  analyst_questions: ["Is this asset internet-exposed?"],
  severity: "Critical",
  confidence: 0.4,
  provider: "rules",
  model: "rules",
  jev: null,
};

describe("BriefSection", () => {
  it("renders full brief headline, actions, and questions", () => {
    render(<BriefSection brief={FULL_BRIEF} />);
    expect(screen.getByText("P1 incident on db-finance-01 (9 alerts)")).toBeDefined();
    expect(screen.getByText("Isolate host from network immediately")).toBeDefined();
    expect(screen.getByText("Is this asset internet-exposed?")).toBeDefined();
    expect(screen.getByText("T1071.001")).toBeDefined();
    expect(screen.getByText(/provider=rules/)).toBeDefined();
  });

  it("renders partial brief without crashing", () => {
    const { getAllByTestId } = render(<BriefSection brief={{ provider: "rules" }} />);
    expect(getAllByTestId("brief-section").length).toBeGreaterThan(0);
  });

  it("renders empty brief without crashing", () => {
    const { getAllByTestId } = render(<BriefSection brief={{}} />);
    expect(getAllByTestId("brief-section").length).toBeGreaterThan(0);
  });
});
