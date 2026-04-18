import { useState, useEffect } from "react";
import {
  Code2, Hash, Github, Play, AlertCircle,
  ShieldAlert, Shield, Zap, Coins, FlaskConical, Loader2,
} from "lucide-react";
import ModuleSelector from "./ModuleSelector";

const API_BASE = import.meta.env.VITE_API_BASE || "";

// ── Example contract metadata ─────────────────────────────────────────────
// Mirrors contracts/index.js — used for icons / colours before API loads
const CONTRACT_META = {
  VulnerableBank:   { icon: ShieldAlert, color: "red",    emoji: "🏦" },
  InsecureToken:    { icon: Coins,       color: "orange", emoji: "🪙" },
  HoneypotVault:    { icon: ShieldAlert, color: "red",    emoji: "🍯" },
  SafeVault:        { icon: Shield,      color: "green",  emoji: "🔒" },
  FuzzCleanVault:   { icon: Zap,         color: "cyan",   emoji: "🧪" },
  NaiveLendingPool: { icon: FlaskConical,color: "purple", emoji: "💧" },
};

const COLOR = {
  red:    { card: "border-red-400 bg-red-950/80 hover:bg-red-900/60 shadow-[5px_5px_0_0_rgba(248,113,113,0.55)]", badge: "bg-red-950 text-red-100 border-red-300", icon: "text-red-200" },
  orange: { card: "border-yellow-300 bg-yellow-950/80 hover:bg-yellow-900/60 shadow-[5px_5px_0_0_rgba(253,224,71,0.55)]", badge: "bg-yellow-950 text-yellow-100 border-yellow-300", icon: "text-yellow-100" },
  green:  { card: "border-emerald-300 bg-emerald-950/80 hover:bg-emerald-900/60 shadow-[5px_5px_0_0_rgba(110,231,183,0.55)]", badge: "bg-emerald-950 text-emerald-100 border-emerald-300", icon: "text-emerald-100" },
  cyan:   { card: "border-cyan-200 bg-cyan-950/80 hover:bg-cyan-900/60 shadow-[5px_5px_0_0_rgba(165,243,252,0.60)]", badge: "bg-cyan-950 text-cyan-50 border-cyan-200", icon: "text-cyan-50" },
  purple: { card: "border-fuchsia-300 bg-fuchsia-950/80 hover:bg-fuchsia-900/60 shadow-[5px_5px_0_0_rgba(240,171,252,0.55)]", badge: "bg-fuchsia-950 text-fuchsia-100 border-fuchsia-300", icon: "text-fuchsia-100" },
};

const SEV_BADGE = {
  critical: "badge-critical",
  high:     "badge-high",
  none:     "badge-pass",
};

const TABS = [
  { id: "code",    icon: Code2,  label: "Paste Code"      },
  { id: "address", icon: Hash,   label: "Sepolia Address"  },
  { id: "github",  icon: Github, label: "GitHub Repo"      },
];

const DEMO_CONTRACT_MODULES = {
  static:      true,
  honeypot:    true,
  genericFuzz: true,
  aiFuzz:      true,
};

const GENERIC_FUZZ_DEMO_MODULES = {
  static:      false,
  honeypot:    false,
  genericFuzz: true,
  aiFuzz:      false,
};

