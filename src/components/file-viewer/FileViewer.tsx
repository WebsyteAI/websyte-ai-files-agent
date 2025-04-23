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
  viewMode?: "list" | "graph";
}

export function FileViewer({ files, viewMode = "list" }: FileViewerProps) {
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
