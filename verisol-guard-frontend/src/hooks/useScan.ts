import { useState, useCallback, useRef } from "react";

export interface Modules {
  static: boolean;
  honeypot: boolean;
  genericFuzz: boolean;
  aiFuzz: boolean;
}

export interface AnalysisReport {
  success?: boolean;
  contractName?: string;
  sourceCode?: string;
  findings?: Array<{
    agent: string;
    severity: string;
    message: string;
  }>;
  statistics?: Record<string, unknown>;
  static?: Record<string, unknown>;
  honeypot?: Record<string, unknown>;
  genericFuzz?: Record<string, unknown>;
  aiFuzz?: Record<string, unknown>;
  report?: Record<string, unknown>;
  rating?: Record<string, unknown>;
  ratingResult?: Record<string, unknown>;
  [key: string]: unknown;
}

const API_BASE = import.meta.env.VITE_API_BASE || "";

export function useScan() {
  const [phase, setPhase] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [agentStates, setAgentStates] = useState<Record<string, string>>({});
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const scan = useCallback((inputType: string, value: string, modules: Modules) => {
    if (!value?.trim()) {
      setError("Input required");
      setPhase("error");
      return;
    }

    esRef.current?.close();
    setPhase("scanning");
    setError(null);
    setReport(null);
    setAgentStates({});

    try {
      const encodedValue = btoa(unescape(encodeURIComponent(value)));
      const encodedModules = btoa(JSON.stringify(modules));
      const url = `${API_BASE}/api/scan/stream?inputType=${inputType}&value=${encodeURIComponent(encodedValue)}&modules=${encodeURIComponent(encodedModules)}`;

      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("source:resolved", () => {
        // Contract resolved, scanning started
      });

      es.addEventListener("agent:start", (e) => {
        const data = JSON.parse(e.data);
        setAgentStates((p) => ({ ...p, [data.agent]: "running" }));
      });

      es.addEventListener("agent:started", (e) => {
        const data = JSON.parse(e.data);
        setAgentStates((p) => ({ ...p, [data.agent]: "running" }));
      });

      es.addEventListener("agent:done", (e) => {
        const data = JSON.parse(e.data);
        setAgentStates((p) => ({ ...p, [data.agent]: "done" }));
      });

      es.addEventListener("agent:complete", (e) => {
        const data = JSON.parse(e.data);
        setReport(data.report || data);
        setPhase("done");
        es.close();
        esRef.current = null;
      });

      es.addEventListener("report:complete", (e) => {
        const data = JSON.parse(e.data);
        setReport(data);
        setPhase("done");
        es.close();
        esRef.current = null;
      });

      es.addEventListener("error", (e) => {
        try {
          const data = JSON.parse(e.data);
          setError(data.message || "Analysis failed");
        } catch {
          setError("Analysis failed");
        }
        setPhase("error");
        es.close();
        esRef.current = null;
      });

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) return;
        setError("Connection lost");
        setPhase("error");
        es.close();
        esRef.current = null;
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start analysis");
      setPhase("error");
    }
  }, []);

  const cancel = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setPhase("idle");
    setAgentStates({});
  }, []);

  return { phase, agentStates, report, error, scan, cancel };
}
