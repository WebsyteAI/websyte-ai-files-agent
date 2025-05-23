import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/card/Card";
import { Button } from "@/components/button/Button";
import {
  FolderOpen,
  ArrowClockwise,
  ArrowsHorizontal,
  GithubLogo,
  Check,
  ListBullets,
  Graph,
  X,
  FlowArrow,
} from "@phosphor-icons/react";
import { ViewModeManager } from "@/components/view-mode-manager/ViewModeManager";

// Define the file structure
interface FileData {
  content: string;
  created: string;
  modified: string;
  streaming?: boolean;
}

// Define the GitHub build status structure
interface GitHubBuildStatus {
  state: string;
  statuses: Array<{
    state: string;
    description: string;
    context: string;
    target_url: string;
    created_at: string;
    updated_at: string;
  }>;
  check_runs?: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    started_at: string;
    completed_at: string | null;
    html_url: string;
    app: {
      name: string;
    };
  }>;
}

// Define the expected state structure
interface AgentState {
  files?: Record<string, FileData>;
  buildStatus?: {
    repository: string;
    ref: string;
    status: GitHubBuildStatus;
    timestamp: string;
  };
  // Cloudflare Worker configuration
  dispatchNamespace?: string;
  workerScriptName?: string;
}

interface WorkspacePanelProps {
  agentState: AgentState | null;
  loading: boolean;
  onToggle?: () => void;
  onUpdateAgentState?: (newState: any) => void;
  onSendToAgent?: (message: string) => void;
  // Removed isPromptFlowOpen prop since we're setting viewMode to "board" by default
}

