import { useState, useCallback, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export const PHASES = {
  IDLE:     "idle",
  SCANNING: "scanning",
  DONE:     "done",
  ERROR:    "error",
};

export const DEFAULT_MODULES = {
  static:      true,
  honeypot:    true,
  genericFuzz: true,
  aiFuzz:      true,
};

export const AGENT_META = {
  orchestrator:  { label: "Orchestrator",          color: "blue"   },
  static:        { label: "Static AI Analysis",    color: "purple" },
  honeypot:      { label: "Honeypot Detection",    color: "orange" },
  fuzzStrategy:  { label: "Fuzz Strategy Planner", color: "yellow" },
  genericFuzz:   { label: "Generic Fuzz Runner",   color: "green"  },
  aiFuzz:        { label: "AI-Driven Fuzzer",       color: "pink"   },
  fuzzInterp:    { label: "Fuzz Interpreter",       color: "teal"   },
  rating:        { label: "Rating Agent",           color: "blue"   },
};

/**
 * useAgentScan — SSE-based hook for the multi-agent pipeline.
 *
 * Streams agent events in real-time so the UI shows each agent
 * firing up, completing, and contributing to the final report.
 */
export function useScan() {
  const [phase,       setPhase]       = useState(PHASES.IDLE);
  const [agentStates, setAgentStates] = useState({});   // { agentId: "idle"|"running"|"done"|"error" }
  const [agentData,   setAgentData]   = useState({});   // { agentId: resultObject }
  const [finalReport, setFinalReport] = useState(null);
  const [error,       setError]       = useState(null);
  const [log,         setLog]         = useState([]);   // chronological event log
  const esRef = useRef(null);

  const appendLog = (entry) =>
    setLog((prev) => [...prev, { ts: Date.now(), ...entry }]);

  const scan = useCallback(({ inputType, value, modules }) => {
    if (!value?.trim()) {
      setError("Please provide a contract address, GitHub URL, or paste Solidity code.");
      return;
    }

    // Close any previous SSE connection
    esRef.current?.close();

    setPhase(PHASES.SCANNING);
    setAgentStates({});
    setAgentData({});
    setFinalReport(null);
    setError(null);
    setLog([]);

    // Encode params for SSE query string
    const encoded = btoa(unescape(encodeURIComponent(value)));
    const modEnc  = btoa(JSON.stringify(modules));
    const url = `${API_BASE}/api/scan/stream?inputType=${inputType}&value=${encodeURIComponent(encoded)}&modules=${encodeURIComponent(modEnc)}`;

    const es = new EventSource(url);
    esRef.current = es;

    // ── SSE event handlers ───────────────────────────────────────────
    es.addEventListener("source:resolved", (e) => {
      const d = JSON.parse(e.data);
      appendLog({ type: "info", message: `Source resolved: ${d.contractName} (${d.linesOfCode} lines)` });
    });

    es.addEventListener("agent:start", (e) => {
      const { agent, message } = JSON.parse(e.data);
      setAgentStates((prev) => ({ ...prev, [agent]: "running" }));
      appendLog({ type: "start", agent, message });
    });

    es.addEventListener("agent:done", (e) => {
      const { agent, result } = JSON.parse(e.data);
      setAgentStates((prev) => ({ ...prev, [agent]: "done" }));
      setAgentData  ((prev) => ({ ...prev, [agent]: result }));
      appendLog({ type: "done", agent, message: `${AGENT_META[agent]?.label ?? agent} completed` });
    });

    es.addEventListener("agent:error", (e) => {
      const { agent, message } = JSON.parse(e.data);
      setAgentStates((prev) => ({ ...prev, [agent]: "error" }));
      appendLog({ type: "error", agent, message });
    });

    es.addEventListener("agent:complete", (e) => {
      const { report } = JSON.parse(e.data);
      setFinalReport(report);
      setPhase(PHASES.DONE);
      appendLog({ type: "complete", message: "All agents finished" });
      es.close();
    });

    es.addEventListener("ping", () => { /* keep-alive, ignore */ });

    es.addEventListener("error", (e) => {
      if (es.readyState === EventSource.CLOSED) return; // normal close
      const msg = e.data ? JSON.parse(e.data).message : "SSE connection error";
      setError(msg);
      setPhase(PHASES.ERROR);
      appendLog({ type: "error", message: msg });
      es.close();
    });

    es.onerror = (e) => {
      if (es.readyState === EventSource.CLOSED) return;
      setError("Connection to backend lost. Is the server running on port 3001?");
      setPhase(PHASES.ERROR);
      es.close();
    };
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    setPhase(PHASES.IDLE);
    setAgentStates({});
    setAgentData({});
    setFinalReport(null);
    setError(null);
    setLog([]);
  }, []);

  return { phase, agentStates, agentData, finalReport, error, log, scan, reset };
}
