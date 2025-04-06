import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/card/Card";
import { Button } from "@/components/button/Button";
import { Input } from "@/components/input/Input";
import { Label } from "@/components/label/Label";
import { FolderOpen, ArrowClockwise, CaretDown, CaretRight, ArrowsHorizontal, GithubLogo, Copy, Check } from "@phosphor-icons/react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { oneDark } from "@codemirror/theme-one-dark";

// CodeMirror component
interface CodeEditorProps {
  code: string;
  filename: string;
}

function CodeEditor({ code, filename }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Clean up previous editor instance
    if (viewRef.current) {
      viewRef.current.destroy();
    }
    
    // Determine language based on file extension
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    let lang = javascript();
    
    if (extension === 'html' || extension === 'htm') {
      lang = html();
    } else if (extension === 'css') {
      lang = css();
    }
    
    // Create editor state
    const state = EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        lang,
        oneDark,
        EditorView.editable.of(false), // Read-only mode
        EditorView.lineWrapping,
      ],
    });
    
    // Create editor view
    const view = new EditorView({
      state,
      parent: editorRef.current,
    });
    
    viewRef.current = view;
    
    return () => {
      view.destroy();
    };
  }, [code, filename]);
  
  return <div ref={editorRef} className="w-full h-full text-xs md:text-sm" />;
}

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

interface StoragePanelProps {
  agentState: AgentState | null;
  loading: boolean;
  onToggle?: () => void;
}

