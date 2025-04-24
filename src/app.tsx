import { useEffect, useState, useRef, useCallback } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { Message } from "@ai-sdk/react";
import { APPROVAL } from "../server/shared";
import type { tools } from "../server/tools";

// Component imports
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AppLayout } from "@/components/chat/AppLayout";

// List of tools that require human confirmation
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation",
];

export default function Chat() {
  // Always use dark mode
  const [theme] = useState<"dark">("dark");
  const [showDebug, setShowDebug] = useState(false);
  // Separate states for panel visibility
  const [isTimelineOpen, setIsTimelineOpen] = useState(false); // Combined mobile/desktop state initially false
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = useState(false); // Combined mobile/desktop state initially false
  // No need for isPromptFlowOpen state since the prompt flow is always displayed in the workspace panel
  const [agentState, setAgentState] = useState<any | null>(null); // Add state for agent state
  const [agentStateLoading, setAgentStateLoading] = useState(true); // Add loading state
  const [commitHistoryLoading, setCommitHistoryLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false); // Track if we're on mobile
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Check if we're on mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

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


  // Get worker ID from query params - required parameter
  const [workerId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('worker');
    
    // Worker ID is required
    if (!idParam) {
      // Display error message if worker ID is missing
      throw new Error('Worker ID is required. Please provide a ?worker=YOUR_WORKER_ID parameter in the URL.');
    }
    
    return idParam;
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

  const [isProcessing, setIsProcessing] = useState(false);

  const {
    messages: agentMessages,
    input: agentInput,
    handleInputChange: handleAgentInputChange,
    handleSubmit: handleAgentSubmit,
    addToolResult,
    clearHistory,
    isLoading
  } = useAgentChat({
    agent,
    maxSteps: 10,
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
      
      // No need to set local state, tool updates agent state directly
      // const result = await response.json(); 
      // setCommitHistory(result.content); // REMOVED
    } catch (error) {
      console.error("Error fetching commit history:", error);
      // Optionally set an error state here to display to the user
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
      
      // No automatic refresh after revert - user will use agent to refresh if needed
    } catch (error) {
      console.error("Error reverting to commit:", error);
    }
  };

  // Fetch commit history only once when the app loads and agent state is ready
  useEffect(() => {
    // Only run this effect once when agentState is first loaded
    if (agentState && !agentState.initialCommitHistoryFetched && !commitHistoryLoading) {
      // Set a flag to prevent this effect from running again
      agent.setState({
        ...agentState,
        initialCommitHistoryFetched: true
      });
      
      // We'll fetch commit history only if there are files
      if (agentState.files && Object.keys(agentState.files).length > 0) {
        fetchCommitHistory();
      }
    }
  }, [agentState, commitHistoryLoading, agent]);

  return (
    <AppLayout
      chatPanel={
        <ChatPanel
          showDebug={showDebug}
          setShowDebug={setShowDebug}
          setIsTimelineOpen={setIsTimelineOpen}
          setIsWorkspacePanelOpen={setIsWorkspacePanelOpen}
          setIsPromptFlowOpen={() => {}} // Dummy function since we don't use this anymore
          clearHistory={clearHistory}
          messages={agentMessages}
          addToolResult={addToolResult}
          messagesEndRef={messagesEndRef}
          isLoading={isProcessing || isLoading}
          input={agentInput}
          handleInputChange={handleAgentInputChange}
          handleSubmit={(e, options) => {
            setIsProcessing(true);
            // Use setTimeout to ensure isProcessing is set to false after the message is processed
            handleAgentSubmit(e, options);
            // Set a timeout to turn off the loading state after a short delay
            setTimeout(() => {
              setIsProcessing(false);
            }, 500);
          }}
          pendingToolCallConfirmation={pendingToolCallConfirmation}
        />
      }
      isTimelineOpen={isTimelineOpen}
      setIsTimelineOpen={setIsTimelineOpen}
      isWorkspacePanelOpen={isWorkspacePanelOpen}
      setIsWorkspacePanelOpen={setIsWorkspacePanelOpen}
      isPromptFlowOpen={false} // Dummy value since we don't use this anymore
      setIsPromptFlowOpen={() => {}} // Dummy function since we don't use this anymore
      isMobile={isMobile}
      agentState={agentState}
      agentStateLoading={agentStateLoading}
      commitHistoryLoading={commitHistoryLoading}
      fetchCommitHistory={fetchCommitHistory}
      revertToCommit={revertToCommit}
      onUpdateAgentState={(newState) => {
        console.log("Updating agent state:", newState);
        agent.setState(newState);
      }}
    />
  );
}
