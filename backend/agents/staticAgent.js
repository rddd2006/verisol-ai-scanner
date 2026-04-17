"use strict";

/**
 * StaticAnalysisAgent
 *
 * Responsibilities:
 *  - Full source-code vulnerability audit via Gemini
 *  - Returns structured findings, ABI, gas tips, and raw security score
 *
 * This agent intentionally uses a long, detailed prompt because quality of
 * static analysis is almost entirely prompt-quality dependent.
 */

const { generateJSON } = require("../utils/geminiClient");

const SYSTEM_PROMPT = `You are a senior smart-contract security auditor with 10+ years of experience
auditing DeFi protocols, token contracts, and on-chain infrastructure.

Audit the provided Solidity source code exhaustively. Check for ALL of the following vulnerability classes
(and any others you detect):

CRITICAL / HIGH
  ✓ Reentrancy (CEI violations, cross-function reentrancy, read-only reentrancy)
  ✓ Unchecked external call return values
  ✓ Integer overflow / underflow (unchecked blocks, pre-0.8 patterns)
  ✓ Access control (missing onlyOwner, tx.origin, msg.sender spoofing)
  ✓ Arbitrary external calls / delegatecall to untrusted addresses
  ✓ Flash-loan attack surfaces
  ✓ Price oracle manipulation
  ✓ Front-running / sandwich attacks on state changes
  ✓ Griefing / DoS with gas limit or block stuffing

MEDIUM
  ✓ Timestamp dependence (block.timestamp used for randomness or deadlines)
  ✓ Weak randomness (blockhash, block.difficulty)
  ✓ Missing zero-address validation
  ✓ Improper use of selfdestruct
  ✓ Uninitialized storage pointers
  ✓ Signature replay attacks (missing nonce or chainId)
  ✓ Centralization risk (single owner can rug-pull)
  ✓ Incorrect event emission

LOW / INFORMATIONAL
  ✓ Floating pragma
  ✓ Unused return values
  ✓ Unnecessary public state variables
  ✓ Missing NatSpec documentation
  ✓ Magic numbers (hardcoded values without constants)
  ✓ Shadowed variables
  ✓ Short-circuit optimization opportunities

Return ONLY a valid JSON object matching this exact schema (no markdown, no prose):

{
  "contractName": "<string>",
  "solidityVersion": "<string>",
  "linesOfCode": <integer>,
  "summary": "<2-3 sentence high-level assessment>",
  "rawScore": <integer 0-100>,
  "abi": [
    { "type": "function", "name": "<n>", "inputs": [{"type": "<t>", "name": "<n>"}], "stateMutability": "<sm>" }
  ],
  "findings": [
    {
      "id": "VSF-001",
      "title": "<concise vulnerability title>",
      "severity": "<critical|high|medium|low|informational>",
      "category": "<Reentrancy|Access Control|Arithmetic|Oracle|etc>",
      "description": "<clear 2-3 sentence description>",
      "impact": "<concrete attack scenario>",
      "location": "<function name or line reference>",
      "codeSnippet": "<the vulnerable code, max 120 chars>",
      "recommendation": "<specific Solidity fix>",
      "cweid": "<CWE-XXX if applicable, else null>"
    }
  ],
  "gasOptimizations": [
    {
      "title": "<title>",
      "description": "<what to change and expected gas saving>"
    }
  ],
  "overallRisk": "<critical|high|medium|low|informational>"
}`;

/**
 * Run full static analysis on Solidity source.
 * @param {string} sourceCode
 * @param {object} [context]  optional prior agent outputs to enrich analysis
 * @returns {Promise<StaticAnalysisResult>}
 */
async function runStaticAgent(sourceCode, context = {}) {
  const prompt = `${SYSTEM_PROMPT}

${context.priorSummary ? `PRIOR CONTEXT FROM ORCHESTRATOR:\n${context.priorSummary}\n` : ""}

SOLIDITY SOURCE CODE:
\`\`\`solidity
${sourceCode.substring(0, 9000)}
\`\`\``;

  let result;
  try {
    result = normalizeStaticResult(await generateJSON(prompt, { maxTokens: 3000 }), sourceCode);
  } catch (e) {
    result = normalizeStaticResult({
      summary: `Gemini static analysis unavailable: ${e.message}`,
      findings: heuristicFindings(sourceCode),
      gasOptimizations: [],
      abi: [],
    }, sourceCode);
  }

  // Assign sequential IDs if missing
  if (Array.isArray(result.findings)) {
    result.findings = result.findings.map((f, i) => ({
      ...f,
      id: f.id || `VSF-${String(i + 1).padStart(3, "0")}`,
    }));
  }

  return result;
}

