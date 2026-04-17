import { useState, useEffect } from "react";
import type { Modules } from "@/hooks/useScan";
import { Loader2 } from "lucide-react";

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
  NaiveLendingPool: "💧",
};

const SEVERITY_COLORS = {
  critical: "border-red-700/40 bg-red-900/10 hover:bg-red-900/20",
  high: "border-orange-700/40 bg-orange-900/10 hover:bg-orange-900/20",
  none: "border-green-700/40 bg-green-900/10 hover:bg-green-900/20",
};

const SEVERITY_BADGE = {
  critical: "bg-red-900/40 text-red-300 border border-red-700/40 text-xs font-bold px-2 py-1 rounded",
  high: "bg-orange-900/40 text-orange-300 border border-orange-700/40 text-xs font-bold px-2 py-1 rounded",
  none: "bg-green-900/40 text-green-300 border border-green-700/40 text-xs font-bold px-2 py-1 rounded",
};

const AnalysisInput = ({ onAnalyze, isLoading }: AnalysisInputProps) => {
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
                    disabled={isLoading}
                    className="cursor-pointer"
                  />
                  <span className="text-sm font-bold uppercase">{key}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || !input.trim()}
            className="mt-4 w-full brutal-box bg-primary text-primary-foreground px-6 py-4 text-lg font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary hover:text-secondary-foreground active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block animate-spin">⚙️</span> ANALYZING...
              </span>
            ) : (
              "ANALYZE NOW →"
            )}
          </button>
        </div>
      </div>

      {/* Pre-built Example Contracts */}
      <div>
        <p className="text-xs font-bold uppercase mb-3 text-gray-300">
          📦 PRE-BUILT EXAMPLE CONTRACTS (click to load)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contracts.map((contract) => {
            const emoji = CONTRACT_EMOJI[contract.id as keyof typeof CONTRACT_EMOJI] || "📄";
            const colorClass = SEVERITY_COLORS[contract.severity];
            const isLoading = loadingId === contract.id;
            const isActive = activeId === contract.id;

            return (
              <button
                key={contract.id}
                onClick={() => loadContract(contract.id)}
                disabled={isLoading || isLoading}
                className={`
                  relative text-left p-3.5 rounded-xl border transition-all duration-150 cursor-pointer
                  ${
                    isActive
                      ? "ring-2 ring-blue-500/50 border-blue-500/50 bg-blue-900/10"
                      : colorClass
                  }
                  disabled:opacity-60 disabled:cursor-wait
                `}
              >
                {/* Header row */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg leading-none">{emoji}</span>
                  <span className="text-sm font-semibold text-gray-100 leading-snug flex-1">
                    {contract.label}
                  </span>
                  {isLoading && <Loader2 size={14} className="text-blue-400 animate-spin" />}
                  {isActive && !isLoading && (
                    <span className="text-xs text-blue-400 font-mono">loaded</span>
                  )}
                </div>
                {/* Description */}
                <p className="text-xs text-gray-400 leading-snug mb-2">{contract.description}</p>
                {/* Severity Badge */}
                <div className="flex items-center gap-1.5">
                  <span className={SEVERITY_BADGE[contract.severity]}>
                    {contract.severity === "none" ? "safe" : contract.severity}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalysisInput;
