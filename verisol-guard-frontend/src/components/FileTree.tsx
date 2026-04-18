import { useState } from "react";
import { ChevronRight, ChevronDown, FileCode, Folder } from "lucide-react";

interface FileInfo {
  path: string;
  name?: string;
  content?: string;
  size: number;
  isMainContract?: boolean;
  contractNames?: string[];
}

interface FileTreeProps {
  files: FileInfo[];
  repoName: string;
  totalSize: number;
  fileCount: number;
}

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  isSolFile?: boolean;
  isMainContract?: boolean;
  contractNames?: string[];
  size?: number;
}

const buildTree = (files: FileInfo[]): TreeNode => {
  const root: TreeNode = { name: "root", path: "", children: [] };

  files.forEach((file) => {
    const parts = file.path.split("/");
    let current = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const pathSoFar = parts.slice(0, index + 1).join("/");

      let node = current.children?.find((n) => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: pathSoFar,
          isSolFile: isLast && part.endsWith(".sol"),
          isMainContract: isLast ? file.isMainContract : undefined,
          contractNames: isLast ? file.contractNames : undefined,
          size: isLast ? file.size : undefined,
        };

        if (!isLast) {
          node.children = [];
        }

        current.children = current.children || [];
        current.children.push(node);
      }

      current = node;
    });
  });

  return root;
};

interface TreeItemProps {
  node: TreeNode;
  level: number;
}

const TreeItem = ({ node, level }: TreeItemProps) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSolFile = node.isSolFile;

  return (
    <div>
      <div
        className={`pl-${level * 4} flex items-center gap-2 py-0.5 text-xs font-mono hover:bg-muted rounded`}
        style={{ paddingLeft: `${level * 16}px` }}
      >
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-foreground/10 rounded"
          >
            {expanded ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-[18px]" />}

        {hasChildren ? (
          <Folder size={14} className="text-muted-foreground flex-shrink-0" />
        ) : (
          <FileCode
            size={14}
            className={`flex-shrink-0 ${
              isSolFile ? "text-risk-critical" : "text-muted-foreground"
            }`}
          />
        )}

        <span className={isSolFile ? "text-risk-critical font-bold" : ""}>
          {node.name}
        </span>

        {isSolFile && node.contractNames && node.contractNames.length > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            ({node.contractNames.join(", ")})
          </span>
        )}

        {isSolFile && node.isMainContract && (
          <span className="text-[10px] px-1.5 py-0.5 bg-risk-low text-primary-foreground rounded font-bold ml-auto">
            MAIN
          </span>
        )}

        {isSolFile && node.size && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {(node.size / 1024).toFixed(1)}KB
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children!.sort((a, b) => {
            // Folders first, then main contracts, then others
            const aHasChildren = a.children && a.children.length > 0;
            const bHasChildren = b.children && b.children.length > 0;
            if (aHasChildren !== bHasChildren) {
              return aHasChildren ? -1 : 1;
            }
            if (a.isMainContract !== b.isMainContract) {
              return a.isMainContract ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          }).map((child) => (
            <TreeItem key={child.path} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree = ({
  files,
  repoName,
  totalSize,
  fileCount,
}: FileTreeProps) => {
  const tree = buildTree(files);
  const solFiles = files.filter((f) => f.path.endsWith(".sol"));
  const mainContracts = files.filter((f) => f.isMainContract);

  return (
    <div className="brutal-box-static p-4 bg-background border-[2px] border-foreground">
      <div className="mb-3">
        <h3 className="text-lg font-bold uppercase mb-2">📁 Repository Structure</h3>
        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <div className="brutal-box-static p-2 bg-muted">
            <div className="font-bold text-muted-foreground">TOTAL FILES</div>
            <div className="text-lg font-bold">{fileCount}</div>
          </div>
          <div className="brutal-box-static p-2 bg-muted">
            <div className="font-bold text-muted-foreground">.SOL FILES</div>
            <div className="text-lg font-bold text-risk-critical">{solFiles.length}</div>
          </div>
          <div className="brutal-box-static p-2 bg-muted">
            <div className="font-bold text-muted-foreground">MAIN CONTRACTS</div>
            <div className="text-lg font-bold text-risk-low">{mainContracts.length}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          <strong>{repoName}</strong> • {(totalSize / 1024 / 1024).toFixed(2)} MB
        </div>
      </div>

      <div className="bg-muted p-3 rounded border border-foreground/20 max-h-96 overflow-auto font-mono text-xs">
        {tree.children && tree.children.length > 0 ? (
          tree.children.map((child) => (
            <TreeItem key={child.path} node={child} level={0} />
          ))
        ) : (
          <div className="text-muted-foreground">No files to display</div>
        )}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        <p>
          🔴 <strong>Red files</strong> = Solidity contracts
        </p>
        <p>
          <strong className="bg-risk-low text-primary-foreground px-1.5 py-0.5 rounded text-[10px]">
            MAIN
          </strong>{" "}
          = Primary contracts (likely for analysis)
        </p>
      </div>
    </div>
  );
};

export default FileTree;