export function StoragePanel({ agentState, loading, onToggle }: StoragePanelProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const initialFetchDone = useRef(false);
  
  // Initialize all files as expanded by default
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    if (agentState?.files) {
      Object.keys(agentState.files).forEach(path => {
        initialState[path] = true;
      });
    }
    return initialState;
  });
  
  // Update expanded files state when new files are added
  useEffect(() => {
    if (agentState?.files) {
      setExpandedFiles(prev => {
        const newState = { ...prev };
        Object.keys(agentState.files!).forEach(path => {
          if (newState[path] === undefined) {
            newState[path] = true; // Set new files to expanded by default
          }
        });
        return newState;
      });
    }
  }, [agentState?.files]);
  
  // Fetch build status from GitHub
  const fetchBuildStatus = async () => {
    setIsFetchingStatus(true);
    setStatusError(null);
    
    try {
      const response = await fetch('/api/agent/tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'getGitHubBuildStatus',
          params: {
            owner: 'WebsyteAI', // Default organization
            repo: 'wai-1',      // Default repository
            ref: 'main',        // Default branch
            updateAgentState: true, // Update agent state with build status
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch build status');
      }
      
      // The result will be stored in agent state automatically
    } catch (error) {
      console.error("Error fetching build status:", error);
      setStatusError(`Error fetching build status: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFetchingStatus(false);
    }
  };
  
  // Fetch build status on component mount
  useEffect(() => {
    // Only fetch if we're not already loading and there are files
    if (!initialFetchDone.current && !loading && agentState?.files && Object.keys(agentState.files).length > 0) {
      fetchBuildStatus();
      initialFetchDone.current = true;
    }
  }, [loading, agentState?.files]);
  
  // Get worker ID directly from URL query parameter
  const [workerId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('worker');
    return idParam?.startsWith('wai-') ? idParam : "";
  });
  
  // Toggle file expansion
  const toggleFileExpansion = (path: string) => {
    setExpandedFiles(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };
  
  // Check if any files are currently streaming
  const hasStreamingFiles = agentState?.files && 
    Object.values(agentState.files).some(file => file.streaming);
  
  // Count the number of files
  const fileCount = agentState?.files ? Object.keys(agentState.files).length : 0;
  
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

  
  // Get status color based on state
  const getStatusColor = (state: string) => {
    switch (state) {
      case 'success':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'failure':
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };
  
  // Get status icon based on state
  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'success':
        return <Check size={16} className="text-green-500" />;
      case 'pending':
        return <ArrowClockwise size={16} className="animate-spin text-yellow-500" />;
      case 'failure':
      case 'error':
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
      const response = await fetch('/api/agent/tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'publishToGitHub',
          params: {
            owner: 'WebsyteAI', // Default organization
            repo: 'wai-1',      // Default repository
            commitMessage: 'Publish files from Websyte.ai',
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'GitHub publishing failed');
      }
      
      const result = await response.json();
      setPublishResult(result.content || 'Successfully published files to GitHub repository');
      
      // Fetch build status after successful publish
      fetchBuildStatus();
    } catch (error) {
      console.error("Error publishing to GitHub:", error);
      setPublishResult(`Error publishing to GitHub: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsPublishing(false);
    }
  };
  

  return (
    <Card className="h-full w-full flex flex-col overflow-hidden shadow-xl rounded-md border border-neutral-300 dark:border-neutral-800 bg-black">
      <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8">
            <FolderOpen size={24} className="text-[#F48120]" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-base">{workerId}</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onToggle && (
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="rounded-full h-9 w-9 md:hidden"
              onClick={onToggle}
            >
              <ArrowsHorizontal size={20} />
            </Button>
          )}
          {hasStreamingFiles && (
            <div className="flex items-center text-[#F48120] mr-2">
              <ArrowClockwise size={18} className="animate-spin mr-1" />
              <span className="text-sm">Streaming...</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
              disabled={isFetchingStatus}
              onClick={fetchBuildStatus}
              title="Fetch build status"
            >
              <ArrowClockwise size={16} className={isFetchingStatus ? "animate-spin" : ""} />
              <span className="hidden md:inline">Status</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex items-center gap-1"
              disabled={isPublishing || fileCount === 0}
              onClick={handleGitHubPublish}
            >
              <GithubLogo size={16} />
              <span>GitHub</span>
            </Button>
          </div>
        </div>
      </div>
      
      {publishResult && (
        <div className={`p-2 text-sm ${publishResult.includes('Error') ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
          {publishResult}
        </div>
      )}
      
      {statusError && (
        <div className="p-2 text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          {statusError}
        </div>
      )}
      
      {/* Cloudflare Worker Configuration section is hidden to prevent sensitive values from being displayed */}
      
      {agentState?.buildStatus && (
        <div className="p-3 border-b border-neutral-300 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Build Status</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={fetchBuildStatus}
              disabled={isFetchingStatus}
            >
              {isFetchingStatus ? (
                <ArrowClockwise size={16} className="animate-spin" />
              ) : (
                <ArrowClockwise size={16} />
              )}
              <span className="ml-1">Refresh</span>
            </Button>
          </div>
          
          <div className="text-xs space-y-1">
            <div className="flex items-center">
              <span className="font-medium mr-2">Repository:</span>
              <span>{agentState.buildStatus.repository}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium mr-2">Branch/Ref:</span>
              <span>{agentState.buildStatus.ref}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium mr-2">Status:</span>
              <span className={`flex items-center ${getStatusColor(agentState.buildStatus.status.state)}`}>
                {getStatusIcon(agentState.buildStatus.status.state)}
                <span className="ml-1 capitalize">{agentState.buildStatus.status.state}</span>
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-medium mr-2">Last Updated:</span>
              <span>{new Date(agentState.buildStatus.timestamp).toLocaleString()}</span>
            </div>
          </div>
          
          {agentState.buildStatus.status.statuses.length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium text-xs mb-1">Status Checks</h4>
              <div className="max-h-32 overflow-y-auto text-xs">
                {agentState.buildStatus.status.statuses.map((status, index) => (
                  <div key={index} className="py-1 border-t border-neutral-200 dark:border-neutral-800 flex items-center">
                    <div className={`mr-2 ${getStatusColor(status.state)}`}>
                      {getStatusIcon(status.state)}
                    </div>
                    <div>
                      <div className="font-medium">{status.context}</div>
                      <div className="text-neutral-500">{status.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {agentState.buildStatus.status.check_runs && agentState.buildStatus.status.check_runs.length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium text-xs mb-1">Check Runs</h4>
              <div className="max-h-32 overflow-y-auto text-xs">
                {agentState.buildStatus.status.check_runs.map((check, index) => (
                  <div key={index} className="py-1 border-t border-neutral-200 dark:border-neutral-800 flex items-center">
                    <div className={`mr-2 ${getStatusColor(check.conclusion || check.status)}`}>
                      {getStatusIcon(check.conclusion || check.status)}
                    </div>
                    <div>
                      <div className="font-medium">{check.name}</div>
                      <div className="text-neutral-500">
                        {check.status === 'completed' 
                          ? `Completed: ${check.conclusion}` 
                          : `Status: ${check.status}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="flex-1 overflow-auto px-0">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-6 w-6 border-2 border-[#F48120] border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div>
            {agentState?.files && Object.keys(agentState.files).length > 0 ? (
              <div>
                {Object.entries(agentState.files).map(([path, fileData]) => (
                  <div key={path} className="border-b border-neutral-300 dark:border-neutral-800">
                    <div 
                      className={`px-4 py-3 text-sm font-semibold flex items-center justify-between cursor-pointer ${fileData.streaming ? 'bg-[#F48120]/10' : ''}`}
                      onClick={() => toggleFileExpansion(path)}
                    >
                      <div className="flex items-center">
                        {expandedFiles[path] ? <CaretDown size={16} className="mr-2" /> : <CaretRight size={16} className="mr-2" />}
                        <span>{path}</span>
                      </div>
                      <div className="flex items-center gap-2">
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
                        {fileData.streaming && (
                          <div className="flex items-center text-[#F48120]">
                            <ArrowClockwise size={16} className="animate-spin mr-1" />
                            <span className="text-sm">Streaming</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {expandedFiles[path] && (
                      <>
                        <div className="px-0">
                          <div className="code-editor bg-neutral-50 dark:bg-neutral-900 overflow-auto border border-neutral-200 dark:border-neutral-800 rounded-sm text-xs md:text-sm">
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
