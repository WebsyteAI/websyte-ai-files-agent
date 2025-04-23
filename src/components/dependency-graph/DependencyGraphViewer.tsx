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
import { FileContentsViewer } from "@/components/file-contents-viewer/FileContentsViewer";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/resizable";
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
  // State for expanded files in FileContentsViewer
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  
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
    
    // Expand the selected file in the FileContentsViewer
    setExpandedFiles(prev => ({
      ...prev,
      [filePath]: true
    }));
    
    // Notify parent component if callback is provided
    if (onFileSelect) {
      onFileSelect(filePath);
    }
  }, [onFileSelect]);
  
  // Close file viewer
  const closeFileViewer = useCallback(() => {
    setSelectedFile(null);
  }, []);
  
  // Toggle file expansion in FileContentsViewer
  const toggleFileExpansion = useCallback((path: string) => {
    setExpandedFiles(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  }, []);
  
  // Filter files to only show the selected file
  const selectedFiles = useMemo(() => {
    if (!selectedFile || !files[selectedFile]) return {};
    return { [selectedFile]: files[selectedFile] };
  }, [selectedFile, files]);
  
  // Render the ReactFlow component
  const renderReactFlow = () => (
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
  );
  
  return (
    <div className="w-full h-full">
      {selectedFile ? (
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={60} minSize={30}>
            {renderReactFlow()}
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full overflow-auto bg-white dark:bg-gray-900 border-l border-gray-300 dark:border-gray-700">
              <div className="sticky top-0 flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 border-b border-gray-300 dark:border-gray-700">
                <h3 className="text-sm font-medium truncate">{selectedFile}</h3>
                <button 
                  onClick={closeFileViewer}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="h-[calc(100%-40px)]">
                <FileContentsViewer 
                  files={selectedFiles} 
                  expandedFiles={expandedFiles} 
                  toggleFileExpansion={toggleFileExpansion} 
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="w-full h-full">
          {renderReactFlow()}
        </div>
      )}
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
