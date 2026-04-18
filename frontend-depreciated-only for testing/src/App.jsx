import { useState } from "react";
import Header from "./components/Header";
import InputPanel from "./components/InputPanel";
import ScanProgress from "./components/ScanProgress";
import ResultsPanel from "./components/ResultsPanel";
import { useScan, PHASES, DEFAULT_MODULES } from "./hooks/useScan";

export default function App() {
  const { phase, agentStates, agentData, finalReport, error, log, scan, reset } = useScan();

  const [inputType, setInputType] = useState("code");
  const [value,     setValue]     = useState("");
  const [modules,   setModules]   = useState({ ...DEFAULT_MODULES });

  const handleScan = (override) => scan(override || { inputType, value, modules });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {(phase === PHASES.IDLE || phase === PHASES.ERROR) && (
          <InputPanel
            inputType={inputType}  setInputType={setInputType}
            value={value}          setValue={setValue}
            modules={modules}      setModules={setModules}
            onScan={handleScan}
            error={error}
          />
        )}

        {phase === PHASES.SCANNING && (
          <ScanProgress agentStates={agentStates} agentData={agentData} log={log} />
        )}

        {phase === PHASES.DONE && finalReport && (
          <ResultsPanel report={finalReport} onReset={reset} />
        )}
      </main>

      <footer className="text-center text-xs text-gray-700 py-8">
        VeriSol AI · Multi-Agent Smart Contract Security Scanner · For educational use only
      </footer>
    </div>
  );
}
