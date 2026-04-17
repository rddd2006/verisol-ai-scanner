import { useState } from "react";
import {
  RotateCcw, Brain, Bug, Zap, FlaskConical,
  ChevronDown, ChevronRight, Star, TrendingUp,
} from "lucide-react";
import FindingCard, { sortFindings } from "./FindingCard";
import HoneypotResults from "./HoneypotResults";
import { FuzzResults } from "./FuzzResults";
import RatingCard from "./RatingCard";

function Section({ title, icon: Icon, badge, badgeClass = "badge-informational", children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button className="accordion-header" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3">
          <Icon size={16} className="text-gray-400 shrink-0" />
          <span className="font-medium text-gray-100">{title}</span>
          {badge !== undefined && <span className={badgeClass}>{badge}</span>}
        </div>
        {open
          ? <ChevronDown  size={14} className="text-gray-500 shrink-0" />
          : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 animate-fade-in-up space-y-3">
          <hr className="border-gray-800" />
          {children}
        </div>
      )}
    </div>
  );
}

export default function ResultsPanel({ report, onReset }) {
  const sa         = report?.static      || {};
  const hp         = report?.honeypot    || {};
  const fuzz       = report?.genericFuzz || {};
  const aiFuzz     = report?.aiFuzz      || {};
  const rating     = report?.rating      || null;
  const strategy   = report?.fuzzStrategy || {};

  const findings   = sortFindings(sa.findings || []);
  const critCount  = findings.filter((f) => f.severity === "critical").length;
  const highCount  = findings.filter((f) => f.severity === "high").length;

  const fuzzFails  = (fuzz.tests   || []).filter((t) => t.status === "fail").length;
  const aiFails    = (aiFuzz.tests  || []).filter((t) => t.status === "fail").length;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            Security Report — {report?.contractName || "Contract"}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {report?.timestamp && new Date(report.timestamp).toLocaleString()} ·{" "}
            <span className="font-mono text-blue-400 text-xs">Gemini 1.5 Pro × 6 agents</span>
          </p>
        </div>
        <button className="btn-secondary" onClick={onReset}>
          <RotateCcw size={13} /> New scan
        </button>
      </div>

      {/* ── RATING — top of page, most prominent ─────────────────────── */}
      {rating && <RatingCard rating={rating} />}

      {/* ── Static AI Analysis ───────────────────────────────────────── */}
      {Object.keys(sa).length > 0 && (
        <Section
          title="Static AI Analysis"
          icon={Brain}
          badge={`${findings.length} finding${findings.length !== 1 ? "s" : ""}`}
          badgeClass={critCount > 0 ? "badge-critical" : highCount > 0 ? "badge-high" : "badge-pass"}
          defaultOpen={true}
        >
          {sa.summary && (
            <p className="text-sm text-gray-300 leading-relaxed mb-3">{sa.summary}</p>
          )}
          {findings.length === 0 ? (
            <p className="text-sm text-gray-500">No vulnerabilities detected.</p>
          ) : (
            <div className="space-y-3">
              {findings.map((f, i) => <FindingCard key={f.id || i} finding={f} index={i} />)}
            </div>
          )}
          {sa.gasOptimizations?.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={12} /> Gas Optimizations
              </p>
              {sa.gasOptimizations.map((g, i) => (
                <div key={i} className="p-3 bg-gray-800/50 rounded-lg text-xs">
                  <p className="font-semibold text-gray-200">{g.title}</p>
                  <p className="text-gray-400 mt-0.5">{g.description}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Honeypot Detection ───────────────────────────────────────── */}
      {Object.keys(hp).length > 0 && (
        <Section
          title="Honeypot Detection"
          icon={Bug}
          badge={hp.verdict}
          badgeClass={
            hp.verdict === "CONFIRMED_HONEYPOT" ? "badge-critical" :
            hp.verdict === "LIKELY_HONEYPOT"    ? "badge-high"     :
            hp.verdict === "SUSPICIOUS"          ? "badge-warn"     :
            "badge-pass"
          }
        >
          <HoneypotResults data={hp} />
          {/* Honeypot patterns from AI */}
          {hp.patterns?.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Detected Patterns</p>
              {hp.patterns.map((p, i) => (
                <div key={i} className="p-3 bg-gray-800/40 rounded-lg text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge badge-${p.severity}`}>{p.severity}</span>
                    <span className="font-semibold text-gray-200">{p.name}</span>
                  </div>
                  <p className="text-gray-400">{p.description}</p>
                  {p.codeEvidence && (
                    <code className="block mt-1.5 font-mono text-orange-400/80 bg-orange-900/10 px-2 py-1 rounded">
                      {p.codeEvidence}
                    </code>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Fuzz Strategy ────────────────────────────────────────────── */}
      {strategy?.invariants?.length > 0 && (
        <Section
          title="Fuzz Strategy Plan"
          icon={Star}
          badge={`${strategy.invariants.length} invariants · ${strategy.recommendedFuzzRuns} runs`}
          badgeClass="badge-informational"
        >
          <div className="space-y-2">
            {strategy.invariants.map((inv, i) => (
              <div key={i} className="flex items-start gap-3 text-xs p-2 bg-gray-800/40 rounded-lg">
                <span className={`badge badge-${inv.priority === "critical" ? "critical" : inv.priority === "high" ? "high" : "informational"} shrink-0`}>
                  {inv.priority}
                </span>
                <div>
                  <p className="font-semibold text-gray-200">{inv.name}</p>
                  <p className="text-gray-500 mt-0.5">{inv.description}</p>
                  <p className="text-blue-400/70 mt-0.5 font-mono">{inv.targetFunction}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Generic Fuzz Tests ───────────────────────────────────────── */}
      {Object.keys(fuzz).length > 0 && (
        <Section
          title="Generic Fuzz Tests"
          icon={Zap}
          badge={`${(fuzz.tests || []).length} tests · ${fuzzFails} fail`}
          badgeClass={fuzzFails > 0 ? "badge-fail" : "badge-pass"}
        >
          <FuzzResults data={fuzz} />
        </Section>
      )}

      {/* ── AI-Driven Fuzz Tests ─────────────────────────────────────── */}
      {Object.keys(aiFuzz).length > 0 && (
        <Section
          title="AI-Driven Fuzz Tests"
          icon={FlaskConical}
          badge={`${(aiFuzz.tests || []).length} tests · ${aiFails} fail`}
          badgeClass={aiFails > 0 ? "badge-fail" : "badge-pass"}
        >
          <FuzzResults data={aiFuzz} />
        </Section>
      )}

      {/* ── Errors ───────────────────────────────────────────────────── */}
      {report?.errors && Object.keys(report.errors).length > 0 && (
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Agent Errors</p>
          {Object.entries(report.errors).map(([k, v]) => (
            <p key={k} className="text-xs text-gray-400 font-mono">
              <span className="text-yellow-500">[{k}]</span> {v}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
