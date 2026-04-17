import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, Wrench, MapPin } from "lucide-react";

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };

export function sortFindings(findings = []) {
  return [...findings].sort(
    (a, b) => (SEV_ORDER[a.severity] ?? 99) - (SEV_ORDER[b.severity] ?? 99)
  );
}

export function severityBadge(severity) {
  const s = (severity || "informational").toLowerCase();
  const map = {
    critical:      "badge-critical",
    high:          "badge-high",
    medium:        "badge-medium",
    low:           "badge-low",
    informational: "badge-informational",
  };
  return <span className={map[s] || "badge-informational"}>{s}</span>;
}

export default function FindingCard({ finding, index }) {
  const [open, setOpen] = useState(index === 0); // first finding expanded by default

  const sev = (finding.severity || "informational").toLowerCase();
  const leftBorder = {
    critical:      "border-l-red-500",
    high:          "border-l-orange-500",
    medium:        "border-l-yellow-500",
    low:           "border-l-blue-500",
    informational: "border-l-gray-600",
  }[sev] || "border-l-gray-600";

  return (
    <div className={`card border-l-4 ${leftBorder} overflow-hidden`}>
      {/* Header row */}
      <button
        className="accordion-header"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-code text-gray-600 shrink-0">{finding.id || `#${index + 1}`}</span>
          {severityBadge(finding.severity)}
          <span className="text-sm font-medium text-gray-100 truncate">{finding.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {finding.category && (
            <span className="hidden sm:block text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-md">
              {finding.category}
            </span>
          )}
          {open ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in-up">
          <hr className="border-gray-800" />

          {/* Description */}
          <p className="text-sm text-gray-300 leading-relaxed">{finding.description}</p>

          {/* Location */}
          {finding.location && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={14} className="text-gray-500 mt-0.5 shrink-0" />
              <span className="text-gray-400">
                <span className="text-gray-600">Location: </span>
                <code className="font-code text-yellow-400 text-xs">{finding.location}</code>
              </span>
            </div>
          )}

          {/* Code snippet */}
          {finding.codeSnippet && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Vulnerable code</p>
              <div className="code-block text-red-400">{finding.codeSnippet}</div>
            </div>
          )}

          {/* Impact */}
          {finding.impact && (
            <div className="flex items-start gap-2 p-3 bg-red-900/10 border border-red-900/30 rounded-lg">
              <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-400 mb-0.5">Impact</p>
                <p className="text-xs text-red-300/80">{finding.impact}</p>
              </div>
            </div>
          )}

          {/* Recommendation */}
          {finding.recommendation && (
            <div className="flex items-start gap-2 p-3 bg-green-900/10 border border-green-900/30 rounded-lg">
              <Wrench size={14} className="text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-green-400 mb-0.5">Recommendation</p>
                <p className="text-xs text-green-300/80">{finding.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
