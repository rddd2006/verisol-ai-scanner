import { CheckCircle2, XCircle, AlertTriangle, Bug } from "lucide-react";

const VERDICT_META = {
  SAFE:              { label: "Safe",              color: "text-green-400",  bg: "bg-green-900/20",  border: "border-green-700/40" },
  SUSPICIOUS:        { label: "Suspicious",        color: "text-yellow-400", bg: "bg-yellow-900/20", border: "border-yellow-700/40" },
  POTENTIAL_HONEYPOT:{ label: "Potential Honeypot",color: "text-red-400",    bg: "bg-red-900/20",    border: "border-red-700/40" },
  NOT_DEPLOYED:      { label: "Not Deployed",      color: "text-gray-400",   bg: "bg-gray-900/20",   border: "border-gray-700/40" },
};

export default function HoneypotResults({ data }) {
  if (!data) return null;

  const meta = VERDICT_META[data.verdict] || VERDICT_META.SUSPICIOUS;

  return (
    <div className="space-y-3">
      {/* Verdict banner */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${meta.bg} ${meta.border}`}>
        <Bug size={16} className={meta.color} />
        <div>
          <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
          {data.trapped && (
            <p className="text-xs text-red-300/70 mt-0.5">
              Contract appears to trap deposited funds — do NOT interact.
            </p>
          )}
        </div>
      </div>

      {/* Step-by-step results */}
      <div className="divide-y divide-gray-800 rounded-xl border border-gray-800 overflow-hidden">
        {(data.steps || []).map((step, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 bg-gray-900/50">
            {step.ok
              ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
              : <XCircle    size={14} className="text-red-500 shrink-0" />}
            <span className="text-sm text-gray-300 flex-1">{step.step}</span>
            <span className={`text-xs font-code ${step.ok ? "text-green-400" : "text-red-400"}`}>
              {step.result}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
