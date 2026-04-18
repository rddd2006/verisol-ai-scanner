import { useState } from "react";
import type { AnalysisReport } from "@/hooks/useScan";
import { PixelCheck, PixelX, PixelWarning, PixelSkip, PixelQuestion, PixelSiren, PixelGear, PixelSearch } from "./BrutalIcon";
import FileTree from "./FileTree";
import CodeDisplay from "./CodeDisplay";

interface AnalysisReport extends Record<string, unknown> {
  static?: Record<string, unknown>;
  staticAnalysis?: Record<string, unknown>;
  honeypot?: Record<string, unknown>;
  dynamicAnalysis?: Record<string, unknown>;
  genericFuzz?: Record<string, unknown>;
  genericFuzzing?: Record<string, unknown>;
  aiFuzz?: Record<string, unknown>;
  aiFuzzing?: Record<string, unknown>;
  ratingResult?: Record<string, unknown>;
  rating?: Record<string, unknown>;
  findings?: Finding[];
  // Metadata from source:resolved event
  contractName?: string;
  inputType?: "code" | "address" | "github";
  linesOfCode?: number;
  address?: string;
  files?: Array<{
    path: string;
    name?: string;
    content?: string;
    size: number;
    isMainContract?: boolean;
    contractNames?: string[];
  }>;
  fileCount?: number;
  totalSize?: number;
  sourceCode?: string;
}

interface AnalysisResultsProps {
  report: AnalysisReport | null;
}

interface Finding {
  title?: string;
  severity?: string;
  description?: string;
  message?: string;
  agent?: string;
  [key: string]: unknown;
}

interface FuzzResult {
  status?: string;
  reason?: string;
  passed?: boolean | number;
  failed?: number;
  forgeAvailable?: boolean;
  rawOutput?: string;
  compileError?: string;
  error?: string;
  tests?: Array<{ name?: string; status: string; reason?: string; counterexample?: string; gas?: number }>;
  [key: string]: unknown;
}

const getRiskClass = (score?: string) => {
  if (!score) return "risk-bg-unknown";
  const lower = String(score).toLowerCase();
  if (lower.includes("critical")) return "risk-bg-critical";
  if (lower.includes("high")) return "risk-bg-high";
  if (lower.includes("medium")) return "risk-bg-medium";
  if (lower.includes("low")) return "risk-bg-low";
  return "risk-bg-unknown";
};

const FuzzIcon = ({ status }: { status?: string }) => {
  switch (status) {
    case "PASS":
    case "passed":
      return <PixelCheck size={28} className="text-risk-low" />;
    case "FAIL":
    case "failed":
      return <PixelX size={28} className="text-risk-critical" />;
    case "SKIP":
    case "skipped":
      return <PixelSkip size={28} className="text-muted-foreground" />;
    default:
      return <PixelQuestion size={28} className="text-muted-foreground" />;
  }
};

const getFuzzColorClass = (status?: string) => {
  const lower = String(status).toLowerCase();
  if (lower.includes("pass")) return "border-risk-low";
  if (lower.includes("fail")) return "border-risk-critical";
  if (lower.includes("skip")) return "border-muted-foreground";
  return "border-risk-unknown";
};

const normalizeFuzzStatus = (data?: FuzzResult | Record<string, unknown>) => {
  if (!data || Object.keys(data).length === 0) return "N/A";
  if (typeof data.status === "string") return data.status;
  if (data.compileError || data.error) return "failed";
  if (typeof data.passed === "boolean") return data.passed ? "passed" : "failed";
  const tests = (data.tests || []) as Array<{ status: string }>;
  if (tests.some((test) => test.status === "fail")) return "failed";
  if (tests.length > 0) return "passed";
  return "N/A";
};

