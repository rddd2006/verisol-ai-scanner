import type { AnalysisReport } from "@/hooks/useScan";
import { PixelCheck, PixelX, PixelWarning, PixelSkip, PixelQuestion, PixelSiren, PixelGear, PixelSearch } from "./BrutalIcon";

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
  passed?: number;
  failed?: number;
  tests?: Array<{ status: string; reason?: string }>;
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

const FuzzBox = ({ label, data }: { label: string; data?: FuzzResult | Record<string, unknown> }) => (
  <div className={`brutal-box-static p-3 border-[3px] ${getFuzzColorClass(data?.status as string)}`}>
    <div className="flex items-center justify-between mb-1">
      <span className="font-bold text-sm uppercase">{label}</span>
      <FuzzIcon status={data?.status as string} />
    </div>
    <div className="text-xs font-bold uppercase">{data?.status || "N/A"}</div>
    {data?.reason && <p className="text-xs mt-1 text-muted-foreground">{String(data.reason)}</p>}
  </div>
);

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
