import React from "react";
import { Card } from "@/components/card/Card";
import { FolderOpen } from "@phosphor-icons/react";

// Define the expected state structure (optional but good practice)
interface AgentState {
  files?: any[]; // Or a more specific type if known
  // Add other potential state properties if needed
}

interface StoragePanelProps {
  agentState: AgentState | null;
  loading: boolean;
}

export function StoragePanel({ agentState, loading }: StoragePanelProps) {

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center">
        <div className="flex items-center justify-center h-8 w-8 mr-2">
          <FolderOpen size={20} className="text-[#F48120]" />
        </div>
        <h2 className="font-semibold text-base">Agent State</h2>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-5 w-5 border-2 border-[#F48120] border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">
            {agentState ? JSON.stringify(agentState, null, 2) : "No state available"}
          </pre>
        )}
      </div>
    </Card>
  );
}
