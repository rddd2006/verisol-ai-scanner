"use strict";

/**
 * RatingAgent
 *
 * Consumes the outputs of ALL prior agents and produces:
 *  - Numeric score  0-100
 *  - Letter grade   A+ / A / B / C / D / F
 *  - Category scores (Access Control, Arithmetic, Logic, Reentrancy, etc.)
 *  - Risk tier      (Safe / Low Risk / Medium Risk / High Risk / Critical)
 *  - OWASP-mapped category breakdown
 *  - Executive summary  (1 paragraph, plain English)
 *  - Recommended action  (deploy / review / do not deploy)
 *
 * Uses Gemini for the final synthesis so the narrative is coherent.
 */

const { generateJSON } = require("../utils/geminiClient");

// Weights used for raw numeric score calculation (before Gemini refinement)
const SEV_WEIGHT = { critical: 25, high: 12, medium: 5, low: 2, informational: 0.5 };
const MAX_DEDUCT = 100;

const RATING_PROMPT = `You are a chief security officer reviewing a smart-contract audit.

You have received outputs from multiple specialised security agents. Synthesise
all findings into a final comprehensive security rating.

Return ONLY valid JSON matching this schema exactly:

{
  "numericScore": <integer 0-100>,
  "letterGrade":  "<A+|A|A-|B+|B|B-|C+|C|C-|D|F>",
  "riskTier":     "<Safe|Low Risk|Medium Risk|High Risk|Critical>",
  "recommendation": "<Deploy Safely|Review Before Deploying|Do Not Deploy>",
  "categoryScores": {
    "accessControl":  <integer 0-100>,
    "arithmetic":     <integer 0-100>,
    "reentrancy":     <integer 0-100>,
    "inputValidation":<integer 0-100>,
    "logic":          <integer 0-100>,
    "upgradeability": <integer 0-100>,
    "codeQuality":    <integer 0-100>
  },
  "executiveSummary": "<3-5 sentence plain-English summary of the contract's security posture>",
  "topThreeRisks": [
    "<risk 1>",
    "<risk 2>",
    "<risk 3>"
  ],
  "positives": [
    "<thing the contract does well>"
  ],
  "auditConfidence": <integer 0-100>,
  "auditConfidenceNote": "<why confidence is high or low — e.g. partial source, proxy pattern, etc.>"
}`;

/**
 * Compute the final rating from all agent outputs.
 *
 * @param {{
 *   static:      object,
 *   honeypot:    object,
 *   fuzzStrategy:object,
 *   fuzzRunner:  object,
 *   fuzzInterp:  object
 * }} agentOutputs
 * @param {string} sourceCode
 * @returns {Promise<Rating>}
 */
async function runRatingAgent(agentOutputs, sourceCode) {
  const { static: sa, honeypot: hp, fuzzRunner: fr, fuzzInterp: fi } = agentOutputs;

  // ── Pre-compute numeric score as a floor/anchor ────────────────────────
  const preScore = computePreScore(sa, hp, fr, fi);

  // ── Build rich context for Gemini ────────────────────────────────────
  const context = buildContext(agentOutputs, preScore);

  const prompt = `${RATING_PROMPT}

PRE-COMPUTED NUMERIC ANCHOR (use as reference, adjust ±10 based on your analysis):
  Raw score: ${preScore}

AGENT OUTPUTS SUMMARY:
${context}

CONTRACT SOURCE (excerpt):
\`\`\`solidity
${sourceCode.substring(0, 2000)}
\`\`\``;

  try {
    return normalizeRating(await generateJSON(prompt, { maxTokens: 1500 }), preScore, sa, hp, fr);
  } catch (e) {
    // Full fallback — compute everything locally
    return localRating(preScore, sa, hp, fr);
  }
}

