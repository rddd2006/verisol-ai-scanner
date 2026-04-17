"use strict";

/**
 * contracts.test.js
 *
 * Tests that each pre-built example contract:
 *  1. Can be loaded from the registry
 *  2. Has the correct contract name extracted
 *  3. Is detected as the right contract type
 *  4. Produces expected static heuristic results
 *  5. Has constructor args properly detected
 *
 * Run:  npm test -- --testPathPattern=contracts
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const path = require("path");
const fs   = require("fs");

// ── Helpers (extracted from genericFuzz.js for testing) ──────────────────────

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function extractContractName(src) { return stripComments(src).match(/\bcontract\s+(\w+)/)?.[1] ?? null; }
function extractPragma(src)       { return stripComments(src).match(/pragma\s+solidity\s+([^;]+);/)?.[1]?.trim() ?? null; }

function detectContractType(source) {
  const cleaned = stripComments(source);
  const lc = cleaned.toLowerCase();
  if (lc.includes("flashloan") || lc.includes("flash_loan") || lc.includes("reserve")) return "lending";
  if (lc.includes("totalsupply") || lc.includes("balanceof") || /\bfunction\s+transfer\s*\(/i.test(cleaned)) return "token";
  return "vault";
}

function detectConstructorArgs(source) {
  const match = source.match(/constructor\s*\(([^)]*)\)/);
  if (!match || !match[1].trim()) return { hasArgs: false, encodedArgs: "" };
  const types = match[1].trim().split(",").map((p) => p.trim().split(/\s+/)[0]);
  const defaults = types.map((t) => {
    if (t.startsWith("uint") || t.startsWith("int")) return "1000e18";
    if (t === "address") return "address(this)";
    if (t === "bool")    return "true";
    if (t === "string")  return '"TestToken"';
    return "0";
  });
  return { hasArgs: true, encodedArgs: `abi.encode(${defaults.join(", ")})`, types };
}

function staticHeuristics(src) {
  const lc = stripComments(src).toLowerCase();
  return {
    reentrancy:     lc.includes(".call{") && !lc.includes("nonreentrant"),
    unchecked:      lc.includes("unchecked"),
    txOrigin:       lc.includes("tx.origin"),
    noAccessControl:lc.includes("setowner") && !lc.includes("onlyowner"),
    selfDestruct:   lc.includes("selfdestruct"),
    unlimitedMint:  lc.includes("_mint(") && !lc.includes("maxsupply") && !lc.includes("max_supply"),
    missingAllowance: /\bfunction\s+transferfrom\s*\(/i.test(stripComments(src)) && !/require\s*\([^;]*allowance/i.test(stripComments(src)),
    flashLoan:      lc.includes("flashloan"),
  };
}

// ── Load all fixture contracts ────────────────────────────────────────────────

const FIXTURES = ["VulnerableBank", "InsecureToken", "HoneypotVault", "SafeVault", "NaiveLendingPool"]
  .map((name) => ({
    name,
    source: fs.readFileSync(path.join(__dirname, `fixtures/${name}.sol`), "utf8"),
  }));

// ─────────────────────────────────────────────────────────────────────────────

describe("Contract registry (contracts/index.js)", () => {
  it("exports all 5 pre-built contracts", () => {
    const { CONTRACTS } = require(path.join(__dirname, "../../contracts/index.js"));
    expect(Object.keys(CONTRACTS)).toHaveLength(5);
    expect(CONTRACTS).toHaveProperty("VulnerableBank");
    expect(CONTRACTS).toHaveProperty("InsecureToken");
    expect(CONTRACTS).toHaveProperty("HoneypotVault");
    expect(CONTRACTS).toHaveProperty("SafeVault");
    expect(CONTRACTS).toHaveProperty("NaiveLendingPool");
  });

  it("each entry has required fields", () => {
    const { CONTRACTS } = require(path.join(__dirname, "../../contracts/index.js"));
    for (const [id, c] of Object.entries(CONTRACTS)) {
      expect(c.id).toBe(id);
      expect(typeof c.label).toBe("string");
      expect(typeof c.description).toBe("string");
      expect(typeof c.source).toBe("string");
      expect(c.source.length).toBeGreaterThan(100);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("VulnerableBank", () => {
  const { source } = FIXTURES.find((f) => f.name === "VulnerableBank");

  it("extracts correct contract name", () => {
    expect(extractContractName(source)).toBe("VulnerableBank");
  });

  it("is detected as vault type", () => {
    expect(detectContractType(source)).toBe("vault");
  });

  it("has no constructor args", () => {
    const { hasArgs } = detectConstructorArgs(source);
    expect(hasArgs).toBe(false);
  });

  it("has correct pragma ^0.8.0", () => {
    expect(extractPragma(source)).toBe("^0.8.0");
  });

  it("static heuristics detect all 4 bugs", () => {
    const h = staticHeuristics(source);
    expect(h.reentrancy).toBe(true);       // Bug 1
    expect(h.unchecked).toBe(true);        // Bug 2
    expect(h.txOrigin).toBe(true);         // Bug 3
    expect(h.noAccessControl).toBe(true);  // Bug 4
  });

  it("does NOT have selfdestruct", () => {
    expect(staticHeuristics(source).selfDestruct).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("InsecureToken", () => {
  const { source } = FIXTURES.find((f) => f.name === "InsecureToken");

  it("extracts correct contract name", () => {
    expect(extractContractName(source)).toBe("InsecureToken");
  });

  it("is detected as token type", () => {
    expect(detectContractType(source)).toBe("token");
  });

  it("has constructor arg uint256", () => {
    const { hasArgs, types } = detectConstructorArgs(source);
    expect(hasArgs).toBe(true);
    expect(types[0]).toBe("uint256");
  });

  it("static heuristics: unlimited mint + no allowance check", () => {
    const h = staticHeuristics(source);
    expect(h.unlimitedMint).toBe(true);
    expect(h.missingAllowance).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("HoneypotVault", () => {
  const { source } = FIXTURES.find((f) => f.name === "HoneypotVault");

  it("extracts correct contract name", () => {
    expect(extractContractName(source)).toBe("HoneypotVault");
  });

  it("is detected as vault type", () => {
    expect(detectContractType(source)).toBe("vault");
  });

  it("has no constructor args", () => {
    expect(detectConstructorArgs(source).hasArgs).toBe(false);
  });

  it("static heuristics: selfdestruct + tx.origin", () => {
    const h = staticHeuristics(source);
    expect(h.selfDestruct).toBe(true);
    expect(h.txOrigin).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("SafeVault", () => {
  const { source } = FIXTURES.find((f) => f.name === "SafeVault");

  it("extracts correct contract name", () => {
    expect(extractContractName(source)).toBe("SafeVault");
  });

  it("has no constructor args", () => {
    expect(detectConstructorArgs(source).hasArgs).toBe(false);
  });

  it("static heuristics: NO reentrancy, NO tx.origin, NO selfdestruct", () => {
    const h = staticHeuristics(source);
    expect(h.reentrancy).toBe(false);
    expect(h.txOrigin).toBe(false);
    expect(h.selfDestruct).toBe(false);
    expect(h.unchecked).toBe(false);
  });

  it("uses pragma ^0.8.20", () => {
    expect(extractPragma(source)).toBe("^0.8.20");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("NaiveLendingPool", () => {
  const { source } = FIXTURES.find((f) => f.name === "NaiveLendingPool");

  it("extracts correct contract name", () => {
    expect(extractContractName(source)).toBe("NaiveLendingPool");
  });

  it("is detected as lending type", () => {
    expect(detectContractType(source)).toBe("lending");
  });

  it("has no constructor args", () => {
    expect(detectConstructorArgs(source).hasArgs).toBe(false);
  });

  it("static heuristics: flash loan + reentrancy", () => {
    const h = staticHeuristics(source);
    expect(h.flashLoan).toBe(true);
    expect(h.reentrancy).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Constructor arg encoder", () => {
  it("returns empty for no-arg constructors", () => {
    const { hasArgs } = detectConstructorArgs("pragma solidity ^0.8.0; contract X { constructor() {} }");
    expect(hasArgs).toBe(false);
  });

  it("encodes uint256 with default 1000e18", () => {
    const { encodedArgs } = detectConstructorArgs("constructor(uint256 supply) {}");
    expect(encodedArgs).toContain("1000e18");
  });

  it("encodes address with address(this)", () => {
    const { encodedArgs } = detectConstructorArgs("constructor(address owner) {}");
    expect(encodedArgs).toContain("address(this)");
  });

  it("encodes multiple args", () => {
    const { encodedArgs, types } = detectConstructorArgs("constructor(uint256 a, address b) {}");
    expect(types).toHaveLength(2);
    expect(encodedArgs).toContain("1000e18");
    expect(encodedArgs).toContain("address(this)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Contract type detection", () => {
  it("detects token from balanceOf", () => {
    expect(detectContractType("function balanceOf(address a) public view returns (uint256) {}")).toBe("token");
  });

  it("detects token from totalSupply", () => {
    expect(detectContractType("uint256 public totalSupply;")).toBe("token");
  });

  it("detects lending from flashLoan", () => {
    expect(detectContractType("function flashLoan(uint256 amount) external {}")).toBe("lending");
  });

  it("defaults to vault", () => {
    expect(detectContractType("function deposit() external payable {}")).toBe("vault");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GenericFuzz test suite generation", () => {
  jest.mock("../utils/foundryRunner", () => ({ runForgeTest: jest.fn() }));
  const { runForgeTest } = require("../utils/foundryRunner");

  it("generates a test that compiles for VulnerableBank (static-heuristic fallback)", async () => {
    runForgeTest.mockRejectedValueOnce(new Error("forge: ENOENT"));
    const { runGenericFuzz } = require("../modules/genericFuzz");
    const { source } = FIXTURES.find((f) => f.name === "VulnerableBank");
    const result = await runGenericFuzz(source);
    expect(result.tests.length).toBeGreaterThan(0);
    // Should detect reentrancy and access control bugs
    const failNames = result.tests.filter((t) => t.status === "fail").map((t) => t.name);
    expect(failNames.some((n) => n.includes("Reentran") || n.includes("reentr"))).toBe(true);
  });

  it("returns forgeAvailable=false when forge not installed", async () => {
    runForgeTest.mockRejectedValueOnce(new Error("ENOENT"));
    const { runGenericFuzz } = require("../modules/genericFuzz");
    const result = await runGenericFuzz("pragma solidity ^0.8.0; contract X {}");
    expect(result.forgeAvailable).toBe(false);
  });
});
