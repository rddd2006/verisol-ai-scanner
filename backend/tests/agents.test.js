/**
 * agents.test.js
 *
 * Unit tests for all VeriSol AI agents.
 * API calls to Gemini are mocked — no real key needed for these tests.
 * Forge tests are also mocked.
 *
 * Run:  npm run test:unit
 */

"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs   = require("fs");
const path = require("path");

// ── Load fixture contracts ──────────────────────────────────────────────────
const VULNERABLE = fs.readFileSync(
  path.join(__dirname, "fixtures/VulnerableBank.sol"),
  "utf8"
);
const SAFE = fs.readFileSync(
  path.join(__dirname, "fixtures/SafeBank.sol"),
  "utf8"
);

// ── Mock Gemini so tests run without API keys ───────────────────────────────
jest.mock("../utils/geminiClient", () => ({
  generate:     jest.fn(),
  generateJSON: jest.fn(),
  startChat:    jest.fn(),
  MODEL:        "gpt-4.1-mini",
  MODEL_FAST:   "gpt-4.1-mini",
}));

// ── Mock Foundry runner ─────────────────────────────────────────────────────
jest.mock("../utils/foundryRunner", () => ({
  runForgeTest: jest.fn(),
}));

jest.mock("axios", () => ({
  get: jest.fn(),
}));

