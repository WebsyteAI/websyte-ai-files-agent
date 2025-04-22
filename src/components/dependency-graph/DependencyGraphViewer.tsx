import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider
} from "reactflow";
import type { NodeTypes } from "reactflow";
import "reactflow/dist/style.css";

import FileNode from "./nodes/FileNode";
import { parseDependencies } from "./utils/dependency-parser";
import { CodeEditor } from "@/components/code-editor/CodeEditor";
import { X } from "@phosphor-icons/react";

// Define the file structure (same as in FileContentsViewer)
interface FileData {
  content: string;
  created: string;
  modified: string;
  streaming?: boolean;
}

// Define custom node types
const nodeTypes: NodeTypes = {
  file: FileNode
};

interface DependencyGraphViewerProps {
  files: Record<string, FileData>;
  onFileSelect?: (filePath: string) => void;
}

function DependencyGraph({ files, onFileSelect }: DependencyGraphViewerProps) {
  // State for selected file
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const fileContentRef = useRef<HTMLDivElement>(null);
  // Process the files to extract dependencies and domain groups
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => 
    parseDependencies(files), [files]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // Update nodes and edges when files change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = parseDependencies(files);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [files, setNodes, setEdges]);
  
  // Filter state
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  
  // Get unique domains for filter
  const domains = useMemo(() => {
    const uniqueDomains = new Set<string>();
    nodes.forEach(node => uniqueDomains.add(node.data.domain));
    return Array.from(uniqueDomains).sort();
  }, [nodes]);
  
  // Apply filter
  const filteredNodes = useMemo(() => {
    if (!domainFilter) return nodes;
    return nodes.filter(node => node.data.domain === domainFilter);
  }, [nodes, domainFilter]);
  
  const filteredEdges = useMemo(() => {
    if (!domainFilter) return edges;
    
    // Get IDs of filtered nodes
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    
    // Only keep edges where both source and target are in the filtered nodes
    return edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
  }, [edges, filteredNodes, domainFilter]);
  
  // Reset filter
  const resetFilter = useCallback(() => {
    setDomainFilter(null);
  }, []);

  // Handle node click
  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    const filePath = node.id as string;
    setSelectedFile(filePath);
    // Notify parent component if callback is provided
    if (onFileSelect) {
      onFileSelect(filePath);
    }
    // Scroll to file content
    setTimeout(() => {
      fileContentRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [onFileSelect]);

  // Close file content view
  const closeFileContent = useCallback(() => {
    setSelectedFile(null);
  }, []);
  
  return (
    <div style={{ width: "100%", height: "calc(100vh - 200px)" }}>
      <ReactFlow
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-right"
      >
        <Background />
        <Controls />
        <MiniMap 
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
        
        <Panel position="top-left" className="bg-white dark:bg-gray-800 p-2 rounded-md shadow-md">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Domain Filter</h3>
            <div className="flex flex-wrap gap-2">
              {domains.map(domain => (
                <button
                  key={domain}
                  className={`px-2 py-1 text-xs rounded-md ${
                    domainFilter === domain 
                      ? "bg-blue-500 text-white" 
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                  onClick={() => setDomainFilter(domain)}
                >
                  {domain}
                </button>
              ))}
              {domainFilter && (
                <button
                  className="px-2 py-1 text-xs rounded-md bg-red-500 text-white"
                  onClick={resetFilter}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* File content viewer - slides from right */}
      <div 
        className={`absolute top-0 right-0 h-full bg-white dark:bg-gray-900 border-l border-gray-300 dark:border-gray-700 shadow-lg z-10 w-[50%] transform transition-transform duration-300 ease-in-out ${
          selectedFile && files[selectedFile] ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedFile && files[selectedFile] && (
          <>
            <div ref={fileContentRef} className="sticky top-0 flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 border-b border-gray-300 dark:border-gray-700">
              <h3 className="text-sm font-medium truncate">{selectedFile}</h3>
              <button 
                onClick={closeFileContent}
                className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-auto h-[calc(100%-40px)]">
              <CodeEditor code={files[selectedFile].content} filename={selectedFile} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Wrap with provider to ensure React Flow works correctly
export function DependencyGraphViewer(props: DependencyGraphViewerProps) {
  return (
    <ReactFlowProvider>
      <DependencyGraph {...props} />
    </ReactFlowProvider>
  );
}
