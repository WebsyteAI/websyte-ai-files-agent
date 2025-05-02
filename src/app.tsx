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
      setAgentState(newState);
    },
  });

  const {
    messages: agentMessages,
    input: agentInput,
    handleInputChange: handleAgentInputChange,
    handleSubmit: handleAgentSubmit,
    addToolResult,
    clearHistory,
    isLoading,
    stop,
    error,
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

  // Cancel in-progress message handler
  // Use the built-in stop method from useAgentChat hook
  const handleCancel = () => {
    console.log("Cancel button clicked, using stop() method from hook");
    
    // Stop the agent chat - this will update isLoading state automatically
    stop();
  };

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
            isLoading={isLoading}
            input={agentInput}
            handleInputChange={handleAgentInputChange}
            handleSubmit={(e, options) => {
              // No need to update loading state as it's handled by the hook
              handleAgentSubmit(e, options);
              // We'll let the handleCancel or the completion of the message update isLoading to false
            }}
            pendingToolCallConfirmation={pendingToolCallConfirmation}
            handleCancel={handleCancel}
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
        commitHistoryLoading={commitHistoryLoading}
        revertToCommit={revertToCommit}
        onUpdateAgentState={(newState) => {
          console.log("Updating agent state:", newState);
          agent.setState(newState);
        }}
        onSendToAgent={(message: string) => {
          // Create a synthetic event to pass to handleAgentSubmit
          const syntheticEvent = {
            preventDefault: () => {},
          } as React.FormEvent;
          
          // Set the input value to the message from the task
          handleAgentInputChange({ target: { value: message } } as React.ChangeEvent<HTMLTextAreaElement>);
          
          // Submit the message
          setTimeout(() => {
            // No need to update loading state as it's handled by the hook
            handleAgentSubmit(syntheticEvent);
            // We'll let the handleCancel or the completion of the message update isLoading to false
          }, 100); // Small delay to ensure the input is set
        }}
      />
  );
}