export function WorkspacePanel({
  agentState,
  loading,
  onToggle,
  onUpdateAgentState,
  onSendToAgent,
}: WorkspacePanelProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const initialFetchDone = useRef(false);
  const [viewMode, setViewMode] = useState<"list" | "graph" | "board">("graph");

  // Initialize all files as expanded by default
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(
    () => {
      const initialState: Record<string, boolean> = {};
      if (agentState?.files) {
        Object.keys(agentState.files).forEach((path) => {
          initialState[path] = true;
        });
      }
      return initialState;
    }
  );

  // Update expanded files state when new files are added
  useEffect(() => {
    if (agentState?.files) {
      setExpandedFiles((prev) => {
        const newState = { ...prev };
        Object.keys(agentState.files!).forEach((path) => {
          if (newState[path] === undefined) {
            newState[path] = true; // Set new files to expanded by default
          }
        });
        return newState;
      });
    }
  }, [agentState?.files]);
  
  // No need for the effect that sets viewMode to "board" since it's the default now

  // Fetch build status from GitHub
  const fetchBuildStatus = async () => {
    setIsFetchingStatus(true);
    setStatusError(null);

    try {
      const response = await fetch("/api/agent/tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "getGitHubBuildStatus",
          params: {
            owner: "WebsyteAI", // Default organization
            repo: "websyte-ai-worker-starter", // Default repository
            ref: "main", // Default branch
            updateAgentState: true, // Update agent state with build status
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch build status");
      }

      // The result will be stored in agent state automatically
    } catch (error) {
      console.error("Error fetching build status:", error);
      setStatusError(
        `Error fetching build status: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsFetchingStatus(false);
    }
  };

  // Fetch build status on component mount
  useEffect(() => {
    // Only fetch if we're not already loading and there are files
    if (
      !initialFetchDone.current &&
      !loading &&
      agentState?.files &&
      Object.keys(agentState.files).length > 0
    ) {
      fetchBuildStatus();
      initialFetchDone.current = true;
    }
  }, [loading, agentState?.files]);

  // Get worker ID directly from URL query parameter
  const [workerId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("worker");
    return idParam || "unknown";
  });

  // Toggle file expansion
  const toggleFileExpansion = (path: string) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // Count the number of files
  const fileCount = agentState?.files
    ? Object.keys(agentState.files).length
    : 0;

  // Get status color based on state
  const getStatusColor = (state: string) => {
    switch (state) {
      case "success":
        return "text-green-500";
      case "pending":
        return "text-yellow-500";
      case "failure":
      case "error":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  // Get status icon based on state
  const getStatusIcon = (state: string) => {
    switch (state) {
      case "success":
        return <Check size={16} className="text-green-500" />;
      case "pending":
        return (
          <ArrowClockwise size={16} className="animate-spin text-yellow-500" />
        );
      case "failure":
      case "error":
        return <div className="w-4 h-4 rounded-full bg-red-500"></div>;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-500"></div>;
    }
  };

  // Handle GitHub publish
  const handleGitHubPublish = async () => {
    if (!agentState?.files || Object.keys(agentState.files).length === 0) {
      setPublishResult("No files to publish. Create some files first.");
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    try {
      // Call the agent's publishToGitHub tool directly with default parameters
      const response = await fetch("/api/agent/tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "publishToGitHub",
          params: {
            owner: "WebsyteAI", // Default organization
            repo: "wai-1", // Default repository
            commitMessage: "Publish files from Websyte.ai",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "GitHub publishing failed");
      }

      const result = await response.json();
      setPublishResult(
        result.content || "Successfully published files to GitHub repository"
      );

      // Fetch build status after successful publish
      fetchBuildStatus();
    } catch (error) {
      console.error("Error publishing to GitHub:", error);
      setPublishResult(
        `Error publishing to GitHub: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Card className="h-full w-full flex flex-col overflow-hidden shadow-xl rounded-md border border-neutral-300 dark:border-neutral-800 bg-black">
      <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center gap-4 sticky top-0 z-10">
        {/* Left side: Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 flex-shrink-0">
            <FolderOpen size={24} className="text-[#F48120]" />
          </div>
          <div className="truncate">
            <h2 className="font-semibold text-base truncate">
              {workerId}
            </h2>
          </div>
        </div>

        {/* Center: View toggle buttons */}
        <div className="flex-1 flex flex-wrap justify-center items-center gap-2">
          <Button
            variant={viewMode === "list" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="flex items-center gap-2 sm:gap-1 text-xs sm:text-sm"
          >
            <ListBullets size={16} />
            <span className="hidden sm:inline">List View</span>
          </Button>
          <Button
            variant={viewMode === "graph" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setViewMode("graph")}
            className="flex items-center gap-2 sm:gap-1 text-xs sm:text-sm"
          >
            <Graph size={16} />
            <span className="hidden sm:inline">Dependency Graph</span>
          </Button>
          <Button
            variant={viewMode === "board" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setViewMode("board")}
            className="flex items-center gap-2 sm:gap-1 text-xs sm:text-sm"
          >
            <FlowArrow size={16} />
            <span className="hidden sm:inline">Prompt Flow</span>
          </Button>
        </div>

        {/* Right side: Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Close button for mobile */}
          {onToggle && (
            <>
              <Button
                variant="ghost"
                size="sm"
                shape="square"
                className="rounded-full h-9 w-9 md:hidden"
                onClick={onToggle}
              >
                <X size={20} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                shape="square"
                className="rounded-full h-9 w-9 md:hidden"
                onClick={onToggle}
              >
                <ArrowsHorizontal size={20} />
              </Button>
            </>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="h-9 w-9"
              disabled={isFetchingStatus}
              onClick={fetchBuildStatus}
              title="Fetch build status"
            >
              <ArrowClockwise
                size={18}
                className={isFetchingStatus ? "animate-spin" : ""}
              />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              shape="square"
              className="h-9 w-9"
              disabled={isPublishing || fileCount === 0}
              onClick={handleGitHubPublish}
              title="Publish to GitHub"
            >
              <GithubLogo size={18} />
            </Button>
          </div>
        </div>
      </div>

      {publishResult && (
        <div
          className={`p-2 text-sm ${publishResult.includes("Error") ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"}`}
        >
          {publishResult}
        </div>
      )}

      {statusError && (
        <div className="p-2 text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          {statusError}
        </div>
      )}

      {/* Cloudflare Worker Configuration section is hidden to prevent sensitive values from being displayed */}

      {/* Build status panel removed - now displayed in commit timeline tooltips */}

      <div className="flex-1 overflow-auto px-0">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-6 w-6 border-2 border-[#F48120] border-t-transparent rounded-full"></div>
          </div>
        ) : agentState?.files && Object.keys(agentState.files).length > 0 ? (
          <ViewModeManager
            files={agentState.files}
            viewMode={viewMode}
            agentState={agentState}
            onUpdateAgentState={onUpdateAgentState}
            onSendToAgent={onSendToAgent}
          />
        ) : (
          <div className="text-center text-neutral-500 p-4 text-base">
            No files available
          </div>
        )}
      </div>
    </Card>
  );
}