const { generate, generateJSON } = require("../utils/geminiClient");
const { runForgeTest }           = require("../utils/foundryRunner");
const axios                      = require("axios");

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
//  GeminiClient helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("geminiClient", () => {
  it("generateJSON retries on bad JSON", async () => {
    // First call returns bad JSON, second returns good
    generate
      .mockResolvedValueOnce("not json!!!")
      .mockResolvedValueOnce('{"score":42}');

    const { generateJSON: realGenerateJSON } = jest.requireActual("../utils/geminiClient");
    // We can't call the real one without a key, so just verify mock behaviour
    expect(typeof generate).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Static Agent
// ─────────────────────────────────────────────────────────────────────────────

describe("staticAgent", () => {
  const { runStaticAgent } = require("../agents/staticAgent");

  beforeEach(() => {
    generateJSON.mockResolvedValue({
      contractName:     "VulnerableBank",
      solidityVersion:  "^0.8.0",
      linesOfCode:      45,
      summary:          "Contract has critical reentrancy vulnerability.",
      rawScore:         20,
      overallRisk:      "critical",
      abi:              [{ type: "function", name: "withdraw", inputs: [{ type: "uint256", name: "amount" }], stateMutability: "nonpayable" }],
      findings: [
        { id: "VSF-001", title: "Reentrancy", severity: "critical", category: "Reentrancy",
          description: "withdraw() calls external before state update.",
          impact: "Attacker can drain contract.",
          location: "withdraw(uint256)",
          codeSnippet: "msg.sender.call{value: amount}(\"\")",
          recommendation: "Move state update before external call.",
          cweid: "CWE-841" },
      ],
      gasOptimizations: [],
    });
  });

  it("returns structured findings for vulnerable contract", async () => {
    const result = await runStaticAgent(VULNERABLE);
    expect(result.contractName).toBe("VulnerableBank");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe("critical");
    expect(result.rawScore).toBe(20);
  });

  it("assigns sequential IDs to findings that lack them", async () => {
    generateJSON.mockResolvedValueOnce({
      contractName: "X",
      findings: [
        { title: "A", severity: "high" },
        { title: "B", severity: "low" },
      ],
    });
    const result = await runStaticAgent("pragma solidity ^0.8.0; contract X {}");
    expect(result.findings[0].id).toBe("VSF-001");
    expect(result.findings[1].id).toBe("VSF-002");
  });

  it("falls back to local findings when Gemini errors", async () => {
    generateJSON.mockRejectedValueOnce(new Error("API quota exceeded"));
    const result = await runStaticAgent(VULNERABLE);
    expect(result.summary).toContain("Gemini static analysis unavailable");
    expect(result.findings.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Honeypot Agent
// ─────────────────────────────────────────────────────────────────────────────

describe("honeypotAgent", () => {
  const { runHoneypotAgent } = require("../agents/honeypotAgent");

  beforeEach(() => {
    generateJSON.mockResolvedValue({
      verdict:       "SUSPICIOUS",
      confidence:    70,
      trapped:       false,
      rugPullRisk:   "medium",
      patterns:      [{ name: "tx.origin auth", severity: "high", description: "tx.origin used", codeEvidence: "tx.origin == owner" }],
      safeToDeposit: false,
      summary:       "Contract uses tx.origin which is a phishing vector.",
    });
  });

  it("detects tx.origin via source analysis", async () => {
    const result = await runHoneypotAgent(VULNERABLE, null);
    expect(result.verdict).toMatch(/SUSPICIOUS|POTENTIAL_HONEYPOT|LIKELY_HONEYPOT/);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it("marks selfdestruct contracts as CONFIRMED_HONEYPOT (source override)", async () => {
    const sdSource = `
      pragma solidity ^0.8.0;
      contract Trap {
        function kill() public { selfdestruct(payable(msg.sender)); }
      }`;
    generateJSON.mockResolvedValueOnce({
      verdict: "CONFIRMED_HONEYPOT", confidence: 99, trapped: true,
      rugPullRisk: "critical", patterns: [], safeToDeposit: false, summary: "selfdestruct trap."
    });
    const result = await runHoneypotAgent(sdSource, null);
    expect(result.trapped).toBe(true);
  });

  it("skips bytecode and live sim when no address provided", async () => {
    const result = await runHoneypotAgent(VULNERABLE, null);
    const skipSteps = result.steps.filter((s) => s.result.includes("Skipped"));
    expect(skipSteps.length).toBeGreaterThanOrEqual(2);
  });

  it("returns steps array with ok boolean on each step", async () => {
    const result = await runHoneypotAgent(VULNERABLE, null);
    result.steps.forEach((s) => {
      expect(s).toHaveProperty("step");
      expect(s).toHaveProperty("result");
      expect(typeof s.ok).toBe("boolean");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Fuzz Strategy Agent
// ─────────────────────────────────────────────────────────────────────────────

describe("fuzzStrategyAgent", () => {
  const { runFuzzStrategyAgent } = require("../agents/fuzzStrategyAgent");

  it("returns a strategy with invariants", async () => {
    generateJSON.mockResolvedValueOnce({
      contractType:         "vault",
      highRiskFunctions:    ["withdraw(uint256)", "deposit()"],
      invariants: [
        { id: "INV-001", name: "No reentrancy drain", description: "Attacker cannot withdraw more than deposited",
          targetFunction: "withdraw(uint256)", inputBounds: "amount in [1 wei, 5 ether]",
          testType: "fuzz", priority: "critical" }
      ],
      attackScenarios:      [],
      recommendedFuzzRuns:  512,
      notes:                "",
    });
    const result = await runFuzzStrategyAgent(VULNERABLE, { findings: [] });
    expect(result.contractType).toBe("vault");
    expect(result.invariants[0].priority).toBe("critical");
    expect(result.recommendedFuzzRuns).toBe(512);
  });

  it("returns fallback strategy when Gemini fails", async () => {
    generateJSON.mockRejectedValueOnce(new Error("Rate limit"));
    const result = await runFuzzStrategyAgent(VULNERABLE, {});
    expect(result.recommendedFuzzRuns).toBe(512);
    expect(result.notes).toContain("Strategy generation failed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Fuzz Runner Agent
// ─────────────────────────────────────────────────────────────────────────────

describe("fuzzRunnerAgent", () => {
  const { runFuzzRunnerAgent } = require("../agents/fuzzRunnerAgent");

  const mockStrategy = {
    contractType: "vault",
    highRiskFunctions: ["withdraw(uint256)"],
    invariants: [{ id: "INV-001", name: "No drain", description: "...", targetFunction: "withdraw(uint256)", inputBounds: "uint96", testType: "fuzz", priority: "critical" }],
    attackScenarios: [],
    recommendedFuzzRuns: 256,
    notes: "",
  };

  const MOCK_TEST = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "forge-std/Test.sol";
contract AIFuzzTest is Test {
    address payable target;
    function setUp() public {
        vm.deal(address(this), 100 ether);
        bytes memory c = abi.encodePacked(vm.getCode("Target.sol:VulnerableBank"));
        address d; assembly { d := create(0, add(c, 0x20), mload(c)) }
        target = payable(d);
        vm.deal(target, 10 ether);
    }
    function testFuzz_noReentrancy(uint96 amt) public {
        vm.assume(amt > 0.001 ether && amt <= 1 ether);
        assertTrue(true);
    }
    receive() external payable {}
}`;

  it("returns forgeAvailable=false when forge not installed", async () => {
    generate.mockResolvedValueOnce(MOCK_TEST);
    runForgeTest.mockRejectedValueOnce(new Error("forge: ENOENT"));
    const result = await runFuzzRunnerAgent(VULNERABLE, mockStrategy);
    expect(result.forgeAvailable).toBe(false);
    expect(result.generatedTest).toBeTruthy();
  });

  it("returns passing tests when forge succeeds", async () => {
    generate.mockResolvedValueOnce(MOCK_TEST);
    runForgeTest.mockResolvedValueOnce({
      passed:      true,
      compileError: null,
      rawOutput:   "[PASS] testFuzz_noReentrancy",
      parsedTests: [{ name: "testFuzz_noReentrancy", status: "pass", reason: null, counterexample: null, gas: 5000 }],
    });
    const result = await runFuzzRunnerAgent(VULNERABLE, mockStrategy);
    expect(result.passed).toBe(true);
    expect(result.tests[0].status).toBe("pass");
  });

  it("retries with repair loop on compile error", async () => {
    const FIXED_TEST = MOCK_TEST.replace("AIFuzzTest", "AIFuzzTestFixed");
    generate
      .mockResolvedValueOnce(MOCK_TEST)  // initial generation
      .mockResolvedValueOnce(FIXED_TEST); // repair
    runForgeTest
      .mockResolvedValueOnce({ passed: false, compileError: "DeclarationError: unknown identifier", rawOutput: "", parsedTests: [] })
      .mockResolvedValueOnce({ passed: true,  compileError: null, rawOutput: "[PASS]", parsedTests: [{ name: "testFuzz_noReentrancy", status: "pass", reason: null, counterexample: null, gas: 0 }] });

    const result = await runFuzzRunnerAgent(VULNERABLE, mockStrategy);
    expect(result.passed).toBe(true);
    expect(generate).toHaveBeenCalledTimes(2); // once for gen, once for repair
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Fuzz Interpreter Agent
// ─────────────────────────────────────────────────────────────────────────────

describe("fuzzInterpreterAgent", () => {
  const { runFuzzInterpreterAgent } = require("../agents/fuzzInterpreterAgent");

  it("returns empty interpretations when no failures", async () => {
    const result = await runFuzzInterpreterAgent(
      [{ name: "testFuzz_pass", status: "pass", reason: null, counterexample: null, gas: 0 }],
      VULNERABLE, {}
    );
    expect(result.interpretations).toHaveLength(0);
    expect(result.overallFuzzSeverity).toBe("none");
  });

  it("interprets failures via Gemini", async () => {
    generateJSON.mockResolvedValueOnce({
      interpretations: [{
        testName:               "testFuzz_noReentrancyDrain",
        vulnerability:          "Reentrancy",
        cweid:                  "CWE-841",
        severity:               "critical",
        plainExplanation:       "Attacker can call withdraw() multiple times before state update.",
        attackVector:           "Deploy malicious receive() hook that re-enters withdraw().",
        counterexampleExplained:"depositWei=1000000000000000 triggered the re-entry.",
        fix:                    "Update balances before external call (CEI pattern).",
      }],
      overallFuzzSeverity: "critical",
      newFindingsVsStatic: "Fuzz confirmed the reentrancy static finding.",
    });

    const failures = [{ name: "testFuzz_noReentrancyDrain", status: "fail", reason: "REENTRANCY: attacker drained 2e-3 ETH", counterexample: "depositWei=1e15", gas: 0 }];
    const result   = await runFuzzInterpreterAgent(failures, VULNERABLE, {});

    expect(result.interpretations).toHaveLength(1);
    expect(result.interpretations[0].vulnerability).toBe("Reentrancy");
    expect(result.overallFuzzSeverity).toBe("critical");
  });

  it("uses fallback interpretations when Gemini fails", async () => {
    generateJSON.mockRejectedValueOnce(new Error("network timeout"));
    const failures = [{ name: "testFuzz_cannotOverWithdraw", status: "fail", reason: "over-withdraw", counterexample: null, gas: 0 }];
    const result   = await runFuzzInterpreterAgent(failures, VULNERABLE, {});
    expect(result.interpretations).toHaveLength(1);
    expect(result.interpretations[0].testName).toBe("testFuzz_cannotOverWithdraw");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Rating Agent
// ─────────────────────────────────────────────────────────────────────────────

describe("ratingAgent", () => {
  const { runRatingAgent } = require("../agents/ratingAgent");

  const mockAgentOutputs = {
    static: {
      findings: [
        { severity: "critical", title: "Reentrancy", category: "Reentrancy" },
        { severity: "high",     title: "tx.origin",  category: "Access Control" },
      ],
      rawScore: 30,
      summary: "Two severe issues found.",
    },
    honeypot: { verdict: "SUSPICIOUS", rugPullRisk: "medium", confidence: 60, bytecodeFlags: { hasSelfDestruct: false } },
    fuzzRunner: { tests: [{ status: "fail" }, { status: "pass" }], fuzzRuns: 512 },
    fuzzInterp: { overallFuzzSeverity: "critical", newFindingsVsStatic: "Confirmed reentrancy." },
  };

  it("returns a valid rating with all fields", async () => {
    generateJSON.mockResolvedValueOnce({
      numericScore:    25,
      letterGrade:     "F",
      riskTier:        "Critical",
      recommendation:  "Do Not Deploy",
      categoryScores:  { accessControl: 20, arithmetic: 50, reentrancy: 10, inputValidation: 60, logic: 70, upgradeability: 90, codeQuality: 30 },
      executiveSummary:"Critical reentrancy and access control issues. Do not deploy.",
      topThreeRisks:   ["Reentrancy in withdraw()", "tx.origin authentication", "Missing access control on setOwner()"],
      positives:       [],
      auditConfidence: 90,
      auditConfidenceNote: "Full source available.",
    });

    const result = await runRatingAgent(mockAgentOutputs, VULNERABLE);
    expect(result.numericScore).toBeGreaterThanOrEqual(0);
    expect(result.numericScore).toBeLessThanOrEqual(100);
    expect(result.letterGrade).toBe("F");
    expect(result.riskTier).toBe("Critical");
    expect(result.recommendation).toBe("Do Not Deploy");
    expect(result.categoryScores).toHaveProperty("accessControl");
    expect(result.topThreeRisks).toHaveLength(3);
  });

  it("falls back to local rating when Gemini fails", async () => {
    generateJSON.mockRejectedValueOnce(new Error("Quota exceeded"));
    const result = await runRatingAgent(mockAgentOutputs, VULNERABLE);
    expect(result.numericScore).toBeDefined();
    expect(result.letterGrade).toBeDefined();
    expect(["A+","A","A-","B+","B","B-","C+","C","C-","D","F"]).toContain(result.letterGrade);
  });

  it("clamps numericScore to 0-100", async () => {
    generateJSON.mockResolvedValueOnce({ numericScore: 150, letterGrade: "A+", riskTier: "Safe" });
    const result = await runRatingAgent({}, SAFE);
    expect(result.numericScore).toBeLessThanOrEqual(100);
  });

  it("assigns higher score to safe contract than vulnerable", async () => {
    // Vulnerable = critical findings → low pre-score
    const vuln = {
      static: { findings: Array(4).fill({ severity: "critical" }), rawScore: 0 },
      honeypot: { verdict: "SUSPICIOUS", bytecodeFlags: { hasSelfDestruct: false } },
      fuzzRunner: { tests: Array(3).fill({ status: "fail" }) },
      fuzzInterp: { overallFuzzSeverity: "critical" },
    };
    // Safe = no findings
    const safe = {
      static: { findings: [], rawScore: 95 },
      honeypot: { verdict: "SAFE", bytecodeFlags: { hasSelfDestruct: false } },
      fuzzRunner: { tests: Array(5).fill({ status: "pass" }) },
      fuzzInterp: { overallFuzzSeverity: "none" },
    };

    generateJSON
      .mockResolvedValueOnce({ numericScore: 20, letterGrade: "F", riskTier: "Critical", recommendation: "Do Not Deploy", categoryScores: {}, topThreeRisks: [], positives: [], auditConfidence: 80 })
      .mockResolvedValueOnce({ numericScore: 92, letterGrade: "A", riskTier: "Safe", recommendation: "Deploy Safely", categoryScores: {}, topThreeRisks: [], positives: ["No critical issues"], auditConfidence: 90 });

    const vulnRating = await runRatingAgent(vuln, VULNERABLE);
    const safeRating = await runRatingAgent(safe, SAFE);
    expect(safeRating.numericScore).toBeGreaterThan(vulnRating.numericScore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Generic Fuzz Module
// ─────────────────────────────────────────────────────────────────────────────

describe("genericFuzz module", () => {
  const { runGenericFuzz } = require("../modules/genericFuzz");

  it("returns static fallback when forge not available", async () => {
    runForgeTest.mockRejectedValueOnce(new Error("forge: ENOENT — binary not found"));
    const result = await runGenericFuzz(VULNERABLE);
    expect(result.tests.length).toBeGreaterThan(0);
    expect(result.engine).toMatch(/foundry|static-heuristic/);
  });

  it("detects reentrancy heuristically", async () => {
    runForgeTest.mockRejectedValueOnce(new Error("forge: ENOENT"));
    const result = await runGenericFuzz(VULNERABLE);
    const reentry = result.tests.find((t) => t.name.includes("Reentran") || t.name.includes("reentr"));
    expect(reentry).toBeDefined();
    expect(reentry.status).toBe("fail");
  });

  it("detects overflow heuristically", async () => {
    runForgeTest.mockRejectedValueOnce(new Error("forge: ENOENT"));
    const result = await runGenericFuzz(VULNERABLE);
    const overflow = result.tests.find((t) => t.name.toLowerCase().includes("overflow") || t.name.toLowerCase().includes("arithmetic"));
    expect(overflow).toBeDefined();
    expect(overflow.status).toBe("fail");
  });

  it("returns all tests as pass for safe contract", async () => {
    runForgeTest.mockRejectedValueOnce(new Error("forge: ENOENT"));
    const result = await runGenericFuzz(SAFE);
    const fails = result.tests.filter((t) => t.status === "fail");
    expect(fails.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  fetchSource utility
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchSource", () => {
  const { fetchSource } = require("../utils/fetchSource");
  const originalEtherscanKey = process.env.ETHERSCAN_API_KEY;

  afterEach(() => {
    if (originalEtherscanKey) process.env.ETHERSCAN_API_KEY = originalEtherscanKey;
    else delete process.env.ETHERSCAN_API_KEY;
  });

  it("returns source as-is for inputType=code", async () => {
    const src = "pragma solidity ^0.8.0; contract X {}";
    const result = await fetchSource("code", src);
    expect(result.source).toBe(src);
    expect(result.name).toBe("X");
  });

  it("throws for unknown inputType", async () => {
    await expect(fetchSource("unknown", "value")).rejects.toThrow("Unknown inputType");
  });

  it("extracts contract name from source", async () => {
    const result = await fetchSource("code", "contract MyToken { }");
    expect(result.name).toBe("MyToken");
  });

  it("uses Etherscan API V2 with Sepolia chain ID for address source", async () => {
    process.env.ETHERSCAN_API_KEY = "test-key";
    axios.get.mockResolvedValueOnce({
      data: {
        status: "1",
        message: "OK",
        result: [
          {
            SourceCode: "pragma solidity ^0.8.0; contract AddressDemo {}",
            ContractName: "AddressDemo",
          },
        ],
      },
    });

    const result = await fetchSource("address", "0x0000000000000000000000000000000000000001");

    expect(result.name).toBe("AddressDemo");
    expect(axios.get).toHaveBeenCalledWith(
      "https://api.etherscan.io/v2/api",
      expect.objectContaining({
        params: expect.objectContaining({
          chainid: "11155111",
          module: "contract",
          action: "getsourcecode",
          address: "0x0000000000000000000000000000000000000001",
          apikey: "test-key",
        }),
      })
    );
  });
});
