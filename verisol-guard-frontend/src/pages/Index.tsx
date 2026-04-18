import VerisolHeader from "@/components/VerisolHeader";
import AnalysisInput from "@/components/AnalysisInput";
import AnalysisResults from "@/components/AnalysisResults";
import FeaturesSection from "@/components/FeaturesSection";
import { useScan } from "@/hooks/useScan";
import type { Modules } from "@/hooks/useScan";

const CONTRACT_DEMO_MODULES: Modules = {
  static: true,
  honeypot: true,
  genericFuzz: true,
  aiFuzz: true,
};

const QUICK_EXAMPLES = [
  { id: "HoneypotVault", label: "Honeypot Vault", icon: "🚨" },
  { id: "SafeVault", label: "Safe Vault", icon: "✅" },
  { id: "FuzzCleanVault", label: "Fuzz Clean Vault", icon: "🧪" },
  { id: "VulnerableBank", label: "Vulnerable Bank", icon: "⚠️" },
  { id: "InsecureToken", label: "Insecure Token", icon: "🪙" },
  { id: "NaiveLendingPool", label: "Naive Lending Pool", icon: "💧" },
];

const Index = () => {
  const { phase, agentStates, report, error, scan, cancel } = useScan();

  const handleAnalyze = (inputType: string, input: string, modules: Modules) => {
    scan(inputType, input, modules);
  };

  const runQuickExample = async (id: string) => {
    const response = await fetch(`/api/contracts/${id}`);
    const data = await response.json();
    if (data.source) {
      handleAnalyze("code", data.source, CONTRACT_DEMO_MODULES);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <VerisolHeader />

      {/* Marquee ticker */}
      <div className="border-b-[3px] border-foreground bg-primary text-primary-foreground overflow-hidden py-2">
        <div className="animate-marquee whitespace-nowrap flex">
          {[...Array(2)].map((_, i) => (
            <span key={i} className="text-sm font-bold uppercase mx-4">
              ★ STATIC AI ANALYSIS ★ HONEYPOT DETECTION ★ GENERIC FUZZ TESTING ★ AI-DRIVEN FUZZ TESTING ★ MULTI-INPUT SUPPORT ★ SEPOLIA TESTNET ★ GITHUB REPOS ★ RAW SOLIDITY ★
            </span>
          ))}
        </div>
      </div>

      {/* Hero tagline */}
      <div className="container mx-auto px-4 pt-8 pb-4">
        <div className="brutal-box-static bg-secondary p-6 brutal-rotate-1 animate-scale-in">
          <p className="text-lg md:text-xl font-bold uppercase text-center">
            Audit smart contracts with AI-powered static analysis, honeypot detection, and automated fuzz testing
            <span className="animate-blink ml-1">_</span>
          </p>
        </div>
      </div>

      {/* Analyzer */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <div className="animate-fade-in-left" style={{ animationDelay: "100ms" }}>
            <div className="mb-4 brutal-rotate-2">
              <h2 className="text-2xl font-bold uppercase">
                <span className="brutal-highlight">INPUT</span>
              </h2>
            </div>
            <AnalysisInput onAnalyze={handleAnalyze} isLoading={phase === "scanning"} />

            <div className="mt-4 brutal-box-static bg-muted p-3 brutal-rotate-pos-1">
              <p className="text-xs font-bold uppercase mb-2">🧪 EXAMPLES — CLICK TO TRY:</p>
              <div className="space-y-1">
                {QUICK_EXAMPLES.map((example, index) => (
                  <button
                    key={example.id}
                    onClick={() => runQuickExample(example.id)}
                    disabled={phase === "scanning"}
                    className={`block w-full text-left text-xs font-bold hover:bg-secondary px-2 py-1 disabled:opacity-50 ${
                      index < QUICK_EXAMPLES.length - 1 ? "border-b border-foreground/20" : ""
                    }`}
                  >
                    {example.icon} {example.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="animate-fade-in-right" style={{ animationDelay: "200ms" }}>
            <div className="mb-4 brutal-rotate-pos-1">
              <h2 className="text-2xl font-bold uppercase">
                <span className="brutal-highlight">RESULTS</span>
              </h2>
            </div>
            {phase === "scanning" && (
              <div className="brutal-box-static bg-secondary text-secondary-foreground p-4 space-y-2">
                <p className="text-sm font-bold uppercase">ANALYZING...</p>
                <div className="space-y-1">
                  {Object.entries(agentStates).map(([agent, state]) => (
                    <div key={agent} className="flex items-center gap-2 text-xs">
                      <span>
                        {state === "done" ? "✓" : state === "running" ? "◆" : "○"}
                      </span>
                      <span>{agent}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={cancel}
                  className="mt-4 w-full text-xs font-bold uppercase py-2 border-[2px] border-secondary-foreground hover:bg-primary/20"
                >
                  Cancel
                </button>
              </div>
            )}
            {error && (
              <div className="brutal-box-static bg-risk-critical text-primary-foreground p-4">
                <p className="text-sm font-bold">ERROR</p>
                <p className="text-xs mt-2">{error}</p>
              </div>
            )}
            {phase === "done" && report && (
              <AnalysisResults report={report} />
            )}
            {phase === "idle" && !report && !error && (
              <div className="brutal-box-static bg-muted p-4 text-center">
                <p className="text-xs font-bold uppercase text-muted-foreground">Enter input and click Analyze</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Features */}
      <FeaturesSection />

      {/* Footer */}
      <footer className="border-t-[3px] border-foreground bg-primary text-primary-foreground p-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm font-bold uppercase">
            VeriSol AI — Smart Contract Security Analysis
          </div>
          <a
            href="https://github.com/rddd2006/verisol-ai-scanner"
            target="_blank"
            rel="noopener noreferrer"
            className="brutal-underline text-sm font-bold uppercase text-primary-foreground"
          >
            → VIEW ON GITHUB
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
