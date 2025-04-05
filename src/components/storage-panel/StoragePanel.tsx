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

// Define the expected state structure
interface AgentState {
  files?: Record<string, FileData>;
  // Add other potential state properties if needed
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
