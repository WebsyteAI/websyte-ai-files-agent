import React from "react";
import { Card } from "@/components/card/Card";
import { FolderOpen, ArrowClockwise } from "@phosphor-icons/react";

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
  // Check if any files are currently streaming
  const hasStreamingFiles = agentState?.files && 
    Object.values(agentState.files).some(file => file.streaming);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center">
        <div className="flex items-center justify-center h-8 w-8 mr-2">
          <FolderOpen size={24} className="text-[#F48120]" />
        </div>
        <h2 className="font-semibold text-lg">Agent State</h2>
        {hasStreamingFiles && (
          <div className="ml-auto flex items-center text-[#F48120]">
            <ArrowClockwise size={18} className="animate-spin mr-1" />
            <span className="text-sm">Streaming...</span>
          </div>
        )}
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
