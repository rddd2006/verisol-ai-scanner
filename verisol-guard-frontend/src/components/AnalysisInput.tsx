import { useState, useEffect } from "react";
import type { Modules } from "@/hooks/useScan";
import { Loader2, Github, Zap } from "lucide-react";

type InputType = "address" | "github" | "code";

interface Contract {
  id: string;
  label: string;
  description: string;
  severity: "critical" | "high" | "none";
  tags?: string[];
  source?: string;
}

interface AnalysisInputProps {
  onAnalyze: (inputType: InputType, input: string, modules: Modules) => void;
  isLoading: boolean;
}

const TABS: { id: InputType; label: string; placeholder: string }[] = [
  { id: "address", label: "ADDRESS", placeholder: "0xD7d6215b4EF4b9B5f40baea48F41047Eb67a11D5" },
  { id: "github", label: "GITHUB", placeholder: "https://github.com/transmissions11/solmate" },
  { id: "code", label: "SOLIDITY", placeholder: "pragma solidity ^0.8.0;\n\ncontract MyContract {\n    // paste your code here\n}" },
];

const CONTRACT_EMOJI = {
  VulnerableBank: "🏦",
  InsecureToken: "🪙",
  HoneypotVault: "🍯",
  SafeVault: "🔒",
  FuzzCleanVault: "🧪",
  NaiveLendingPool: "💧",
};

const SEVERITY_COLORS = {
  critical: "border-red-400 bg-red-950/80 hover:bg-red-900/60 shadow-[5px_5px_0_0_rgba(248,113,113,0.55)]",
  high: "border-yellow-300 bg-yellow-950/80 hover:bg-yellow-900/60 shadow-[5px_5px_0_0_rgba(253,224,71,0.55)]",
  none: "border-emerald-300 bg-emerald-950/80 hover:bg-emerald-900/60 shadow-[5px_5px_0_0_rgba(110,231,183,0.55)]",
};

const SEVERITY_BADGE = {
  critical: "bg-red-950 text-red-100 border border-red-300 text-xs font-bold px-2 py-1 rounded",
  high: "bg-yellow-950 text-yellow-100 border border-yellow-300 text-xs font-bold px-2 py-1 rounded",
  none: "bg-emerald-950 text-emerald-100 border border-emerald-300 text-xs font-bold px-2 py-1 rounded",
};

const DEMO_CONTRACT_MODULES: Modules = {
  static: true,
  honeypot: true,
  genericFuzz: true,
  aiFuzz: true,
};

const GENERIC_FUZZ_DEMO_MODULES: Modules = {
  static: false,
  honeypot: false,
  genericFuzz: true,
  aiFuzz: false,
};

