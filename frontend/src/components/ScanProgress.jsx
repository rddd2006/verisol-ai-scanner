import { Brain, Bug, Zap, FlaskConical, Cpu, Star, BookOpen, Filter,
         CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { AGENT_META } from "../hooks/useScan";

const AGENT_ORDER = [
  "orchestrator", "static", "honeypot",
  "fuzzStrategy", "genericFuzz", "aiFuzz",
  "fuzzInterp",   "rating",
];

const AGENT_ICONS = {
  orchestrator: Cpu,
  static:       Brain,
  honeypot:     Bug,
  fuzzStrategy: Filter,
  genericFuzz:  Zap,
  aiFuzz:       FlaskConical,
  fuzzInterp:   BookOpen,
  rating:       Star,
};

const COLOR_CLASSES = {
  blue:   { icon: "text-blue-400",   ring: "ring-blue-500/30",   bg: "bg-blue-500/10"   },
  purple: { icon: "text-purple-400", ring: "ring-purple-500/30", bg: "bg-purple-500/10" },
  orange: { icon: "text-orange-400", ring: "ring-orange-500/30", bg: "bg-orange-500/10" },
  yellow: { icon: "text-yellow-400", ring: "ring-yellow-500/30", bg: "bg-yellow-500/10" },
  green:  { icon: "text-green-400",  ring: "ring-green-500/30",  bg: "bg-green-500/10"  },
  pink:   { icon: "text-pink-400",   ring: "ring-pink-500/30",   bg: "bg-pink-500/10"   },
  teal:   { icon: "text-teal-400",   ring: "ring-teal-500/30",   bg: "bg-teal-500/10"   },
};

function AgentCard({ id, state, data }) {
  const meta  = AGENT_META[id]  || { label: id, color: "blue" };
  const color = COLOR_CLASSES[meta.color] || COLOR_CLASSES.blue;
  const Icon  = AGENT_ICONS[id] || Cpu;

  const isRunning = state === "running";
  const isDone    = state === "done";
  const isError   = state === "error";
  const isIdle    = !state || state === "idle";

  return (
    <div className={`
      card p-4 flex items-start gap-3 transition-all duration-300
      ${isRunning ? `ring-1 ${color.ring}` : ""}
      ${isDone    ? "opacity-100" : ""}
      ${isIdle    ? "opacity-40" : ""}
    `}>
      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
        ${isDone || isRunning ? color.bg : "bg-gray-800"}`}>
        {isRunning
          ? <Loader2 size={15} className={`${color.icon} animate-spin`} />
          : isDone
          ? <CheckCircle2 size={15} className="text-green-400" />
          : isError
          ? <XCircle size={15} className="text-red-400" />
          : <Icon size={15} className="text-gray-600" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isIdle ? "text-gray-500" : "text-gray-100"}`}>
            {meta.label}
          </span>
          {isRunning && (
            <span className={`text-xs ${color.icon} animate-pulse`}>running</span>
          )}
          {isDone && (
            <span className="text-xs text-green-500">done</span>
          )}
          {isError && (
            <span className="text-xs text-red-400">error</span>
          )}
        </div>

        {/* Live data snippets as agents complete */}
        {isDone && data && <AgentSnippet id={id} data={data} />}
      </div>
    </div>
  );
}

function AgentSnippet({ id, data }) {
  if (id === "static" && data?.findings) {
    const crit = data.findings.filter((f) => f.severity === "critical").length;
    const high = data.findings.filter((f) => f.severity === "high").length;
    return (
      <p className="text-xs text-gray-500 mt-1">
        {data.findings.length} findings — {crit > 0 ? <span className="text-red-400">{crit} critical</span> : null}
        {crit > 0 && high > 0 ? ", " : ""}
        {high > 0 ? <span className="text-orange-400">{high} high</span> : null}
      </p>
    );
  }
  if (id === "honeypot" && data?.verdict) {
    const c = data.verdict === "SAFE" ? "text-green-400" : "text-red-400";
    return <p className={`text-xs mt-1 ${c}`}>{data.verdict}</p>;
  }
  if (id === "fuzzStrategy" && data?.contractType) {
    return <p className="text-xs text-gray-500 mt-1">type: {data.contractType} · {data.invariants?.length ?? 0} invariants planned</p>;
  }
  if ((id === "genericFuzz" || id === "aiFuzz") && data?.tests) {
    const fail = data.tests.filter((t) => t.status === "fail").length;
    const pass = data.tests.filter((t) => t.status === "pass").length;
    return (
      <p className="text-xs mt-1">
        <span className="text-green-400">{pass} pass</span>
        {fail > 0 ? <span className="text-red-400"> · {fail} fail</span> : null}
      </p>
    );
  }
  if (id === "rating" && data?.letterGrade) {
    const gradeColor = ["A+", "A", "A-"].includes(data.letterGrade)
      ? "text-green-400"
      : ["B+", "B", "B-"].includes(data.letterGrade)
      ? "text-yellow-400"
      : "text-red-400";
    return (
      <p className={`text-xs mt-1 font-mono font-bold ${gradeColor}`}>
        {data.letterGrade} · {data.numericScore}/100 · {data.riskTier}
      </p>
    );
  }
  return null;
}

export default function ScanProgress({ agentStates, agentData, log }) {
  const [elapsed, setElapsed] = useState(0);

  // Tick elapsed time
  useState(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  });

  const runningCount = Object.values(agentStates).filter((s) => s === "running").length;
  const doneCount    = Object.values(agentStates).filter((s) => s === "done").length;
  const total        = AGENT_ORDER.length;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <div className="w-10 h-10 rounded-full border-2 border-gray-800" />
              <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Cpu size={16} className="text-blue-400" />
              </div>
            </div>
            <div>
              <p className="text-white font-semibold">Multi-Agent Pipeline</p>
              <p className="text-xs text-gray-400">{runningCount > 0 ? `${runningCount} agent${runningCount > 1 ? "s" : ""} running in parallel` : "Agents standing by"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono text-gray-500">{elapsed}s</p>
            <p className="text-xs text-gray-600">{doneCount}/{total} done</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-700"
            style={{ width: `${Math.round((doneCount / total) * 100)}%` }}
          />
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {AGENT_ORDER.map((id) => (
          <AgentCard
            key={id}
            id={id}
            state={agentStates[id]}
            data={agentData[id]}
          />
        ))}
      </div>

      {/* Live log */}
      {log.length > 0 && (
        <div className="card p-3 max-h-36 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Live log</p>
          {[...log].reverse().slice(0, 20).map((entry, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="text-xs font-mono text-gray-700 shrink-0">
                {new Date(entry.ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className={`text-xs font-mono ${
                entry.type === "error"    ? "text-red-400"    :
                entry.type === "done"     ? "text-green-400"  :
                entry.type === "start"    ? "text-blue-400"   :
                entry.type === "complete" ? "text-purple-400" :
                "text-gray-500"
              }`}>
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-gray-600">
        AI analysis: 15–40s · Foundry fuzzing may add 30–90s
      </p>
    </div>
  );
}

// useState import needed for tick
import { useState } from "react";
