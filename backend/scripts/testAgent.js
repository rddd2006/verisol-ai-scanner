#!/usr/bin/env node
/**
 * Test a single agent from the command line.
 *
 * Usage:
 *   node scripts/testAgent.js <agent>  [contract-file]
 *
 * Agents: static | honeypot | fuzzStrategy | fuzzRunner | fuzzInterp | rating | generic
 *
 * Examples:
 *   node scripts/testAgent.js static
 *   node scripts/testAgent.js honeypot
 *   node scripts/testAgent.js rating
 *   node scripts/testAgent.js static ./tests/fixtures/SafeBank.sol
 */

"use strict";
require("dotenv").config();

const fs   = require("fs");
const path = require("path");

const agentName    = process.argv[2];
const contractFile = process.argv[3] || path.join(__dirname, "../tests/fixtures/VulnerableBank.sol");

if (!agentName) {
  console.error("Usage: node scripts/testAgent.js <agent> [contract-file]");
  console.error("Agents: static | honeypot | fuzzStrategy | fuzzRunner | fuzzInterp | rating | generic");
  process.exit(1);
}

const sourceCode = fs.existsSync(contractFile)
  ? fs.readFileSync(contractFile, "utf8")
  : contractFile; // treat as inline source

console.log(`\n🤖 VeriSol AI — testing agent: ${agentName}`);
console.log(`   Contract: ${path.basename(contractFile)}\n`);

async function run() {
  let result;
  const start = Date.now();

  switch (agentName) {
    case "static": {
      const { runStaticAgent } = require("../agents/staticAgent");
      result = await runStaticAgent(sourceCode);
      break;
    }
    case "honeypot": {
      const { runHoneypotAgent } = require("../agents/honeypotAgent");
      result = await runHoneypotAgent(sourceCode, null);
      break;
    }
    case "fuzzStrategy": {
      const { runFuzzStrategyAgent } = require("../agents/fuzzStrategyAgent");
      result = await runFuzzStrategyAgent(sourceCode, {});
      break;
    }
    case "fuzzRunner": {
      const { runFuzzRunnerAgent } = require("../agents/fuzzRunnerAgent");
      const strategy = { highRiskFunctions: [], invariants: [], attackScenarios: [], recommendedFuzzRuns: 256 };
      result = await runFuzzRunnerAgent(sourceCode, strategy);
      break;
    }
    case "fuzzInterp": {
      const { runFuzzInterpreterAgent } = require("../agents/fuzzInterpreterAgent");
      const mockFailures = [{ name: "testFuzz_noReentrancyDrain", status: "fail", reason: "attacker drained 2e-3 ETH", counterexample: "depositWei=1000000000000000", gas: 0 }];
      result = await runFuzzInterpreterAgent(mockFailures, sourceCode, {});
      break;
    }
    case "rating": {
      const { runRatingAgent } = require("../agents/ratingAgent");
      const mockOutputs = {
        static:     { findings: [{ severity: "critical", title: "Reentrancy", category: "Reentrancy" }], rawScore: 25, summary: "Critical issues found." },
        honeypot:   { verdict: "SUSPICIOUS", rugPullRisk: "medium", confidence: 60, bytecodeFlags: { hasSelfDestruct: false } },
        fuzzRunner: { tests: [{ status: "fail" }], fuzzRuns: 256 },
        fuzzInterp: { overallFuzzSeverity: "critical" },
      };
      result = await runRatingAgent(mockOutputs, sourceCode);
      break;
    }
    case "generic": {
      const { runGenericFuzz } = require("../modules/genericFuzz");
      result = await runGenericFuzz(sourceCode);
      break;
    }
    default:
      console.error(`Unknown agent: ${agentName}`);
      process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n✅ Completed in ${elapsed}s\n`);
  console.log(JSON.stringify(result, null, 2));
}

run().catch((err) => {
  console.error("\n❌ Agent failed:", err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
