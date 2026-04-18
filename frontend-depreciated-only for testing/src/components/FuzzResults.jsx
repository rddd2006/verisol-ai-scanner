import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, Terminal } from "lucide-react";

function StatusIcon({ status }) {
  if (status === "pass")    return <CheckCircle2 size={14} className="text-green-500 shrink-0" />;
  if (status === "fail")    return <XCircle      size={14} className="text-red-500 shrink-0" />;
  if (status === "warn")    return <AlertTriangle size={14} className="text-yellow-500 shrink-0" />;
  return <div className="w-3.5 h-3.5 rounded-full border border-gray-600 shrink-0" />;
}

function statusBadgeClass(status) {
  return { pass: "badge-pass", fail: "badge-fail", warn: "badge-warn", pending: "badge-pending" }[status] || "badge-pending";
}

export function FuzzResults({ data, title, icon: Icon }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!data) return null;

  const tests = data.tests || [];
  const failCount = tests.filter((t) => t.status === "fail").length;
  const warnCount = tests.filter((t) => t.status === "warn").length;
  const passCount = tests.filter((t) => t.status === "pass").length;

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-400">{tests.length} tests</span>
        {passCount > 0 && <span className="text-green-400 font-code">{passCount} passed</span>}
        {warnCount > 0 && <span className="text-yellow-400 font-code">{warnCount} warnings</span>}
        {failCount > 0 && <span className="text-red-400 font-code">{failCount} failed</span>}
        {data.engine && (
          <span className="ml-auto text-xs text-gray-600">
            engine: <span className="font-code">{data.engine}</span>
          </span>
        )}
      </div>

      {/* Foundry unavailable notice */}
      {data.forgeAvailable === false && (
        <div className="flex items-start gap-2 p-3 bg-yellow-900/10 border border-yellow-700/30 rounded-lg text-xs text-yellow-300/80">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-yellow-500" />
          <span>
            Foundry (<code className="font-code">forge</code>) is not installed or not found in PATH.{" "}
            <a href="https://getfoundry.sh" target="_blank" rel="noopener noreferrer" className="underline">
              Install Foundry
            </a>{" "}
            to execute these tests.
          </span>
        </div>
      )}

      {/* Test list */}
      <div className="divide-y divide-gray-800 rounded-xl border border-gray-800 overflow-hidden">
        {tests.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-500">No tests generated.</div>
        )}
        {tests.map((t, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 bg-gray-900/50">
            <StatusIcon status={t.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="font-code text-xs text-blue-300">{t.name}()</code>
                <span className={statusBadgeClass(t.status)}>{t.status}</span>
              </div>
              {(t.description || t.detail) && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {t.description}{t.description && t.detail ? " — " : ""}{t.detail}
                </p>
              )}
              {t.reason && (
                <code className="block text-xs font-code text-red-400/80 mt-1.5 bg-red-900/10 px-2 py-1 rounded">
                  {t.reason}
                </code>
              )}
              {t.counterexample && (
                <code className="block text-xs font-code text-orange-400/80 mt-1.5 bg-orange-900/10 px-2 py-1 rounded whitespace-pre-wrap">
                  {JSON.stringify(t.counterexample, null, 2)}
                </code>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* AI interpretations */}
      {data.interpretations && data.interpretations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Failure Interpretations</p>
          {data.interpretations.map((interp, i) => (
            <div key={i} className="p-3 bg-purple-900/10 border border-purple-700/30 rounded-lg space-y-1.5">
              <div className="flex items-center gap-2">
                <code className="font-code text-xs text-purple-300">{interp.testName}</code>
                <span className="text-xs text-gray-500">→</span>
                <span className="text-xs font-semibold text-purple-300">{interp.vulnerability}</span>
              </div>
              <p className="text-xs text-gray-400">{interp.impact}</p>
              {interp.fix && (
                <p className="text-xs text-green-400/80">
                  <span className="font-semibold">Fix: </span>{interp.fix}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Generated test source (collapsible) */}
      {data.generatedTest && (
        <div>
          <button
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            onClick={() => setShowRaw((o) => !o)}
          >
            <Terminal size={12} />
            {showRaw ? "Hide" : "Show"} generated test file
            {showRaw ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          {showRaw && (
            <div className="code-block mt-2 text-gray-400 text-xs max-h-64 overflow-y-auto">
              {data.generatedTest}
            </div>
          )}
        </div>
      )}

      {/* Raw forge output (collapsible) */}
      {data.rawOutput && (
        <div>
          <button
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            onClick={() => setShowRaw((o) => !o)}
          >
            <Terminal size={12} />
            {showRaw ? "Hide" : "Show"} raw forge output
            {showRaw ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          {showRaw && (
            <div className="code-block mt-2 text-gray-400 text-xs max-h-48 overflow-y-auto">
              {data.rawOutput}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
