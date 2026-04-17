import { Brain, Bug, Zap, FlaskConical } from "lucide-react";

const MODULE_META = [
  {
    id: "static",
    icon: Brain,
    name: "Static AI Analysis",
    desc: "Gemini scans for 20+ vulnerability classes",
    color: "blue",
  },
  {
    id: "honeypot",
    icon: Bug,
    name: "Honeypot Detection",
    desc: "Simulates deposit / withdraw flow",
    color: "orange",
  },
  {
    id: "genericFuzz",
    icon: Zap,
    name: "Generic Fuzz Tests",
    desc: "Pre-written Foundry invariant suite",
    color: "yellow",
  },
  {
    id: "aiFuzz",
    icon: FlaskConical,
    name: "AI-Driven Fuzzing",
    desc: "Gemini generates custom test suite",
    color: "purple",
  },
];

const COLOR_MAP = {
  blue:   { ring: "ring-blue-500/40",   icon: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30" },
  orange: { ring: "ring-orange-500/40", icon: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  yellow: { ring: "ring-yellow-500/40", icon: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  purple: { ring: "ring-purple-500/40", icon: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
};

export default function ModuleSelector({ modules, setModules }) {
  const toggle = (id) =>
    setModules((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Analysis Modules
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MODULE_META.map((m) => {
          const on = modules[m.id];
          const c = COLOR_MAP[m.color];
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={`
                relative flex flex-col items-start gap-2 p-3 rounded-xl border transition-all duration-150 text-left
                ${on
                  ? `${c.bg} ${c.border} ring-1 ${c.ring}`
                  : "bg-gray-900 border-gray-800 hover:border-gray-700"
                }
              `}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${on ? c.bg : "bg-gray-800"}`}>
                <Icon size={14} className={on ? c.icon : "text-gray-500"} />
              </div>
              <div>
                <div className={`text-xs font-semibold leading-snug ${on ? "text-gray-100" : "text-gray-400"}`}>
                  {m.name}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 leading-snug">{m.desc}</div>
              </div>
              {/* Checkbox indicator */}
              <div className={`absolute top-2 right-2 w-4 h-4 rounded-full border flex items-center justify-center transition-colors
                ${on ? `${c.bg} ${c.border}` : "border-gray-700 bg-gray-800"}`}>
                {on && <div className={`w-2 h-2 rounded-full ${c.icon.replace("text-", "bg-")}`} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