export default function InputPanel({
  inputType, setInputType,
  value,     setValue,
  modules,   setModules,
  onScan,    error,
}) {
  const [etherscanKey, setEtherscanKey] = useState(localStorage.getItem("etherscan_key") || "");
  const [contracts,    setContracts]    = useState([]);
  const [loadingId,    setLoadingId]    = useState(null);   // which contract is loading
  const [activeId,     setActiveId]     = useState(null);   // which one is loaded

  // ── Fetch contract list from backend on mount ─────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/contracts`)
      .then((r) => r.json())
      .then((d) => setContracts(d.contracts || []))
      .catch(() => {
        // Fallback: static list so UI still shows buttons when backend is down
        setContracts([
          { id: "VulnerableBank",   label: "Vulnerable Bank",       description: "Reentrancy + tx.origin + missing access control", severity: "critical" },
          { id: "InsecureToken",    label: "Insecure Token",         description: "Uncapped mint + no allowance check",             severity: "high"     },
          { id: "HoneypotVault",    label: "Honeypot Vault",         description: "selfdestruct trap + owner-only withdraw",         severity: "critical" },
          { id: "SafeVault",        label: "Safe Vault ✓",           description: "Well-written vault — CEI + nonReentrant",         severity: "none"     },
          { id: "FuzzCleanVault",   label: "Fuzz Clean Vault",       description: "Minimal safe vault with clean fuzz pass surface",  severity: "none"     },
          { id: "NaiveLendingPool", label: "Naive Lending Pool",     description: "Flash loan oracle manipulation + free flash loans",severity: "critical" },
        ]);
      });
  }, []);

  // ── Load a pre-built contract from the backend ────────────────────────
  const loadContract = async (id) => {
    setLoadingId(id);
    try {
      const r    = await fetch(`${API_BASE}/api/contracts/${id}`);
      const data = await r.json();
      if (data.source) {
        setValue(data.source);
        setInputType("code");
        setActiveId(id);
        setModules(DEMO_CONTRACT_MODULES);
      }
    } catch {
      // Silently fall back to empty (error shown in scan phase)
    } finally {
      setLoadingId(null);
    }
  };

  const runGenericFuzzContract = async (id) => {
    setLoadingId(id);
    try {
      const r    = await fetch(`${API_BASE}/api/contracts/${id}`);
      const data = await r.json();
      if (data.source) {
        setValue(data.source);
        setInputType("code");
        setActiveId(id);
        setModules(GENERIC_FUZZ_DEMO_MODULES);
        onScan({ inputType: "code", value: data.source, modules: GENERIC_FUZZ_DEMO_MODULES });
      }
    } catch {
      // Silently fall back to empty (error shown in scan phase)
    } finally {
      setLoadingId(null);
    }
  };

  const saveEtherscanKey = (k) => {
    setEtherscanKey(k);
    localStorage.setItem("etherscan_key", k);
  };

  const canScan = value.trim().length > 0 && Object.values(modules).some(Boolean);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Scan a Smart Contract</h1>
        <p className="text-sm text-gray-400 mt-1">
          Paste Solidity code, enter a Sepolia address, point to a GitHub repo — or load a pre-built example below.
        </p>
      </div>

      {/* ── Example Contract Buttons ────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap size={12} className="text-yellow-400" />
          Pre-built Example Contracts
          <span className="text-gray-600 normal-case font-normal tracking-normal">(loads with generic + AI fuzz)</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contracts.map((c) => {
            const meta    = CONTRACT_META[c.id] || { icon: Code2, color: "orange", emoji: "📄" };
            const colors  = COLOR[meta.color]   || COLOR.orange;
            const isLoading = loadingId === c.id;
            const isActive  = activeId  === c.id;

            return (
              <div
                key={c.id}
                className={`
                  relative text-left p-3.5 rounded-none border-[3px] transition-all duration-150 cursor-pointer
                  ${isActive
                    ? "ring-2 ring-cyan-300 border-cyan-300 bg-cyan-950/40 shadow-[5px_5px_0_0_rgba(103,232,249,0.55)]"
                    : colors.card
                  }
                  disabled:opacity-60 disabled:cursor-wait hover:-translate-x-0.5 hover:-translate-y-0.5
                `}
              >
                <button
                  type="button"
                  onClick={() => loadContract(c.id)}
                  disabled={isLoading}
                  className="block w-full text-left disabled:cursor-wait"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="grid h-8 w-8 place-items-center border-2 border-current bg-gray-950 text-lg leading-none shadow-[2px_2px_0_0_currentColor]">{meta.emoji}</span>
                    <span className="text-sm font-black uppercase text-white leading-snug">{c.label}</span>
                    {isLoading && <Loader2 size={12} className="ml-auto text-blue-400 animate-spin" />}
                    {isActive  && !isLoading && (
                      <span className="ml-auto text-xs text-blue-400 font-mono">loaded</span>
                    )}
                  </div>
                  {/* Description */}
                  <p className="text-xs text-gray-100 leading-snug mb-2">{c.description}</p>
                  {/* Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {c.severity && c.severity !== "none" && (
                      <span className={`${SEV_BADGE[c.severity] || "badge-informational"} text-xs`}>
                        {c.severity}
                      </span>
                    )}
                    {c.severity === "none" && (
                      <span className="badge-pass text-xs">safe</span>
                    )}
                    {(c.tags || []).slice(0, 2).map((t) => (
                      <span key={t} className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-md border border-gray-700">
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => runGenericFuzzContract(c.id)}
                  disabled={isLoading}
                  className="mt-3 w-full rounded-none border-2 border-cyan-300 bg-gray-950 px-2 py-1.5 text-xs font-black uppercase text-cyan-200 shadow-[3px_3px_0_0_rgba(103,232,249,0.75)] hover:bg-cyan-950/50 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60 disabled:cursor-wait"
                >
                  Run Generic Fuzz
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Each bundled source example is Foundry-compatible and scans with generic + AI fuzz enabled.
        </p>
      </div>

      {/* ── Input type tabs ─────────────────────────────────────────── */}
      <div>
        <div className="flex gap-2 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit mb-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setInputType(tab.id)}
                className={inputType === tab.id ? "tab-active" : "tab-inactive"}>
                <Icon size={13} className="inline-block mr-1.5 -mt-0.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="card p-4 space-y-3">
          {inputType === "code" && (
            <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium">
                Solidity source code
                {activeId && (
                  <span className="ml-2 text-blue-400 font-mono">
                    ({contracts.find((c) => c.id === activeId)?.label})
                  </span>
                )}
              </label>
              <textarea
                className="input code-area min-h-[220px] font-mono text-xs"
                placeholder={"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract MyContract {\n    ...\n}"}
                value={value}
                onChange={(e) => { setValue(e.target.value); setActiveId(null); }}
                spellCheck={false}
              />
            </div>
          )}

          {inputType === "address" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium">Contract address (Sepolia)</label>
                <input className="input font-mono" placeholder="0xAbCd..." value={value}
                  onChange={(e) => setValue(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium">
                  Etherscan API Key{" "}
                  <span className="text-gray-600">(required to fetch source)</span>
                </label>
                <input className="input" placeholder="Your Etherscan key" type="password"
                  value={etherscanKey} onChange={(e) => saveEtherscanKey(e.target.value)} />
              </div>
            </div>
          )}

          {inputType === "github" && (
            <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium">GitHub repository URL</label>
              <input className="input font-mono" placeholder="https://github.com/user/repo"
                value={value} onChange={(e) => setValue(e.target.value)} />
              <p className="text-xs text-gray-600 mt-1.5">
                Backend will shallow-clone and concatenate all .sol files.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Module selector ──────────────────────────────────────────── */}
      <ModuleSelector modules={modules} setModules={setModules} />

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Scan button ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn-primary text-base px-6 py-2.5" onClick={onScan} disabled={!canScan}>
          <Play size={15} /> Run Security Scan
        </button>
        {activeId && (
          <p className="text-xs text-gray-500">
            Scanning <span className="text-blue-400 font-mono">{activeId}</span> —
            generic + AI fuzz are enabled for this contract
          </p>
        )}
      </div>
    </div>
  );
}
