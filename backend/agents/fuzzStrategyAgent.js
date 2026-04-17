"use strict";

/**
 * FuzzStrategyAgent
 *
 * Reads the contract source + static findings and decides:
 *  - Which functions are highest risk and should be fuzz-targeted first
 *  - What invariants are meaningful for this specific contract
 *  - Generates a prioritised execution plan passed to the fuzz runner
 *
 * Output is consumed by both genericFuzz.js (runner) and aiFuzz.js (test gen).
 */

const { generateJSON } = require("../utils/geminiClient");

const STRATEGY_PROMPT = `You are a smart-contract fuzz-testing strategist.

Given the contract source and any prior static analysis findings, produce a
targeted fuzz-testing strategy. Think step-by-step:
  1. Identify all state-changing public/external functions
  2. Rank them by attack surface (highest risk first)
  3. For each function, specify the invariant to test and the input bounds

Return ONLY valid JSON:
{
  "contractType": "<token|vault|dao|nft|amm|other>",
  "highRiskFunctions": ["<funcSig1>", "<funcSig2>"],
  "invariants": [
    {
      "id": "INV-001",
      "name": "<short invariant name>",
      "description": "<what must always be true>",
      "targetFunction": "<funcSig>",
      "inputBounds": "<e.g. amount in [1 wei, 10 ether], address != 0>",
      "testType": "<fuzz|invariant|unit>",
      "priority": "<critical|high|medium|low>"
    }
  ],
  "attackScenarios": [
    {
      "name": "<e.g. Reentrancy drain>",
      "steps": ["<step1>", "<step2>"],
      "expectedOutcome": "<what should happen vs what might happen>",
      "forgeTestHint": "<Solidity snippet hint for the test>"
    }
  ],
  "recommendedFuzzRuns": <integer 256-2048>,
  "notes": "<any specific flags for the fuzz runner>"
}`;

/**
 * Produce a targeted fuzz strategy for the contract.
 * @param {string} sourceCode
 * @param {object} staticFindings  output from staticAgent
 * @returns {Promise<FuzzStrategy>}
 */
async function runFuzzStrategyAgent(sourceCode, staticFindings = {}) {
  const findingsSummary = (staticFindings.findings || [])
    .filter((f) => ["critical", "high", "medium"].includes(f.severity))
    .map((f) => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`)
    .join("\n")
    .substring(0, 1500);

  const prompt = `${STRATEGY_PROMPT}

PRIOR STATIC FINDINGS:
${findingsSummary || "None available yet."}

CONTRACT SOURCE:
\`\`\`solidity
${sourceCode.substring(0, 5000)}
\`\`\``;

  try {
    return normalizeStrategy(await generateJSON(prompt, { maxTokens: 2000 }), sourceCode);
  } catch (e) {
    // Return a minimal fallback strategy so the pipeline continues
    return { ...fallbackStrategy(sourceCode), notes: `Strategy generation failed: ${e.message}` };
  }
}

function normalizeStrategy(result, sourceCode) {
  const fallback = fallbackStrategy(sourceCode);
  const invariants =
    result.invariants ??
    result.properties ??
    result.tests ??
    result.fuzzTargets;

  return {
    contractType:        result.contractType || fallback.contractType,
    highRiskFunctions:   Array.isArray(result.highRiskFunctions) && result.highRiskFunctions.length
      ? result.highRiskFunctions
      : fallback.highRiskFunctions,
    invariants:          Array.isArray(invariants) && invariants.length ? invariants : fallback.invariants,
    attackScenarios:     Array.isArray(result.attackScenarios) ? result.attackScenarios : fallback.attackScenarios,
    recommendedFuzzRuns: Number(result.recommendedFuzzRuns) >= 256 ? Number(result.recommendedFuzzRuns) : 512,
    notes:               result.notes || fallback.notes,
  };
}

function fallbackStrategy(sourceCode) {
  const funcs = extractPublicFunctions(sourceCode);
  const highRisk = funcs.filter((f) => /withdraw|claim|owner|transfer|borrow|flash/i.test(f));
  return {
    contractType:         detectContractType(sourceCode),
    highRiskFunctions:    (highRisk.length ? highRisk : funcs).slice(0, 5),
    invariants:           buildFallbackInvariants(sourceCode),
    attackScenarios:      buildFallbackScenarios(sourceCode),
    recommendedFuzzRuns:  512,
    notes:                "Generated from local heuristics.",
  };
}

function buildFallbackInvariants(sourceCode) {
  const funcs = extractPublicFunctions(sourceCode);
  const invariants = [];
  if (funcs.some((f) => f.startsWith("withdraw"))) {
    invariants.push({
      id: "INV-001",
      name: "Withdraw cannot drain more than balance",
      description: "A caller must not withdraw more ETH than they deposited or more than the contract can safely account for.",
      targetFunction: "withdraw(uint256)",
      inputBounds: "amount in [1 wei, contract balance]",
      testType: "fuzz",
      priority: "critical",
    });
  }
  if (sourceCode.includes("tx.origin") || funcs.some((f) => /setOwner|transferOwnership/.test(f))) {
    invariants.push({
      id: "INV-002",
      name: "Ownership cannot be hijacked",
      description: "Unauthorized callers must not be able to become owner or trigger owner-only flows.",
      targetFunction: funcs.find((f) => /setOwner|transferOwnership/.test(f)) || "owner()",
      inputBounds: "caller != owner, newOwner != address(0)",
      testType: "fuzz",
      priority: "high",
    });
  }
  if (sourceCode.includes("unchecked")) {
    invariants.push({
      id: "INV-003",
      name: "Arithmetic remains bounded",
      description: "Unchecked arithmetic must not overflow into attacker-controlled values.",
      targetFunction: funcs.find((f) => /add|transfer|burn|mint/i.test(f)) || funcs[0] || "unknown()",
      inputBounds: "uint256 values near min/max boundaries",
      testType: "fuzz",
      priority: "medium",
    });
  }
  return invariants.length ? invariants : [{
    id: "INV-001",
    name: "State remains solvent",
    description: "Contract accounting must remain consistent after public state-changing calls.",
    targetFunction: funcs[0] || "unknown()",
    inputBounds: "valid non-zero inputs",
    testType: "fuzz",
    priority: "medium",
  }];
}

function buildFallbackScenarios(sourceCode) {
  const scenarios = [];
  if (sourceCode.includes(".call{value")) {
    scenarios.push({
      name: "Reentrancy drain",
      steps: ["Deposit from attacker contract", "Call withdraw", "Re-enter from receive hook"],
      expectedOutcome: "Re-entry must fail or attacker must not receive more than deposited.",
      forgeTestHint: "Use an attacker contract with receive() that calls withdraw again.",
    });
  }
  return scenarios;
}

function detectContractType(source) {
  const lc = source.toLowerCase();
  if (lc.includes("flashloan") || lc.includes("flash_loan") || lc.includes("reserve")) return "lending";
  if (lc.includes("totalsupply") || lc.includes("balanceof") || /\bfunction\s+transfer\s*\(/i.test(source)) return "token";
  if (lc.includes("deposit") || lc.includes("withdraw")) return "vault";
  return "other";
}

function extractPublicFunctions(src) {
  const re = /function\s+(\w+)\s*\([^)]*\)\s*(?:public|external)/g;
  const names = [];
  let m;
  while ((m = re.exec(src)) !== null) names.push(m[1] + "()");
  return names;
}

module.exports = { runFuzzStrategyAgent };
