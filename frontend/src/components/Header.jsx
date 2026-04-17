import { ShieldCheck } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <ShieldCheck size={18} className="text-blue-400" />
          </div>
          <div>
            <div className="font-semibold text-white leading-none">VeriSol AI</div>
            <div className="text-xs text-gray-500 mt-0.5 font-code">Smart Contract Security Scanner</div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 text-xs">
          <span className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-gray-800/60 border border-gray-700/50 rounded-md text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Gemini 1.5 Pro
          </span>
          <span className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-gray-800/60 border border-gray-700/50 rounded-md text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            Foundry
          </span>
        </div>
      </div>
    </header>
  );
}
