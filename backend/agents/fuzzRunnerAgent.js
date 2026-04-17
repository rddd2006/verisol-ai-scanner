"use strict";

/**
 * FuzzRunnerAgent
 *
 * Takes the FuzzStrategy from fuzzStrategyAgent and:
 *  1. Detects constructor arguments so deploy always succeeds
 *  2. Asks Gemini to generate a contract-specific Foundry test
 *  3. Runs it via forge test
 *  4. Returns raw results for the FuzzInterpreterAgent
 */

const { generate } = require("../utils/geminiClient");
const { runForgeTest } = require("../utils/foundryRunner");

// ─────────────────────────────────────────────────────────────────────────────
//  Constructor arg encoder (mirrors genericFuzz.js)
// ─────────────────────────────────────────────────────────────────────────────

function detectConstructorArgs(source) {
  const match = source.match(/constructor\s*\(([^)]*)\)/);
  if (!match || !match[1].trim()) return { encodedArgs: "", comment: "// No-arg constructor" };

  const types = match[1].trim().split(",").map((p) => p.trim().split(/\s+/)[0]);
  const defaults = types.map((t) => {
    if (t.startsWith("uint") || t.startsWith("int")) return "1000e18";
    if (t === "address") return "address(this)";
    if (t === "bool")    return "true";
    if (t === "string")  return '"TestToken"';
    return "0";
  });
  return {
    encodedArgs: `abi.encode(${defaults.join(", ")})`,
    comment: `// Constructor: ${types.join(", ")} → ${defaults.join(", ")}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(contractName, pragma, encodedArgs, constructorComment, signatures, strategy, sourceCode) {
  const deployLine = encodedArgs
    ? `bytes memory creation = abi.encodePacked(vm.getCode("Target.sol:${contractName}"), ${encodedArgs});`
    : `bytes memory creation = abi.encodePacked(vm.getCode("Target.sol:${contractName}"));`;

  const invariantList = (strategy?.invariants || [])
    .map((inv) => `  [${(inv.priority || "medium").toUpperCase()}] ${inv.name}: ${inv.description} | fn: ${inv.targetFunction} | bounds: ${inv.inputBounds}`)
    .join("\n");

  const scenarioList = (strategy?.attackScenarios || [])
    .map((s) => `  ${s.name}: ${s.steps.join(" → ")}`)
    .join("\n");

  return `You are a Foundry fuzz-test engineer. Generate a complete, compilable Solidity fuzz test.

ABSOLUTE RULES (violation = compile error):
1. pragma solidity ${pragma};
2. import "forge-std/Test.sol"; — this is the ONLY import allowed
3. Contract name: AIFuzzTest extends Test
4. setUp() MUST deploy the target exactly like this:
   ${constructorComment}
   ${deployLine}
   address d;
   assembly { d := create(0, add(creation, 0x20), mload(creation)) }
   require(d != address(0), "deploy failed");
   target = payable(d);
   vm.deal(target, 50 ether);
   vm.deal(address(this), 200 ether);
   vm.label(target, "${contractName}");
5. All fuzz functions MUST start with testFuzz_
6. Use ONLY low-level calls: target.call{value:X}(abi.encodeWithSignature("fn(type)", arg))
   Never import or instantiate the target contract type directly
7. Use vm.assume() to bound all fuzz inputs
8. Use vm.prank(addr) for access-control tests
9. Include receive() external payable {} and fallback() external payable {}
10. All variables must be declared — no undefined identifiers
11. state variable: address payable target; (not local)

DETECTED FUNCTIONS:
${(signatures || []).map((s) => `  - ${s}`).join("\n") || "  - deposit(), withdraw(uint256), owner()"}

STRATEGY INVARIANTS:
${invariantList || "  Use standard bank/vault/token invariants"}

ATTACK SCENARIOS:
${scenarioList || "  Test reentrancy, over-withdrawal, access control bypass"}

Generate 5-8 tests targeting the SPECIFIC functions above.
Focus on: reentrancy, oracle manipulation, overflow, access control bypass, fund drainage.

CONTRACT SOURCE:
\`\`\`solidity
${sourceCode.substring(0, 5000)}
\`\`\`

Return ONLY raw Solidity. No markdown fences, no explanation.`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────

async function runFuzzRunnerAgent(sourceCode, strategy) {
  const contractName = extractContractName(sourceCode) || "Target";
  const pragma       = extractPragma(sourceCode)       || "^0.8.0";
  const fuzzRuns     = strategy?.recommendedFuzzRuns   || 512;
  const signatures   = strategy?.highRiskFunctions     || extractFunctionSigs(sourceCode);

  const { encodedArgs, comment: constructorComment } = detectConstructorArgs(sourceCode);

  // ── 1. Generate test via Gemini ────────────────────────────────────────
  let generatedTest;
  try {
    const raw = await generate(
      buildPrompt(contractName, pragma, encodedArgs, constructorComment, signatures, strategy, sourceCode),
      { maxTokens: 3000 }
    );
    generatedTest = raw
      .replace(/^```(?:solidity|sol)?\s*/im, "")
      .replace(/```\s*$/m, "")
      .trim();
  } catch (e) {
    return { forgeAvailable: true, error: `Generation failed: ${e.message}`, tests: [], generatedTest: null };
  }

  // ── 2. Run with Foundry ────────────────────────────────────────────────
  let forgeResult;
  try {
    forgeResult = await runForgeTest(sourceCode, generatedTest, { fuzzRuns, timeout: 90_000 });
  } catch (e) {
    const notInstalled = /ENOENT|not found|not installed/i.test(e.message);
    return {
      forgeAvailable: !notInstalled,
      error:          e.message,
      generatedTest,
      tests:          [],
      rawOutput:      e.message,
    };
  }

  // ── 3. Repair loop on compile error ───────────────────────────────────
  if (forgeResult.compileError) {
    const fixed = await repairTest(generatedTest, forgeResult.compileError, contractName, pragma, encodedArgs);
    if (fixed) {
      generatedTest = fixed;
      try {
        forgeResult = await runForgeTest(sourceCode, fixed, {
          fuzzRuns: Math.min(fuzzRuns, 256),
          timeout:  60_000,
        });
      } catch { /* use previous forgeResult */ }
    }
  }

  return {
    forgeAvailable: true,
    passed:         forgeResult.passed,
    compileError:   forgeResult.compileError ?? null,
    rawOutput:      forgeResult.rawOutput?.substring(0, 5000) ?? "",
    tests:          forgeResult.parsedTests ?? [],
    generatedTest,
    fuzzRuns,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Repair loop
// ─────────────────────────────────────────────────────────────────────────────

async function repairTest(broken, compileError, contractName, pragma, encodedArgs) {
  try {
    const deployLine = encodedArgs
      ? `bytes memory creation = abi.encodePacked(vm.getCode("Target.sol:${contractName}"), ${encodedArgs});`
      : `bytes memory creation = abi.encodePacked(vm.getCode("Target.sol:${contractName}"));`;

    const raw = await generate(`
Fix this Solidity Foundry test. It has a compile error.

COMPILE ERROR:
${compileError.substring(0, 800)}

CONSTRAINTS:
- pragma solidity ${pragma}
- import "forge-std/Test.sol" ONLY
- Deploy with: ${deployLine}
  then assembly { d := create(0, add(creation, 0x20), mload(creation)) }
- All fuzz functions start with testFuzz_
- No direct import of the target contract type
- Declare all variables before use

Return ONLY raw Solidity. No markdown.

BROKEN TEST:
${broken.substring(0, 4000)}`, { fast: false, maxTokens: 3000 });

    return raw
      .replace(/^```(?:solidity|sol)?\s*/im, "")
      .replace(/```\s*$/m, "")
      .trim();
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function extractContractName(src) { return stripComments(src).match(/\bcontract\s+(\w+)/)?.[1] ?? null; }
function extractPragma(src)       { return stripComments(src).match(/pragma\s+solidity\s+([^;]+);/)?.[1]?.trim() ?? "^0.8.0"; }

function extractFunctionSigs(src) {
  const re = /function\s+(\w+)\s*\(([^)]*)\)\s*(?:public|external)/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const params = m[2].trim().split(",").map((p) => p.trim().split(/\s+/)[0]).filter(Boolean).join(",");
    out.push(`${m[1]}(${params})`);
  }
  return out.length ? out : ["deposit()", "withdraw(uint256)", "owner()"];
}

module.exports = { runFuzzRunnerAgent };
