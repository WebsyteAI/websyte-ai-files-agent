import { useState } from "react";
import { FileContentsViewer } from "@/components/file-contents-viewer/FileContentsViewer";
import { DependencyGraphViewer } from "@/components/dependency-graph/DependencyGraphViewer";
import { Button } from "@/components/button/Button";
import { ListBullets, Graph } from "@phosphor-icons/react";

// Define the file structure
interface FileData {
  content: string;
  created: string;
  modified: string;
  streaming?: boolean;
}

interface FileViewerProps {
  files: Record<string, FileData>;
}

export function FileViewer({ files }: FileViewerProps) {
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  const toggleFileExpansion = (path: string) => {
    setExpandedFiles(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end mb-4 gap-2">
        <Button
          variant={viewMode === "list" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setViewMode("list")}
          className="flex items-center gap-2"
        >
          <ListBullets size={16} />
          <span>List View</span>
        </Button>
        <Button
          variant={viewMode === "graph" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setViewMode("graph")}
          className="flex items-center gap-2"
        >
          <Graph size={16} />
          <span>Dependency Graph</span>
        </Button>
      </div>
      
      <div className="flex-1">
        {viewMode === "list" ? (
          <FileContentsViewer 
            files={files} 
            expandedFiles={expandedFiles}
            toggleFileExpansion={toggleFileExpansion}
          />
        ) : (
          <DependencyGraphViewer 
            files={files} 
            onFileSelect={(filePath: string) => {
              // When a file is selected in the graph view, expand it in the list view
              setSelectedFile(filePath);
              setExpandedFiles(prev => ({
                ...prev,
                [filePath]: true
              }));
            }}
          />
        )}
      </div>
    </div>
  );
}