const AnalysisInput = ({ onAnalyze, isLoading: isScanning }: AnalysisInputProps) => {
  const [activeTab, setActiveTab] = useState<InputType>("address");
  const [input, setInput] = useState("");
  const [modules, setModules] = useState<Modules>({
    static: true,
    honeypot: true,
    genericFuzz: true,
    aiFuzz: true,
  });
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Fetch contracts from backend
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const response = await fetch("/api/contracts");
        const data = await response.json();
        setContracts(data.contracts || []);
      } catch {
        // Fallback: static list
        setContracts([
          {
            id: "VulnerableBank",
            label: "Vulnerable Bank",
            description: "Reentrancy + tx.origin + missing access control",
            severity: "critical",
          },
          {
            id: "InsecureToken",
            label: "Insecure Token",
            description: "Uncapped mint + no allowance check",
            severity: "high",
          },
          {
            id: "HoneypotVault",
            label: "Honeypot Vault",
            description: "selfdestruct trap + owner-only withdraw",
            severity: "critical",
          },
          {
            id: "SafeVault",
            label: "Safe Vault ✓",
            description: "Well-written vault — CEI + nonReentrant",
            severity: "none",
          },
          {
            id: "FuzzCleanVault",
            label: "Fuzz Clean Vault",
            description: "Minimal safe vault with clean fuzz pass surface",
            severity: "none",
          },
          {
            id: "NaiveLendingPool",
            label: "Naive Lending Pool",
            description: "Flash loan oracle manipulation + free flash loans",
            severity: "critical",
          },
        ]);
      }
    };
    fetchContracts();
  }, []);

  const loadContract = async (id: string) => {
    setLoadingId(id);
    try {
      const response = await fetch(`/api/contracts/${id}`);
      const data = await response.json();
      if (data.source) {
        setInput(data.source);
        setActiveTab("code");
        setActiveId(id);
        setModules(DEMO_CONTRACT_MODULES);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingId(null);
    }
  };

  const runGenericFuzzContract = async (id: string) => {
    setLoadingId(id);
    try {
      const response = await fetch(`/api/contracts/${id}`);
      const data = await response.json();
      if (data.source) {
        setInput(data.source);
        setActiveTab("code");
        setActiveId(id);
        setModules(GENERIC_FUZZ_DEMO_MODULES);
        onAnalyze("code", data.source, GENERIC_FUZZ_DEMO_MODULES);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingId(null);
    }
  };

  const handleSubmit = () => {
    if (!input.trim()) return;
    onAnalyze(activeTab, input.trim(), modules);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="brutal-box-static bg-background p-0">
        <div className="flex border-b-[3px] border-foreground">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setInput("");
              }}
              className={`flex-1 px-4 py-3 text-sm font-bold uppercase transition-colors border-r-[3px] border-foreground last:border-r-0 ${
                activeTab === tab.id
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-background text-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4">
          {activeTab === "code" ? (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={TABS.find((t) => t.id === activeTab)?.placeholder}
              className="w-full h-48 p-3 border-[3px] border-foreground bg-background font-mono text-sm resize-none focus:outline-none focus:bg-secondary/20"
            />
          ) : (
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={TABS.find((t) => t.id === activeTab)?.placeholder}
              className="w-full p-3 border-[3px] border-foreground bg-background font-mono text-sm focus:outline-none focus:bg-secondary/20"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          )}

          {/* Modules */}
          <div className="mt-4 border-t-[3px] border-foreground pt-4">
            <p className="text-xs font-bold uppercase mb-3">SECURITY MODULES:</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(modules).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer select-none hover:bg-muted p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setModules({ ...modules, [key]: e.target.checked })}
                    disabled={isScanning}
                    className="cursor-pointer"
                  />
                  <span className="text-sm font-bold uppercase">{key}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isScanning || !input.trim()}
            className="mt-4 w-full brutal-box bg-primary text-primary-foreground px-6 py-4 text-lg font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary hover:text-secondary-foreground active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            {isScanning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block animate-spin">⚙️</span> ANALYZING...
              </span>
            ) : (
              "ANALYZE NOW →"
            )}
          </button>

          {/* Demo Quick Load Buttons */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t-[3px] border-foreground pt-4">
            <button
              type="button"
              onClick={() => {
                setInput("0x1F98431c8aD98523631AE4a59f267346ea31F984");
                setActiveTab("address");
              }}
              disabled={isScanning}
              className="brutal-box-static border-[3px] border-foreground bg-background p-3 text-left hover:bg-secondary/20 disabled:opacity-50 disabled:cursor-not-allowed active:translate-x-1 active:translate-y-1"
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-yellow-400" />
                <span className="text-xs font-bold uppercase">Contract Address</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono truncate">
                0x1F98431c8aD...
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setInput("https://github.com/Uniswap/v2-core");
                setActiveTab("github");
              }}
              disabled={isScanning}
              className="brutal-box-static border-[3px] border-foreground bg-background p-3 text-left hover:bg-secondary/20 disabled:opacity-50 disabled:cursor-not-allowed active:translate-x-1 active:translate-y-1"
            >
              <div className="flex items-center gap-2 mb-1">
                <Github size={16} className="text-orange-400" />
                <span className="text-xs font-bold uppercase">GitHub Repo</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono truncate">
                Uniswap/v2-core
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Pre-built Example Contracts */}
      <div>
        <p className="text-xs font-bold uppercase mb-3 text-gray-300">
          📦 PRE-BUILT EXAMPLE CONTRACTS (loads with fuzzing enabled)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contracts.map((contract) => {
            const emoji = CONTRACT_EMOJI[contract.id as keyof typeof CONTRACT_EMOJI] || "📄";
            const colorClass = SEVERITY_COLORS[contract.severity];
            const isContractLoading = loadingId === contract.id;
            const isActive = activeId === contract.id;

            return (
              <div
                key={contract.id}
                className={`
                  relative text-left p-3.5 rounded-none border-[3px] transition-all duration-150 cursor-pointer
                  ${
                    isActive
                      ? "ring-2 ring-cyan-300 border-cyan-300 bg-cyan-950/40 shadow-[5px_5px_0_0_rgba(103,232,249,0.55)]"
                      : colorClass
                  }
                  disabled:opacity-60 disabled:cursor-wait hover:-translate-x-0.5 hover:-translate-y-0.5
                `}
              >
                <button
                  type="button"
                  onClick={() => loadContract(contract.id)}
                  disabled={isScanning || isContractLoading}
                  className="block w-full text-left disabled:cursor-wait"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 mb-1.5">
                  <span className="grid h-8 w-8 place-items-center border-[2px] border-current bg-background text-lg leading-none shadow-[2px_2px_0_0_currentColor]">{emoji}</span>
                  <span className="text-sm font-black uppercase text-white leading-snug flex-1">
                    {contract.label}
                  </span>
                  {isContractLoading && <Loader2 size={14} className="text-blue-400 animate-spin" />}
                  {isActive && !isContractLoading && (
                    <span className="text-xs text-blue-400 font-mono">loaded</span>
                  )}
                  </div>
                  {/* Description */}
                  <p className="text-xs text-gray-100 leading-snug mb-2">{contract.description}</p>
                  {/* Severity Badge */}
                  <div className="flex items-center gap-1.5">
                    <span className={`${SEVERITY_BADGE[contract.severity]} rounded-none uppercase`}>
                      {contract.severity === "none" ? "safe" : contract.severity}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => runGenericFuzzContract(contract.id)}
                  disabled={isScanning || isContractLoading}
                  className="mt-3 w-full rounded-none border-[2px] border-cyan-300 bg-background px-2 py-1.5 text-xs font-black uppercase text-cyan-200 shadow-[3px_3px_0_0_rgba(103,232,249,0.75)] hover:bg-cyan-950/50 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60 disabled:cursor-wait"
                >
                  Run Generic Fuzz
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalysisInput;
