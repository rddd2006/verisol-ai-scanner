/**
 * integration.test.js
 *
 * Full pipeline integration tests.
 * These call real Gemini and (optionally) real forge.
 *
 * REQUIRES:
 *   GEMINI_API_KEY set in backend/.env
 *
 * Run:  npm run test:integration
 */

"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs   = require("fs");
const path = require("path");

const SKIP = !process.env.GEMINI_API_KEY;
const maybeDescribe = SKIP ? describe.skip : describe;

const VULNERABLE = fs.readFileSync(path.join(__dirname, "fixtures/VulnerableBank.sol"), "utf8");

// ─────────────────────────────────────────────────────────────────────────────

maybeDescribe("Static Agent — real Gemini call", () => {
  const { runStaticAgent } = require("../agents/staticAgent");

  it("returns findings for VulnerableBank", async () => {
    const result = await runStaticAgent(VULNERABLE);

    expect(result).toBeDefined();
    expect(result.contractName).toBe("VulnerableBank");
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);

    const severities = result.findings.map((f) => f.severity);
    expect(severities).toContain("critical");

    // Should detect reentrancy
    const titles = result.findings.map((f) => f.title.toLowerCase());
    expect(titles.some((t) => t.includes("reentr"))).toBe(true);

    // Score must be low for a vulnerable contract
    expect(result.rawScore).toBeLessThan(60);
  }, 45_000);
});

maybeDescribe("Rating Agent — real Gemini call", () => {
  const { runRatingAgent } = require("../agents/ratingAgent");

  it("returns F grade for maximally vulnerable contract", async () => {
    const mockOutputs = {
      static: {
        findings: Array(4).fill(null).map((_, i) => ({
          id: `VSF-00${i + 1}`,
          title: ["Reentrancy", "tx.origin", "Unchecked arithmetic", "Missing access control"][i],
          severity: ["critical", "high", "medium", "high"][i],
          category: ["Reentrancy", "Access Control", "Arithmetic", "Access Control"][i],
        })),
        rawScore: 20,
        summary: "Four critical vulnerabilities.",
        solidityVersion: "^0.8.0",
        contractName: "VulnerableBank",
      },
      honeypot: { verdict: "SUSPICIOUS", rugPullRisk: "medium", confidence: 70, bytecodeFlags: { hasSelfDestruct: false } },
      fuzzRunner: { tests: [{ status: "fail" }, { status: "fail" }], fuzzRuns: 512 },
      fuzzInterp: { overallFuzzSeverity: "critical" },
    };

    const result = await runRatingAgent(mockOutputs, VULNERABLE);

    expect(result.numericScore).toBeLessThan(50);
    expect(["D", "F"]).toContain(result.letterGrade);
    expect(result.recommendation).toBe("Do Not Deploy");
    expect(result.topThreeRisks.length).toBeGreaterThan(0);
  }, 30_000);
});

maybeDescribe("FuzzStrategy Agent — real Gemini call", () => {
  const { runFuzzStrategyAgent } = require("../agents/fuzzStrategyAgent");

  it("plans meaningful invariants for VulnerableBank", async () => {
    const staticFindings = {
      findings: [
        { severity: "critical", title: "Reentrancy", description: "withdraw() re-entrant" },
      ],
    };

    const result = await runFuzzStrategyAgent(VULNERABLE, staticFindings);

    expect(result.contractType).toBeDefined();
    expect(Array.isArray(result.invariants)).toBe(true);
    expect(result.invariants.length).toBeGreaterThan(0);
    expect(result.recommendedFuzzRuns).toBeGreaterThanOrEqual(256);

    // Should identify withdraw as high-risk
    const highRisk = result.highRiskFunctions.join(" ").toLowerCase();
    expect(highRisk).toContain("withdraw");
  }, 30_000);
});

maybeDescribe("Full orchestrator pipeline (no forge)", () => {
  const { runOrchestratorSimple } = require("../agents/orchestrator");

  it("runs static + honeypot only and produces a rating", async () => {
    const report = await runOrchestratorSimple(VULNERABLE, null, {
      static:      true,
      honeypot:    true,
      genericFuzz: false, // skip forge for CI
      aiFuzz:      false,
    });

    expect(report).toBeDefined();
    expect(report.static).toBeDefined();
    expect(report.honeypot).toBeDefined();
    expect(report.rating).toBeDefined();

    expect(report.rating.numericScore).toBeGreaterThanOrEqual(0);
    expect(report.rating.numericScore).toBeLessThanOrEqual(100);
    expect(report.rating.letterGrade).toBeDefined();
    expect(report.rating.recommendation).toBeDefined();

    // VulnerableBank should not score well
    expect(report.rating.numericScore).toBeLessThan(70);
  }, 90_000);
});
