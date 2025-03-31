import React, { useState, useEffect } from "react";
import { Card } from "@/components/card/Card";
import { Button } from "@/components/button/Button";
import { FolderOpen, ArrowClockwise, CloudArrowUp } from "@phosphor-icons/react";

// Define the file structure
interface FileData {
  content: string;
  created: string;
  modified: string;
  streaming?: boolean;
}

// Define the expected state structure
interface AgentState {
  files?: Record<string, FileData>;
  // Add other potential state properties if needed
}

interface StoragePanelProps {
  agentState: AgentState | null;
  loading: boolean;
}

export function StoragePanel({ agentState, loading }: StoragePanelProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  // Get worker ID directly from URL query parameter
  const [workerId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('worker');
    return idParam?.startsWith('wai-') ? idParam : "";
  });
  
  // Check if any files are currently streaming
  const hasStreamingFiles = agentState?.files && 
    Object.values(agentState.files).some(file => file.streaming);
  
  // Count the number of files
  const fileCount = agentState?.files ? Object.keys(agentState.files).length : 0;
  
  // Handle publish button click
  const handlePublish = async () => {
    if (!agentState?.files || Object.keys(agentState.files).length === 0) {
      setPublishResult("No files to publish. Create some files first.");
      return;
    }
    
    if (!workerId) {
      setPublishResult("Error: No worker ID found. Please refresh the page.");
      return;
    }
    
    setIsPublishing(true);
    setPublishResult(null);
    
    try {
      // Always use src/index.mjs as the main module
      const mainModule = "src/index.mjs";
      
      // Check if src/index.mjs exists, if not, create a warning
      const files = Object.keys(agentState.files);
      if (!files.includes(mainModule)) {
        setPublishResult(`Warning: Main module '${mainModule}' not found. Please create this file before publishing.`);
        setIsPublishing(false);
        return;
      }
      
      // Call the API endpoint to deploy files
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId,
          files: agentState.files,
          mainModule
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Deployment failed');
      }
      
      const result = await response.json();
      setPublishResult(`Successfully deployed ${fileCount} files to worker '${workerId}'`);
    } catch (error) {
      console.error("Error publishing files:", error);
      setPublishResult(`Error publishing files: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex items-center justify-center h-8 w-8 mr-2">
            <FolderOpen size={24} className="text-[#F48120]" />
          </div>
          <h2 className="font-semibold text-lg">Agent State</h2>
        </div>
        
        <div className="flex items-center gap-2">
          {hasStreamingFiles && (
            <div className="flex items-center text-[#F48120] mr-2">
              <ArrowClockwise size={18} className="animate-spin mr-1" />
              <span className="text-sm">Streaming...</span>
            </div>
          )}
          
          <Button
            variant="primary"
            size="sm"
            className="flex items-center gap-1"
            disabled={isPublishing || fileCount === 0}
            onClick={handlePublish}
          >
            <CloudArrowUp size={16} />
            <span>{isPublishing ? "Publishing..." : "Publish"}</span>
          </Button>
        </div>
      </div>
      
      {publishResult && (
        <div className={`p-2 text-sm ${publishResult.includes('Error') ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
          {publishResult}
        </div>
      )}
      
      {/* Worker ID display */}
      <div className="px-3 py-2 border-b border-neutral-300 dark:border-neutral-800 flex items-center">
        <label htmlFor="worker-id" className="text-sm mr-2">
          Worker ID:
        </label>
        <input
          id="worker-id"
          type="text"
          value={workerId}
          readOnly
          className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 opacity-75"
        />
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-6 w-6 border-2 border-[#F48120] border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div>
            {agentState?.files && Object.keys(agentState.files).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(agentState.files).map(([path, fileData]) => (
                  <div key={path} className="border border-neutral-300 dark:border-neutral-800 rounded-md overflow-hidden">
                    <div className={`p-3 text-sm font-semibold flex items-center justify-between ${fileData.streaming ? 'bg-[#F48120]/10' : 'bg-neutral-100 dark:bg-neutral-900'}`}>
                      <span>{path}</span>
                      {fileData.streaming && (
                        <div className="flex items-center text-[#F48120]">
                          <ArrowClockwise size={16} className="animate-spin mr-1" />
                          <span className="text-sm">Streaming</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 max-h-60 overflow-auto">
                      <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                        {fileData.content}
                      </pre>
                    </div>
                    <div className="p-3 text-sm text-neutral-500 border-t border-neutral-300 dark:border-neutral-800">
                      <div>Created: {new Date(fileData.created).toLocaleString()}</div>
                      <div>Modified: {new Date(fileData.modified).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-neutral-500 p-4 text-base">
                No files available
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