const FuzzBox = ({ label, data }: { label: string; data?: FuzzResult | Record<string, unknown> }) => {
  const [showLogs, setShowLogs] = useState(false);
  const typedData = (data || {}) as FuzzResult;
  const status = normalizeFuzzStatus(typedData);
  const tests = typedData.tests || [];
  const passCount = tests.filter((test) => test.status === "pass").length;
  const failCount = tests.filter((test) => test.status === "fail").length;
  const warnCount = tests.filter((test) => test.status === "warn").length;

  return (
    <div className={`brutal-box-static p-3 border-[3px] ${getFuzzColorClass(status)}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-sm uppercase">{label}</span>
        <FuzzIcon status={status} />
      </div>
      <div className="text-xs font-bold uppercase">{status}</div>
      {typedData.reason && <p className="text-xs mt-1 text-muted-foreground">{String(typedData.reason)}</p>}
      {typedData.error && <p className="text-xs mt-1 text-risk-critical">{typedData.error}</p>}
      {typedData.compileError && <pre className="text-xs mt-2 whitespace-pre-wrap text-risk-critical">{typedData.compileError}</pre>}

      {tests.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-bold uppercase text-muted-foreground">
            {tests.length} tests · {passCount} pass · {failCount} fail{warnCount ? ` · ${warnCount} warn` : ""}
          </div>
          <div className="space-y-1">
            {tests.map((test, index) => (
              <div key={`${test.name || "test"}-${index}`} className="border border-foreground/20 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono break-all">{test.name || `test_${index + 1}`}</span>
                  <span className="font-bold uppercase">{test.status}</span>
                </div>
                {test.reason && <p className="mt-1 text-risk-critical">{test.reason}</p>}
                {test.counterexample && (
                  <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">{test.counterexample}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {typedData.forgeAvailable === false && (
        <p className="text-xs mt-2 text-risk-high">
          forge was not available, so this result used the fallback path.
        </p>
      )}

      {typedData.rawOutput && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowLogs((open) => !open)}
            className="text-xs font-bold uppercase underline"
          >
            {showLogs ? "Hide" : "Show"} forge logs
          </button>
          {showLogs && (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap border border-foreground/20 bg-muted p-2 text-xs">
              {typedData.rawOutput}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

const FindingItem = ({ finding }: { finding: Finding }) => (
  <div className="brutal-box-static p-3 bg-muted">
    <div className="flex items-center gap-2 mb-1">
      {finding.severity && (
        <span className={`px-2 py-0.5 text-xs font-bold uppercase ${getRiskClass(finding.severity)}`}>
          {finding.severity}
        </span>
      )}
      <span className="font-bold text-sm">{finding.title || finding.message || "Finding"}</span>
    </div>
    {finding.description && <p className="text-xs mt-1">{finding.description}</p>}
  </div>
);

const AnalysisResults = ({ report }: AnalysisResultsProps) => {
  if (!report) {
    return (
      <div className="brutal-box-static bg-muted p-8 flex flex-col items-center justify-center min-h-[300px] brutal-rotate-1 text-foreground">
        <div className="mb-4"><PixelSearch size={80} /></div>
        <p className="text-lg font-bold uppercase">No Results Yet</p>
        <p className="text-sm text-muted-foreground mt-2">Enter a contract to analyze</p>
      </div>
    );
  }

  // Map backend response format to display format
  const staticAnalysis = report.static || report.staticAnalysis || {};
  const honeypotAnalysis = report.honeypot || report.dynamicAnalysis || {};
  const genericFuzzAnalysis = report.genericFuzz || report.genericFuzzing || {};
  const aiFuzzAnalysis = report.aiFuzz || report.aiFuzzing || {};
  const rating = report.ratingResult || report.rating;
  const findings = (report.findings as Finding[]) || (staticAnalysis.findings as Finding[]) || [];

  return (
    <div className="space-y-4">
      {/* File Tree for GitHub repos */}
      {report.inputType === "github" && report.files && report.fileCount && (
        <FileTree
          files={report.files}
          repoName={report.contractName || "Repository"}
          fileCount={report.fileCount}
          totalSize={report.totalSize || 0}
        />
      )}

      {/* Code Display for contract addresses */}
      {report.inputType === "address" && report.sourceCode && (
        <CodeDisplay
          code={report.sourceCode}
          contractName={report.contractName || "Contract"}
          address={report.address}
          linesOfCode={report.linesOfCode || 0}
        />
      )}

      {/* Honeypot Alert */}
      {honeypotAnalysis && (
        <div className={`brutal-box-static p-4 flex items-start gap-3 ${honeypotAnalysis.isHoneypot ? "bg-risk-critical text-primary-foreground" : "bg-risk-low text-primary-foreground"}`}>
          <div className="shrink-0">
            {honeypotAnalysis.isHoneypot
              ? <PixelSiren size={36} className="animate-brutal-shake" />
              : <PixelCheck size={36} />}
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold uppercase">
              {honeypotAnalysis.isHoneypot ? "🍯 HONEYPOT DETECTED" : "✓ NOT A HONEYPOT"}
            </div>
            {honeypotAnalysis.reason && (
              <p className="text-sm mt-1 opacity-90">{String(honeypotAnalysis.reason)}</p>
            )}
          </div>
        </div>
      )}

      {/* Static Analysis */}
      {(staticAnalysis || findings.length > 0) && (
        <div className="brutal-box-static p-4 bg-background">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold uppercase">Static Analysis</h3>
            {staticAnalysis?.riskScore && (
              <span className={`px-3 py-1 font-bold text-sm uppercase ${getRiskClass(staticAnalysis.riskScore as string)}`}>
                {staticAnalysis.riskScore}
              </span>
            )}
          </div>
          {staticAnalysis?.summary && (
            <p className="text-sm mb-3">{String(staticAnalysis.summary)}</p>
          )}
          {findings && findings.length > 0 && (
            <div className="space-y-2 mt-3">
              {findings.map((f, i) => (
                <FindingItem key={i} finding={f} />
              ))}
            </div>
          )}
          {findings.length === 0 && !staticAnalysis?.summary && (
            <p className="text-xs text-muted-foreground">No findings detected in static analysis.</p>
          )}
        </div>
      )}

      {/* Fuzzing Results */}
      <div className="grid grid-cols-2 gap-3">
        <FuzzBox label="Generic Fuzz" data={genericFuzzAnalysis} />
        <FuzzBox label="AI Fuzz" data={aiFuzzAnalysis} />
      </div>

      {/* Rating - if available */}
      {rating && (
        <div className="brutal-box-static p-4 bg-secondary text-secondary-foreground text-center">
          <p className="text-xs font-bold uppercase mb-1">OVERALL RATING</p>
          <p className="text-3xl font-bold">{formatRating(rating)} / 10</p>
        </div>
      )}
    </div>
  );
};

const formatRating = (rating: Record<string, unknown>) => {
  const score =
    typeof rating.overallRating === "number" ? rating.overallRating :
    typeof rating.numericScore === "number" ? rating.numericScore / 10 :
    undefined;

  return typeof score === "number" ? score.toFixed(1) : "N/A";
};

export default AnalysisResults;
export type { AnalysisReport };
