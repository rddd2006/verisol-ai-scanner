import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeDisplayProps {
  code: string;
  contractName: string;
  address?: string;
  linesOfCode: number;
}

export const CodeDisplay = ({
  code,
  contractName,
  address,
  linesOfCode,
}: CodeDisplayProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split("\n");

  return (
    <div className="brutal-box-static p-4 bg-background border-[2px] border-foreground">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold uppercase">📄 Contract Code</h3>
          <div className="text-xs text-muted-foreground mt-1">
            {contractName}
            {address && (
              <>
                <br />
                <code className="text-[10px] font-mono bg-muted px-2 py-1 rounded inline-block mt-1">
                  {address}
                </code>
              </>
            )}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="brutal-btn-primary flex items-center gap-2 text-xs font-bold"
          type="button"
        >
          {copied ? (
            <>
              <Check size={16} /> COPIED
            </>
          ) : (
            <>
              <Copy size={16} /> COPY
            </>
          )}
        </button>
      </div>

      <div className="flex gap-2 mb-3 text-xs">
        <div className="brutal-box-static px-2 py-1 bg-muted">
          <span className="text-muted-foreground">Lines: </span>
          <span className="font-bold">{linesOfCode}</span>
        </div>
        <div className="brutal-box-static px-2 py-1 bg-muted">
          <span className="text-muted-foreground">Size: </span>
          <span className="font-bold">{(code.length / 1024).toFixed(2)} KB</span>
        </div>
      </div>

      <div className="bg-muted p-4 rounded border border-foreground/20 max-h-96 overflow-auto">
        <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
          <code
            dangerouslySetInnerHTML={{
              __html: code
                .split("\n")
                .map((line, idx) => {
                  // Simple syntax highlighting
                  let highlighted = line
                    // Keywords
                    .replace(
                      /\b(pragma|import|contract|interface|library|function|public|private|internal|external|view|pure|payable|modifier|event|struct|enum|mapping|address|uint|int|string|bool|bytes|returns?|require|revert|assert|emit|delete|new|is|abstract|virtual|override|super|this|selfdestruct)\b/g,
                      '<span style="color: #ff6b6b; font-weight: bold;">$1</span>'
                    )
                    // Comments
                    .replace(
                      /\/\/.*$/,
                      '<span style="color: #888; font-style: italic;">$&</span>'
                    )
                    // Strings
                    .replace(
                      /(["'`]).*?\1/g,
                      '<span style="color: #51cf66;">$&</span>'
                    );
                  return `<div><span style="color: #888; margin-right: 1rem; user-select: none;">${String(idx + 1).padStart(4)}</span>${highlighted}</div>`;
                })
                .join(""),
            }}
          />
        </pre>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        <p>This is the contract code that was retrieved from the blockchain.</p>
      </div>
    </div>
  );
};

export default CodeDisplay;
