import { PixelChain, PixelBrain, PixelHoneypot, PixelBeaker, PixelChip } from "./BrutalIcon";

const features = [
  {
    Icon: PixelChain,
    title: "MULTI-INPUT SUPPORT",
    desc: "Analyze contracts by a deployed Sepolia address, an entire GitHub repository, or by pasting raw Solidity code.",
  },
  {
    Icon: PixelBrain,
    title: "STATIC AI ANALYSIS",
    desc: "Leverages Google's Gemini Pro to read source code and identify a wide range of common vulnerabilities.",
  },
  {
    Icon: PixelHoneypot,
    title: "HONEYPOT DETECTION",
    desc: "Dynamic simulation of deposits and withdrawals, flagging contracts that may trap user funds.",
  },
  {
    Icon: PixelBeaker,
    title: "GENERIC FUZZ TESTING",
    desc: "Runs a pre-written suite of property-based tests to check for common invariant violations like token supply consistency.",
  },
  {
    Icon: PixelChip,
    title: "AI-DRIVEN FUZZ TESTING",
    desc: "The AI dynamically generates a custom fuzz testing suite based on the target contract's unique ABI, then interprets failures in plain English.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="border-t-[3px] border-b-[3px] border-foreground bg-muted py-12 md:py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold uppercase mb-8 text-center animate-fade-in">
          <span className="brutal-highlight">FEATURES</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 brutal-stagger">
          {features.map((f, i) => (
            <div
              key={i}
              className={`brutal-box bg-background p-5 opacity-0 animate-fade-in ${
                i % 3 === 0 ? "brutal-rotate-1" : i % 3 === 1 ? "" : "brutal-rotate-pos-1"
              }`}
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "forwards" }}
            >
              <div className="mb-3 text-foreground">
                <f.Icon size={56} />
              </div>
              <h3 className="text-base font-bold uppercase mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
