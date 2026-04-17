"use strict";

/**
 * FuzzInterpreterAgent
 *
 * Takes raw forge test results and forge counterexamples and produces:
 *  - Plain-English explanation of each failure
 *  - Mapped vulnerability class per CWE
 *  - Concrete Solidity fix for each failure
 *  - Severity upgrade suggestions (fuzz finding may be more severe than static)
 */

const { generateJSON } = require("../utils/geminiClient");

const INTERPRET_PROMPT = `You are a smart-contract vulnerability researcher.

Foundry fuzz tests have been run against a smart contract and produced failures.
For each failed test, explain it in plain English so a developer can understand and fix it.

Return ONLY valid JSON:
{
  "interpretations": [
    {
      "testName":       "<exact function name>",
      "vulnerability":  "<vulnerability class, e.g. Reentrancy>",
      "cweid":          "<CWE-XXX or null>",
      "severity":       "<critical|high|medium|low>",
      "plainExplanation": "<2-3 sentences a junior dev can understand>",
      "attackVector":   "<how an attacker would exploit this>",
      "counterexampleExplained": "<what the forge counterexample means in human terms, or null>",
      "fix":            "<specific Solidity code fix>"
    }
  ],
  "overallFuzzSeverity": "<critical|high|medium|low|none>",
  "newFindingsVsStatic": "<brief note on whether fuzz found something static analysis missed>"
}`;

/**
 * @param {TestResult[]}  tests         from forge (parsedTests)
 * @param {string}        sourceCode
 * @param {object}        staticResult  from staticAgent (for cross-referencing)
 * @returns {Promise<InterpretResult>}
 */
async function runFuzzInterpreterAgent(tests, sourceCode, staticResult = {}) {
  const failures = (tests || []).filter((t) => t.status === "fail");

  if (failures.length === 0) {
    return {
      interpretations:      [],
      overallFuzzSeverity:  "none",
      newFindingsVsStatic:  "No fuzz failures — static analysis findings remain the primary signal.",
    };
  }

  const staticTitles = (staticResult?.findings || [])
    .map((f) => f.title)
    .join(", ");

  const prompt = `${INTERPRET_PROMPT}

FAILED TESTS (${failures.length}):
${JSON.stringify(failures, null, 2)}

STATIC ANALYSIS ALREADY FOUND: ${staticTitles || "none"}

CONTRACT SOURCE (excerpt):
\`\`\`solidity
${sourceCode.substring(0, 3000)}
\`\`\``;

  try {
    return await generateJSON(prompt, { maxTokens: 2000 });
  } catch (e) {
    // Fallback: generate minimal interpretations from test names
    return {
      interpretations: failures.map((f) => ({
        testName:                f.name,
        vulnerability:           guessVuln(f.name, f.reason),
        cweid:                   null,
        severity:                "high",
        plainExplanation:        f.reason ?? "Test failed — review this function manually.",
        attackVector:            "Unknown — manual analysis required.",
        counterexampleExplained: f.counterexample ?? null,
        fix:                     "Apply checks-effects-interactions pattern and add input validation.",
      })),
      overallFuzzSeverity:  "high",
      newFindingsVsStatic:  `Interpreter error: ${e.message}`,
    };
  }
}

function guessVuln(name = "", reason = "") {
  const s = `${name} ${reason}`.toLowerCase();
  if (s.includes("reentran") || s.includes("drain"))       return "Reentrancy";
  if (s.includes("overflow") || s.includes("arithmetic"))  return "Integer Overflow";
  if (s.includes("owner")    || s.includes("access"))      return "Missing Access Control";
  if (s.includes("withdraw") || s.includes("balance"))     return "Fund Drainage";
  if (s.includes("zero")     || s.includes("address"))     return "Missing Zero-Address Check";
  return "Security Violation";
}

module.exports = { runFuzzInterpreterAgent };