function normalizeRating(result, preScore, sa, hp, fr) {
  const fallback = localRating(preScore, sa, hp, fr);
  const numeric =
    typeof result.numericScore === "number" ? result.numericScore :
    typeof result.score === "number" ? result.score :
    preScore;
  const score = Math.max(0, Math.min(100, Math.round(numeric)));

  return {
    ...fallback,
    ...result,
    numericScore: score,
    letterGrade: result.letterGrade || result.grade || scoreToGrade(score),
    riskTier: result.riskTier || result.riskLevel || scoreToTier(score),
    recommendation: result.recommendation || fallback.recommendation,
    categoryScores: result.categoryScores && typeof result.categoryScores === "object"
      ? { ...fallback.categoryScores, ...result.categoryScores }
      : fallback.categoryScores,
    executiveSummary: result.executiveSummary || result.summary || fallback.executiveSummary,
    topThreeRisks: Array.isArray(result.topThreeRisks) && result.topThreeRisks.length
      ? result.topThreeRisks
      : Array.isArray(result.risks) && result.risks.length
        ? result.risks.slice(0, 3)
        : fallback.topThreeRisks,
    positives: Array.isArray(result.positives) ? result.positives : fallback.positives,
    auditConfidence: typeof result.auditConfidence === "number" ? result.auditConfidence : fallback.auditConfidence,
    auditConfidenceNote: result.auditConfidenceNote || fallback.auditConfidenceNote,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-score computation (deterministic, used as Gemini anchor)
// ─────────────────────────────────────────────────────────────────────────────

function computePreScore(sa, hp, fr, fi) {
  let score = 100;

  // Deduct for static findings
  for (const f of (sa?.findings || [])) {
    const w = SEV_WEIGHT[f.severity] ?? 0;
    score -= w;
  }

  // Honeypot penalty
  if (hp?.verdict === "CONFIRMED_HONEYPOT") score -= 60;
  else if (hp?.verdict === "LIKELY_HONEYPOT") score -= 40;
  else if (hp?.verdict === "SUSPICIOUS")     score -= 15;
  if (hp?.bytecodeFlags?.hasSelfDestruct)    score -= 20;

  // Fuzz failure penalty
  const fuzzFails = (fr?.tests || []).filter((t) => t.status === "fail").length;
  score -= fuzzFails * 8;

  // Interpreter severity penalty
  const interpSev = fi?.overallFuzzSeverity;
  if (interpSev === "critical")  score -= 20;
  else if (interpSev === "high") score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildContext(out, preScore) {
  const sa = out.static  || {};
  const hp = out.honeypot || {};
  const fr = out.fuzzRunner || {};
  const fi = out.fuzzInterp || {};
  const fs = out.fuzzStrategy || {};

  const findings = (sa.findings || []);
  const counts   = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;

  const fuzzPassed = (fr.tests || []).filter((t) => t.status === "pass").length;
  const fuzzFailed = (fr.tests || []).filter((t) => t.status === "fail").length;

  return `
STATIC ANALYSIS:
  Contract: ${sa.contractName || "unknown"}   Solidity: ${sa.solidityVersion || "?"}
  Findings: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low
  Static raw score: ${sa.rawScore ?? "?"}/100
  Summary: ${sa.summary || "N/A"}
  Top findings: ${findings.slice(0, 3).map((f) => `[${f.severity}] ${f.title}`).join("; ") || "none"}

HONEYPOT DETECTION:
  Verdict: ${hp.verdict || "UNKNOWN"}
  Rug-pull risk: ${hp.rugPullRisk || "unknown"}
  Bytecode SELFDESTRUCT: ${hp.bytecodeFlags?.hasSelfDestruct ?? "N/A"}
  AI confidence: ${hp.confidence ?? "?"}%
  Patterns: ${(hp.patterns || []).map((p) => p.name).join(", ") || "none"}

FUZZ STRATEGY:
  Contract type: ${fs.contractType || "unknown"}
  High-risk functions: ${(fs.highRiskFunctions || []).join(", ") || "N/A"}
  Recommended runs: ${fs.recommendedFuzzRuns || "?"}

FUZZ EXECUTION (${fr.fuzzRuns || "?"} runs):
  Passed: ${fuzzPassed}  Failed: ${fuzzFailed}  Forge available: ${fr.forgeAvailable ?? "?"}
  Overall fuzz severity: ${fi.overallFuzzSeverity || "none"}
  New vs static: ${fi.newFindingsVsStatic || "N/A"}

PRE-COMPUTED SCORE: ${preScore}/100`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Local fallback rating (no Gemini)
// ─────────────────────────────────────────────────────────────────────────────

function localRating(score, sa, hp, fr) {
  const counts = {};
  for (const f of (sa?.findings || []))
    counts[f.severity] = (counts[f.severity] || 0) + 1;

  const top3 = (sa?.findings || [])
    .filter((f) => ["critical", "high"].includes(f.severity))
    .slice(0, 3)
    .map((f) => `${f.title} (${f.severity})`);

  return {
    numericScore: score,
    letterGrade:  scoreToGrade(score),
    riskTier:     scoreToTier(score),
    recommendation: score >= 75 ? "Review Before Deploying" : "Do Not Deploy",
    categoryScores: {
      accessControl:   computeCategoryScore(sa, "Access Control"),
      arithmetic:      computeCategoryScore(sa, "Arithmetic"),
      reentrancy:      computeCategoryScore(sa, "Reentrancy"),
      inputValidation: computeCategoryScore(sa, "Input Validation"),
      logic:           computeCategoryScore(sa, "Logic"),
      upgradeability:  100,
      codeQuality:     score,
    },
    executiveSummary:
      `Contract scored ${score}/100. ` +
      `Found ${counts.critical || 0} critical and ${counts.high || 0} high severity issues. ` +
      `${hp?.verdict !== "SAFE" ? "Honeypot detection raised concerns. " : ""}` +
      `${(fr?.tests || []).filter((t) => t.status === "fail").length} fuzz invariants failed.`,
    topThreeRisks:        top3.length ? top3 : ["Manual review required"],
    positives:            score > 60 ? ["No critical bytecode traps detected"] : [],
    auditConfidence:      70,
    auditConfidenceNote:  "Confidence reduced due to Gemini rating unavailable.",
  };
}

function computeCategoryScore(sa, category) {
  const relevant = (sa?.findings || []).filter(
    (f) => f.category?.toLowerCase().includes(category.toLowerCase())
  );
  let deduct = 0;
  for (const f of relevant) deduct += SEV_WEIGHT[f.severity] ?? 0;
  return Math.max(0, 100 - deduct * 2);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Grade / tier helpers
// ─────────────────────────────────────────────────────────────────────────────

function scoreToGrade(score) {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 60) return "D";
  return "F";
}

function scoreToTier(score) {
  if (score >= 90) return "Safe";
  if (score >= 75) return "Low Risk";
  if (score >= 55) return "Medium Risk";
  if (score >= 35) return "High Risk";
  return "Critical";
}

module.exports = { runRatingAgent };
