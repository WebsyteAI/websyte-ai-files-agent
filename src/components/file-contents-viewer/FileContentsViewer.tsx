import { useState } from "react";
import { Copy, Check, CaretDown, CaretRight, X } from "@phosphor-icons/react";
import { CodeEditor } from "@/components/code-editor/CodeEditor";

// Define the file structure
interface FileData {
  content: string;
  created: string;
  modified: string;
  streaming?: boolean;
}

interface FileContentsViewerProps {
  files: Record<string, FileData>;
  expandedFiles: Record<string, boolean>;
  toggleFileExpansion: (path: string) => void;
  onClose?: () => void;
  viewMode?: "list" | "graph";
}

export function FileContentsViewer({ 
  files, 
  expandedFiles, 
  toggleFileExpansion,
  onClose,
  viewMode = "list"
}: FileContentsViewerProps) {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  
  // Copy file content to clipboard
  const copyFileContent = async (path: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFile(path);
      
      // Reset copied status after 2 seconds
      setTimeout(() => {
        setCopiedFile(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy file content:", error);
    }
  };

  return (
    <div>
      {Object.entries(files).map(([path, fileData]) => (
        <div key={path} className="border-b border-neutral-300 dark:border-neutral-800">
          <div 
            className="px-4 py-3 text-sm font-semibold flex items-center justify-between cursor-pointer"
            onClick={() => toggleFileExpansion(path)}
          >
            <div className="flex items-center">
              {expandedFiles[path] ? <CaretDown size={16} className="mr-2 text-white" /> : <CaretRight size={16} className="mr-2 text-white" />}
              <span className="text-white">{path}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyFileContent(path, fileData.content);
                  }}
                  title="Copy file content"
                >
                  {copiedFile === path ? (
                    <Check size={16} className="text-green-500" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
                {onClose && (
                  <button
                    className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    title="Close file viewer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
          {expandedFiles[path] && (
            <>
              <div className="px-0 h-full">
                <div className={`code-editor bg-neutral-50 dark:bg-neutral-900 overflow-auto border border-neutral-200 dark:border-neutral-800 rounded-sm text-xs md:text-sm h-full ${viewMode !== "list" ? "max-h-[calc(100vh-200px)]" : ""}`}>
                  <CodeEditor code={fileData.content} filename={path} />
                </div>
              </div>
              <div className="px-4 py-2 text-sm text-neutral-500 border-t border-neutral-300 dark:border-neutral-800">
                <div>Created: {new Date(fileData.created).toLocaleString()}</div>
                <div>Modified: {new Date(fileData.modified).toLocaleString()}</div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