function normalizeStaticResult(result, sourceCode) {
  const findings =
    result.findings ??
    result.vulnerabilities ??
    result.issues ??
    result.securityFindings;

  result.findings = Array.isArray(findings) ? findings : [];

  if (!result.contractName) result.contractName = extractContractName(sourceCode);
  if (!result.solidityVersion) result.solidityVersion = extractPragma(sourceCode);
  if (!result.linesOfCode) result.linesOfCode = sourceCode.split("\n").length;

  if (!result.findings.length) {
    result.findings = heuristicFindings(sourceCode);
  }

  if (typeof result.rawScore !== "number") {
    const critical = result.findings.filter((f) => f.severity === "critical").length;
    const high = result.findings.filter((f) => f.severity === "high").length;
    const medium = result.findings.filter((f) => f.severity === "medium").length;
    result.rawScore = Math.max(0, 100 - critical * 35 - high * 20 - medium * 10);
  }

  if (!result.overallRisk) {
    const severities = result.findings.map((f) => f.severity);
    result.overallRisk =
      severities.includes("critical") ? "critical" :
      severities.includes("high") ? "high" :
      severities.includes("medium") ? "medium" :
      result.findings.length ? "low" : "informational";
  }

  if (!Array.isArray(result.gasOptimizations)) result.gasOptimizations = [];
  if (!Array.isArray(result.abi)) result.abi = [];
  if (!result.summary) result.summary = "Static analysis completed with normalized local findings.";

  return result;
}

function heuristicFindings(sourceCode) {
  const cleaned = stripComments(sourceCode);
  const lc = cleaned.toLowerCase();
  const findings = [];

  if (lc.includes(".call{value") && !lc.includes("nonreentrant")) {
    findings.push({
      title: "Reentrancy in external value transfer",
      severity: "critical",
      category: "Reentrancy",
      description: "The contract performs an external value transfer without an obvious reentrancy guard.",
      impact: "A malicious receiver can re-enter before state is fully protected and drain funds.",
      location: "withdraw",
      codeSnippet: ".call{value: amount}",
      recommendation: "Use checks-effects-interactions and add a nonReentrant guard.",
      cweid: "CWE-841",
    });
  }

  if (lc.includes("tx.origin")) {
    findings.push({
      title: "tx.origin authentication",
      severity: "high",
      category: "Access Control",
      description: "The contract uses tx.origin for authorization.",
      impact: "A phishing contract can trick the owner into authorizing privileged actions.",
      location: "authorization check",
      codeSnippet: "tx.origin",
      recommendation: "Use msg.sender and explicit role checks instead.",
      cweid: "CWE-346",
    });
  }

  if (lc.includes("unchecked")) {
    findings.push({
      title: "Unchecked arithmetic",
      severity: "medium",
      category: "Arithmetic",
      description: "The contract contains unchecked arithmetic.",
      impact: "Arithmetic can overflow or underflow silently inside unchecked blocks.",
      location: "unchecked block",
      codeSnippet: "unchecked",
      recommendation: "Remove unchecked blocks unless the bounds are proven and documented.",
      cweid: "CWE-190",
    });
  }

  if (/\bfunction\s+setowner\s*\(/i.test(cleaned) && !/\bonlyowner\b/i.test(cleaned)) {
    findings.push({
      title: "Missing access control on owner update",
      severity: "high",
      category: "Access Control",
      description: "The owner update function appears callable without an owner-only modifier.",
      impact: "An attacker can take ownership and invoke privileged actions.",
      location: "setOwner",
      codeSnippet: "function setOwner",
      recommendation: "Restrict ownership transfer to the current owner.",
      cweid: "CWE-284",
    });
  }

  return findings;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function extractContractName(src) { return stripComments(src).match(/\bcontract\s+(\w+)/)?.[1] ?? "Unknown"; }
function extractPragma(src) { return stripComments(src).match(/pragma\s+solidity\s+([^;]+);/)?.[1]?.trim() ?? "unknown"; }

module.exports = { runStaticAgent };
