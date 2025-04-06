import { useEffect, useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { Message } from "@ai-sdk/react";
import { APPROVAL } from "../server/shared";
import type { tools } from "../server/tools";

// Component imports
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Input } from "@/components/input/Input";
import { Avatar } from "@/components/avatar/Avatar";
import { Toggle } from "@/components/toggle/Toggle";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/tooltip";
import { StoragePanel } from "@/components/storage-panel/StoragePanel";
import { CommitTimeline } from "@/components/commit-timeline/CommitTimeline";

// Icon imports
import {
  Bug,
  Moon,
  PaperPlaneRight,
  Robot,
  Sun,
  Trash,
  ArrowsHorizontal,
} from "@phosphor-icons/react";

// List of tools that require human confirmation
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation",
];

export default function Chat() {
  // Always use dark mode
  const [theme] = useState<"dark">("dark");
  const [showDebug, setShowDebug] = useState(false);
  const [showStoragePanel, setShowStoragePanel] = useState(true);
  const [agentState, setAgentState] = useState<any | null>(null); // Add state for agent state
  const [agentStateLoading, setAgentStateLoading] = useState(true); // Add loading state
  const [commitHistory, setCommitHistory] = useState<any | undefined>(undefined);
  const [commitHistoryLoading, setCommitHistoryLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Always apply dark mode
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);

  // Scroll to bottom on mount
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);


  // Generate or get worker ID from query params and update URL if needed
  const [workerId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('worker');
    
    // If valid worker ID exists in URL, use it
    if (idParam?.startsWith('wai-')) {
      return idParam;
    }
    
    // Otherwise generate a new one and update URL
    // Create a shorter ID by taking first 8 chars of UUID
    const newId = `wai-${crypto.randomUUID().split('-')[0]}`;
    const url = new URL(window.location.href);
    url.searchParams.set('worker', newId);
    window.history.replaceState({}, '', url);
    return newId;
  });

  // Update useAgent hook to include name and onStateUpdate
  const agent = useAgent({
    agent: "chat",
    name: workerId, // Set agent name to the worker ID
    onStateUpdate: (newState: any) => {
      console.log("Agent state updated:", newState);
      setAgentState(newState);
      setAgentStateLoading(false);
    },
  });

  const {
    messages: agentMessages,
    input: agentInput,
    handleInputChange: handleAgentInputChange,
    handleSubmit: handleAgentSubmit,
    addToolResult,
    clearHistory,
  } = useAgentChat({
    agent,
    maxSteps: 5,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    agentMessages.length > 0 && scrollToBottom();
  }, [agentMessages, scrollToBottom]);

  const pendingToolCallConfirmation = agentMessages.some((m: Message) =>
    m.parts?.some(
      (part) =>
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "call" &&
        toolsRequiringConfirmation.includes(
          part.toolInvocation.toolName as keyof typeof tools
        )
    )
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleRemoveTask = async (id: string) => {
    try {
      // Since we can't directly call cancelSchedule, we'll just log it
      console.log(`Request to remove task with ID: ${id}`);
    } catch (error) {
      console.error("Error removing task:", error);
    }
  };

  // Fetch commit history from GitHub
  const fetchCommitHistory = async () => {
    setCommitHistoryLoading(true);
    
    try {
      if (!agentState?.agentName) {
        throw new Error("Agent name is missing in agent state. Cannot fetch commit history.");
      }
      
      // Extract repository info from agent state if available
      const repoInfo = agentState?.commitHistory?.repository?.split('/') || [];
      const owner = repoInfo[0] || 'WebsyteAI'; // Default organization if not in state
      const repo = agentState.agentName; // ALWAYS use agent name as repo name
      const branch = agentState?.commitHistory?.branch || 'main'; // Default branch if not in state
      
      console.log(`Fetching commit history for ${owner}/${repo}/${branch}`);
      
      const response = await fetch('/api/agent/tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'getCommitHistory',
          params: {
            owner,
            repo,
            branch,
            updateAgentState: true, // Update agent state with commit history
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch commit history');
      }
      
      const result = await response.json();
      setCommitHistory(result.content);
    } catch (error) {
      console.error("Error fetching commit history:", error);
    } finally {
      setCommitHistoryLoading(false);
    }
  };

  // Revert to a specific commit
  const revertToCommit = async (sha: string) => {
    try {
      if (!agentState?.agentName) {
        throw new Error("Agent name is missing in agent state. Cannot revert to commit.");
      }
      
      // Extract repository info from agent state if available
      const repoInfo = agentState?.commitHistory?.repository?.split('/') || [];
      const owner = repoInfo[0] || 'WebsyteAI'; // Default organization if not in state
      const repo = agentState.agentName; // ALWAYS use agent name as repo name
      
      console.log(`Reverting to commit ${sha} in ${owner}/${repo}`);
      
      const response = await fetch('/api/agent/tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'revertToCommit',
          params: {
            owner,
            repo,
            commitSha: sha,           // Commit SHA to revert to
            updateAgentState: true, // Update agent state with new files
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to revert to commit');
      }
      
      // Refresh commit history after successful revert
      fetchCommitHistory();
    } catch (error) {
      console.error("Error reverting to commit:", error);
    }
  };

  // Fetch commit history when component mounts
  useEffect(() => {
    if (!commitHistory && !commitHistoryLoading && agentState?.files && Object.keys(agentState.files).length > 0) {
      fetchCommitHistory();
    }
  }, [agentState?.files, commitHistory, commitHistoryLoading]);

  return (
    <div className="h-[100dvh] w-full flex justify-center items-center bg-fixed overflow-hidden">
      <div className="flex flex-col md:flex-row w-full h-[100dvh] md:h-[100dvh] mx-auto md:gap-4 relative">
        {/* Chat Panel */}
        <div className="h-full md:w-1/3 w-full flex-shrink-0 flex flex-col shadow-xl rounded-md overflow-hidden relative border border-neutral-300 dark:border-neutral-800">
          <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center gap-3 sticky top-0 z-10">
            <div className="flex items-center justify-center h-8 w-8">
              <svg
                width="28px"
                height="28px"
                className="text-[#F48120]"
                data-icon="agents"
              >
                <title>Cloudflare Agents</title>
                <symbol id="ai:local:agents" viewBox="0 0 80 79">
                  <path
                    fill="currentColor"
                    d="M69.3 39.7c-3.1 0-5.8 2.1-6.7 5H48.3V34h4.6l4.5-2.5c1.1.8 2.5 1.2 3.9 1.2 3.8 0 7-3.1 7-7s-3.1-7-7-7-7 3.1-7 7c0 .9.2 1.8.5 2.6L51.9 30h-3.5V18.8h-.1c-1.3-1-2.9-1.6-4.5-1.9h-.2c-1.9-.3-3.9-.1-5.8.6-.4.1-.8.3-1.2.5h-.1c-.1.1-.2.1-.3.2-1.7 1-3 2.4-4 4 0 .1-.1.2-.1.2l-.3.6c0 .1-.1.1-.1.2v.1h-.6c-2.9 0-5.7 1.2-7.7 3.2-2.1 2-3.2 4.8-3.2 7.7 0 .7.1 1.4.2 2.1-1.3.9-2.4 2.1-3.2 3.5s-1.2 2.9-1.4 4.5c-.1 1.6.1 3.2.7 4.7s1.5 2.9 2.6 4c-.8 1.8-1.2 3.7-1.1 5.6 0 1.9.5 3.8 1.4 5.6s2.1 3.2 3.6 4.4c1.3 1 2.7 1.7 4.3 2.2v-.1q2.25.75 4.8.6h.1c0 .1.1.1.1.1.9 1.7 2.3 3 4 4 .1.1.2.1.3.2h.1c.4.2.8.4 1.2.5 1.4.6 3 .8 4.5.7.4 0 .8-.1 1.3-.1h.1c1.6-.3 3.1-.9 4.5-1.9V62.9h3.5l3.1 1.7c-.3.8-.5 1.7-.5 2.6 0 3.8 3.1 7 7 7s7-3.1 7-7-3.1-7-7-7c-1.5 0-2.8.5-3.9 1.2l-4.6-2.5h-4.6V48.7h14.3c.9 2.9 3.5 5 6.7 5 3.8 0 7-3.1 7-7s-3.1-7-7-7m-7.9-16.9c1.6 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.4-3 3-3m0 41.4c1.6 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.4-3 3-3M44.3 72c-.4.2-.7.3-1.1.3-.2 0-.4.1-.5.1h-.2c-.9.1-1.7 0-2.6-.3-1-.3-1.9-.9-2.7-1.7-.7-.8-1.3-1.7-1.6-2.7l-.3-1.5v-.7q0-.75.3-1.5c.1-.2.1-.4.2-.7s.3-.6.5-.9c0-.1.1-.1.1-.2.1-.1.1-.2.2-.3s.1-.2.2-.3c0 0 0-.1.1-.1l.6-.6-2.7-3.5c-1.3 1.1-2.3 2.4-2.9 3.9-.2.4-.4.9-.5 1.3v.1c-.1.2-.1.4-.1.6-.3 1.1-.4 2.3-.3 3.4-.3 0-.7 0-1-.1-2.2-.4-4.2-1.5-5.5-3.2-1.4-1.7-2-3.9-1.8-6.1q.15-1.2.6-2.4l.3-.6c.1-.2.2-.4.3-.5 0 0 0-.1.1-.1.4-.7.9-1.3 1.5-1.9 1.6-1.5 3.8-2.3 6-2.3q1.05 0 2.1.3v-4.5c-.7-.1-1.4-.2-2.1-.2-1.8 0-3.5.4-5.2 1.1-.7.3-1.3.6-1.9 1s-1.1.8-1.7 1.3c-.3.2-.5.5-.8.8-.6-.8-1-1.6-1.3-2.6-.2-1-.2-2 0-2.9.2-1 .6-1.9 1.3-2.6.6-.8 1.4-1.4 2.3-1.8l1.8-.9-.7-1.9c-.4-1-.5-2.1-.4-3.1s.5-2.1 1.1-2.9q.9-1.35 2.4-2.1c.9-.5 2-.8 3-.7.5 0 1 .1 1.5.2 1 .2 1.8.7 2.6 1.3s1.4 1.4 1.8 2.3l4.1-1.5c-.9-2-2.3-3.7-4.2-4.9q-.6-.3-.9-.6c.4-.7 1-1.4 1.6-1.9.8-.7 1.8-1.1 2.9-1.3.9-.2 1.7-.1 2.6 0 .4.1.7.2 1.1.3V72zm25-22.3c-1.6 0-3-1.3-3-3 0-1.6 1.3-3 3-3s3 1.3 3 3c0 1.6-1.3 3-3 3"
                  />
                </symbol>
                <use href="#ai:local:agents" />
              </svg>
            </div>

            <div className="flex-1">
              {/* <h2 className="font-semibold text-base">AI Chat Agent</h2> */}
            </div>

            <div className="flex items-center gap-2 mr-2">
              <Bug size={16} />
              <Toggle
                toggled={showDebug}
                aria-label="Toggle debug mode"
                onClick={() => setShowDebug((prev) => !prev)}
              />
            </div>

            <Button
              variant="ghost"
              size="md"
              shape="square"
              className="rounded-full h-9 w-9"
              onClick={() => setShowStoragePanel((prev) => !prev)}
            >
              <ArrowsHorizontal size={20} />
            </Button>


            <Button
              variant="ghost"
              size="md"
              shape="square"
              className="rounded-full h-9 w-9"
              onClick={clearHistory}
            >
              <Trash size={20} />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 max-h-[calc(100vh-10rem)]">
            {agentMessages.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <Card className="p-6 max-w-md mx-auto bg-neutral-100 dark:bg-neutral-900">
                  <div className="text-center space-y-4">
                    <div className="bg-[#F48120]/10 text-[#F48120] rounded-full p-3 inline-flex">
                      <Robot size={24} />
                    </div>
                    <h3 className="font-semibold text-lg">
                      Welcome to AI Chat
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Start a conversation with your AI assistant. Try asking
                      about:
                    </p>
                    <ul className="text-sm text-left space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="text-[#F48120]">•</span>
                        <span>Weather information for any city</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#F48120]">•</span>
                        <span>Local time in different locations</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#F48120]">•</span>
                        <span>Schedule tasks for later</span>
                      </li>
                    </ul>
                  </div>
                </Card>
              </div>
            )}

            {agentMessages.map((m: Message, index) => {
              const isUser = m.role === "user";
              const showAvatar =
                index === 0 || agentMessages[index - 1]?.role !== m.role;
              const showRole = showAvatar && !isUser;

              return (
                <div key={m.id}>
                  {showDebug && (
                    <pre className="text-xs text-muted-foreground overflow-scroll">
                      {JSON.stringify(m, null, 2)}
                    </pre>
                  )}
                  <div
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex gap-2 max-w-[85%] ${
                        isUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {showAvatar && !isUser ? (
                        <Avatar username={"AI"} />
                      ) : (
                        !isUser && <div className="w-8" />
                      )}

                      <div>
                        <div>
                          {m.parts?.map((part, i) => {
                            if (part.type === "text") {
                              return (
                                // biome-ignore lint/suspicious/noArrayIndexKey: it's fine here
                                <div key={i}>
                                  <Card
                                    className={`p-3 rounded-md bg-neutral-100 dark:bg-neutral-900 ${
                                      isUser
                                        ? "rounded-br-none"
                                        : "rounded-bl-none border-assistant-border"
                                    } ${
                                      part.text.startsWith("scheduled message")
                                        ? "border-accent/50"
                                        : ""
                                    } relative`}
                                  >
                                    {part.text.startsWith(
                                      "scheduled message"
                                    ) && (
                                      <span className="absolute -top-3 -left-2 text-base">
                                        🕒
                                      </span>
                                    )}
                                    <ReactMarkdown
                                      components={{
                                        p: ({ children }) => <p className="text-sm">{children}</p>,
                                        a: ({ href, children }) => <a href={href} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                                        code: ({ children }) => <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-xs">{children}</code>,
                                        pre: ({ children }) => <pre className="bg-neutral-200 dark:bg-neutral-800 p-2 rounded my-2 overflow-auto text-xs">{children}</pre>,
                                        ul: ({ children }) => <ul className="list-disc pl-5 my-2">{children}</ul>,
                                        ol: ({ children }) => <ol className="list-decimal pl-5 my-2">{children}</ol>,
                                        li: ({ children }) => <li className="my-1">{children}</li>,
                                        h1: ({ children }) => <h1 className="text-lg font-bold my-2">{children}</h1>,
                                        h2: ({ children }) => <h2 className="text-base font-bold my-2">{children}</h2>,
                                        h3: ({ children }) => <h3 className="text-sm font-bold my-1">{children}</h3>,
                                        blockquote: ({ children }) => <blockquote className="border-l-2 border-neutral-400 pl-2 my-2 italic">{children}</blockquote>,
                                      }}
                                    >
                                      {part.text.replace(
                                        /^scheduled message: /,
                                        ""
                                      )}
                                    </ReactMarkdown>
                                  </Card>
                                  <p
                                    className={`text-xs text-muted-foreground mt-1 ${
                                      isUser ? "text-right" : "text-left"
                                    }`}
                                  >
                                    {formatTime(
                                      new Date(m.createdAt as unknown as string)
                                    )}
                                  </p>
                                </div>
                              );
                            }

                            if (part.type === "tool-invocation") {
                              const toolInvocation = part.toolInvocation;
                              const toolCallId = toolInvocation.toolCallId;

                              if (
                                toolsRequiringConfirmation.includes(
                                  toolInvocation.toolName as keyof typeof tools
                                ) &&
                                toolInvocation.state === "call"
                              ) {
                                return (
                                  <Card
                                    // biome-ignore lint/suspicious/noArrayIndexKey: it's fine here
                                    key={i}
                                    className="p-4 my-3 rounded-md bg-neutral-100 dark:bg-neutral-900"
                                  >
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="bg-[#F48120]/10 p-1.5 rounded-full">
                                        <Robot
                                          size={16}
                                          className="text-[#F48120]"
                                        />
                                      </div>
                                      <h4 className="font-medium">
                                        {toolInvocation.toolName}
                                      </h4>
                                    </div>

                                    <div className="mb-3">
                                      <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                                        Arguments:
                                      </h5>
                                      <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto">
                                        {JSON.stringify(
                                          toolInvocation.args,
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() =>
                                          addToolResult({
                                            toolCallId,
                                            result: APPROVAL.NO,
                                          })
                                        }
                                      >
                                        Reject
                                      </Button>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="primary"
                                              size="sm"
                                              onClick={() =>
                                                addToolResult({
                                                  toolCallId,
                                                  result: APPROVAL.YES,
                                                })
                                              }
                                            >
                                              Approve
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Accept action</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </Card>
                                );
                              }
                              return null;
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) =>
              handleAgentSubmit(e, {
                data: {
                  annotations: {
                    hello: "world",
                  },
                },
              })
            }
            className="p-3 bg-input-background absolute bottom-0 left-0 right-0 z-10 border-t border-neutral-300 dark:border-neutral-800"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  disabled={pendingToolCallConfirmation}
                  placeholder={
                    pendingToolCallConfirmation
                      ? "Please respond to the tool confirmation above..."
                      : "Type your message..."
                  }
                  className="pl-4 pr-10 py-2 w-full rounded-full"
                  value={agentInput}
                  onChange={handleAgentInputChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAgentSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                  onValueChange={undefined}
                />
              </div>

              <Button
                type="submit"
                shape="square"
                className="rounded-full h-10 w-10 flex-shrink-0"
                disabled={pendingToolCallConfirmation || !agentInput.trim()}
              >
                <PaperPlaneRight size={16} />
              </Button>
            </div>
          </form>
        </div>

        {/* Commit Timeline */}
        {showStoragePanel && (
          <>
            {/* Timeline in the middle */}
            <div className="h-full w-[80px] flex-shrink-0 flex flex-col">
              <CommitTimeline 
                commitHistory={commitHistory} 
                loading={commitHistoryLoading} 
                onRefresh={fetchCommitHistory}
                onRevertToCommit={revertToCommit}
              />
            </div>
            
            {/* Storage Panel on the right */}
            <div className="h-full flex-1">
              <StoragePanel 
                agentState={agentState} 
                loading={agentStateLoading} 
                onToggle={() => setShowStoragePanel(false)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
