import { describe, expect, it } from "vitest";
import { TACTIC_ORDER, TECHNIQUE_TO_TACTIC, bucketByTactic, severityOf } from "@/lib/matrix-model";

describe("severityOf", () => {
  it("buckets scores into P1-P3 (P4 unused by navigator scores)", () => {
    expect(severityOf(14)).toBe("P1");
    expect(severityOf(3.5)).toBe("P1");
    expect(severityOf(2)).toBe("P2");
    expect(severityOf(0.5)).toBe("P3");
  });
});

describe("bucketByTactic", () => {
  it("covers every tactic x severity cell", () => {
    const rows = bucketByTactic([]);
    expect(rows).toHaveLength(TACTIC_ORDER.length);
    for (const row of rows) {
      expect(row.map((c) => c.severity)).toEqual(["P1", "P2", "P3", "P4"]);
      expect(row.every((c) => c.count === 0 && c.topTechnique === null)).toBe(true);
    }
  });

  it("buckets techniques by mirrored tactic map and stores top technique", () => {
    const rows = bucketByTactic([
      { techniqueID: "T1071.001", score: 14 },
      { techniqueID: "T1566.002", score: 14 },
      { techniqueID: "T1110", score: 2 },
    ]);
    const c2 = rows
      .flat()
      .find((c) => c.tactic === "Command-And-Control" && c.severity === "P1");
    expect(c2?.count).toBe(1);
    expect(c2?.topTechnique).toBe("T1071.001");
    const credP2 = rows
      .flat()
      .find((c) => c.tactic === "Credential-Access" && c.severity === "P2");
    expect(credP2?.count).toBe(1);
    expect(credP2?.topTechnique).toBe("T1110");
  });

  it("ignores unknown techniques", () => {
    const rows = bucketByTactic([{ techniqueID: "T9999", score: 99 }]);
    expect(rows.flat().every((c) => c.count === 0)).toBe(true);
  });

  it("mirror map covers the backend 12 entries", () => {
    expect(Object.keys(TECHNIQUE_TO_TACTIC)).toHaveLength(12);
  });
});
