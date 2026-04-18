import { ShieldCheck, ShieldAlert, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

const GRADE_COLORS = {
  "A+": { text: "text-emerald-400", bg: "bg-emerald-900/30", border: "border-emerald-700/50" },
  "A":  { text: "text-emerald-400", bg: "bg-emerald-900/30", border: "border-emerald-700/50" },
  "A-": { text: "text-green-400",   bg: "bg-green-900/30",   border: "border-green-700/50"   },
  "B+": { text: "text-yellow-300",  bg: "bg-yellow-900/30",  border: "border-yellow-700/50"  },
  "B":  { text: "text-yellow-400",  bg: "bg-yellow-900/30",  border: "border-yellow-700/50"  },
  "B-": { text: "text-yellow-400",  bg: "bg-yellow-900/30",  border: "border-yellow-700/50"  },
  "C+": { text: "text-orange-300",  bg: "bg-orange-900/30",  border: "border-orange-700/50"  },
  "C":  { text: "text-orange-400",  bg: "bg-orange-900/30",  border: "border-orange-700/50"  },
  "C-": { text: "text-orange-400",  bg: "bg-orange-900/30",  border: "border-orange-700/50"  },
  "D":  { text: "text-red-300",     bg: "bg-red-900/30",     border: "border-red-700/50"     },
  "F":  { text: "text-red-400",     bg: "bg-red-900/30",     border: "border-red-700/50"     },
};

const TIER_BADGES = {
  "Safe":         "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  "Low Risk":     "bg-green-900/40   text-green-300   border-green-700/40",
  "Medium Risk":  "bg-yellow-900/40  text-yellow-300  border-yellow-700/40",
  "High Risk":    "bg-orange-900/40  text-orange-300  border-orange-700/40",
  "Critical":     "bg-red-900/40     text-red-300     border-red-700/40",
};

const REC_STYLES = {
  "Deploy Safely":            { icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-900/20",  border: "border-green-700/40"  },
  "Review Before Deploying":  { icon: AlertCircle,  color: "text-yellow-400", bg: "bg-yellow-900/20", border: "border-yellow-700/40" },
  "Do Not Deploy":            { icon: ShieldAlert,  color: "text-red-400",    bg: "bg-red-900/20",    border: "border-red-700/40"    },
};

function ScoreRing({ score }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  const strokeColor =
    score >= 80 ? "#34d399" :
    score >= 60 ? "#fbbf24" :
    score >= 40 ? "#f97316" : "#f87171";

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg viewBox="0 0 128 128" className="w-32 h-32 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={fill}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white tabular-nums">{score}</span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
    </div>
  );
}

function CategoryBar({ label, score }) {
  const color =
    score >= 80 ? "bg-emerald-500" :
    score >= 60 ? "bg-yellow-500"  :
    score >= 40 ? "bg-orange-500"  : "bg-red-500";

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400"}>
          {score}
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-1000`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export default function RatingCard({ rating }) {
  if (!rating) return null;

  const gradeStyle = GRADE_COLORS[rating.letterGrade] || GRADE_COLORS["F"];
  const tierStyle  = TIER_BADGES[rating.riskTier]     || TIER_BADGES["Critical"];
  const recMeta    = REC_STYLES[rating.recommendation] || REC_STYLES["Do Not Deploy"];
  const RecIcon    = recMeta.icon;

  const cats = rating.categoryScores || {};

  return (
    <div className="card overflow-hidden">
      {/* Top banner */}
      <div className="bg-gray-800/60 px-5 py-4 border-b border-gray-800 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Security Rating</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-4xl font-bold font-mono ${gradeStyle.text}`}>
              {rating.letterGrade}
            </span>
            <span className={`badge border ${tierStyle}`}>{rating.riskTier}</span>
          </div>
        </div>
        <ScoreRing score={rating.numericScore} />
      </div>

      <div className="p-5 space-y-5">
        {/* Recommendation */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${recMeta.bg} ${recMeta.border}`}>
          <RecIcon size={16} className={recMeta.color} />
          <div>
            <p className={`text-sm font-semibold ${recMeta.color}`}>{rating.recommendation}</p>
            {rating.auditConfidenceNote && (
              <p className="text-xs text-gray-500 mt-0.5">{rating.auditConfidenceNote}</p>
            )}
          </div>
          <span className="ml-auto text-xs text-gray-600">
            Confidence: {rating.auditConfidence ?? "?"}%
          </span>
        </div>

        {/* Executive summary */}
        {rating.executiveSummary && (
          <p className="text-sm text-gray-300 leading-relaxed border-l-4 border-l-blue-500/50 pl-3">
            {rating.executiveSummary}
          </p>
        )}

        {/* Category scores */}
        {Object.keys(cats).length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Category Breakdown</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(cats).map(([key, val]) => (
                <CategoryBar
                  key={key}
                  label={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                  score={val ?? 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* Top 3 risks + positives */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rating.topThreeRisks?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ShieldAlert size={11} /> Top Risks
              </p>
              <ul className="space-y-1">
                {rating.topThreeRisks.map((r, i) => (
                  <li key={i} className="text-xs text-red-300/80 flex items-start gap-1.5">
                    <span className="text-red-600 mt-0.5">✖</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rating.positives?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <TrendingUp size={11} /> Positives
              </p>
              <ul className="space-y-1">
                {rating.positives.map((p, i) => (
                  <li key={i} className="text-xs text-green-300/80 flex items-start gap-1.5">
                    <span className="text-green-600 mt-0.5">✔</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
