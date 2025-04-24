import React, { useState, useEffect } from 'react';
import { Button } from '@/components/button/Button';
import { X, Plus } from '@phosphor-icons/react';
import { ScrollArea } from '@/components/scroll-area';
import { PromptFlowBoard } from './PromptFlowBoard';
import type { PromptFlow, AgentTask } from './utils/prompt-flow-utils';
import { generateTaskId } from './utils/prompt-flow-utils';

interface PromptFlowPanelProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  agentState: any | null;
  onUpdateAgentState: (newState: any) => void;
  isMobile: boolean;
}

export function PromptFlowPanel({
  isOpen,
  setIsOpen,
  agentState,
  onUpdateAgentState,
  isMobile
}: PromptFlowPanelProps) {
  // Initialize prompt flow from agent state or create a new one
  const [promptFlow, setPromptFlow] = useState<PromptFlow>(() => {
    if (agentState?.promptFlow) {
      return agentState.promptFlow;
    }
    
    return {
      mainIdea: 'My AI Agent',
      tasks: [],
    };
  });
  
  // Update local state when agent state changes
  useEffect(() => {
    if (agentState?.promptFlow) {
      setPromptFlow(agentState.promptFlow);
    }
  }, [agentState]);
  
  // Handle prompt flow changes
  const handlePromptFlowChange = async (updatedFlow: PromptFlow) => {
    // Update local UI state immediately for responsiveness
    setPromptFlow(updatedFlow);
    
    try {
      // Update the agent state using the updatePromptFlow tool
      const response = await fetch('/api/agent/tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'updatePromptFlow',
          params: {
            promptFlow: updatedFlow
          }
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update prompt flow in agent state');
      }
      
      // Also update the local agent state for immediate UI feedback
      onUpdateAgentState({
        ...agentState,
        promptFlow: updatedFlow,
      });
    } catch (error) {
      console.error('Error updating prompt flow:', error);
    }
  };
  
  // Handle new idea input
  const handleNewIdeaSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const idea = formData.get('idea') as string;
    
    if (idea) {
      // Update the main idea
      handlePromptFlowChange({
        ...promptFlow,
        mainIdea: idea,
      });
      
      // Reset the form
      e.currentTarget.reset();
    }
  };
  
  // Handle AI prompt splitting
  const handleSplitPrompt = async () => {
    if (!promptFlow.mainIdea) return;
    
    try {
      // Call the AI to split the prompt using the agent's tool
      const response = await fetch('/api/agent/tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'splitAgentPrompt',
          params: {
            prompt: promptFlow.mainIdea,
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to split prompt');
      }
      
      const result = await response.json();
      
      // Create tasks from the split prompt
      if (result && result.tasks && Array.isArray(result.tasks)) {
        const tasks: AgentTask[] = result.tasks.map((task: any) => ({
          id: generateTaskId(),
          title: task.title,
          description: task.description,
          category: task.category,
          status: 'todo',
          dependencies: [],
        }));
        
        // Create a new prompt flow with the tasks
        const updatedFlow: PromptFlow = {
          ...promptFlow,
          tasks,
        };
        
        // Update the prompt flow in the UI
        setPromptFlow(updatedFlow);
        
        // Update the agent state using the updatePromptFlow tool
        const updateResponse = await fetch('/api/agent/tool', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool: 'updatePromptFlow',
            params: {
              promptFlow: updatedFlow
            }
          }),
        });
        
        if (!updateResponse.ok) {
          console.error('Failed to update prompt flow in agent state');
        }
        
        // Also update the local agent state for immediate UI feedback
        onUpdateAgentState({
          ...agentState,
          promptFlow: updatedFlow,
        });
      } else {
        console.error('Invalid response format from splitAgentPrompt tool');
        // Create a default task as fallback
        const defaultTasks: AgentTask[] = [
          {
            id: generateTaskId(),
            title: 'Define Agent Core Functionality',
            description: 'Implement the main agent class with core methods for handling requests and maintaining state.',
            category: 'core',
            status: 'todo',
            dependencies: [],
          },
          {
            id: generateTaskId(),
            title: 'Implement State Management',
            description: 'Create state persistence and retrieval mechanisms for the agent to maintain context across sessions.',
            category: 'state',
            status: 'todo',
            dependencies: [],
          },
          {
            id: generateTaskId(),
            title: 'Add Tool Integration Framework',
            description: 'Build a system for the agent to discover, access, and use external tools and APIs.',
            category: 'tools',
            status: 'todo',
            dependencies: [],
          }
        ];
        
        // Create a new prompt flow with the default tasks
        const updatedFlow: PromptFlow = {
          ...promptFlow,
          tasks: defaultTasks,
        };
        
        // Update the prompt flow in the UI
        setPromptFlow(updatedFlow);
        
        // Update the agent state using the updatePromptFlow tool
        const updateResponse = await fetch('/api/agent/tool', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool: 'updatePromptFlow',
            params: {
              promptFlow: updatedFlow
            }
          }),
        });
        
        if (!updateResponse.ok) {
          console.error('Failed to update prompt flow in agent state');
        }
        
        // Also update the local agent state for immediate UI feedback
        onUpdateAgentState({
          ...agentState,
          promptFlow: updatedFlow,
        });
      }
    } catch (error) {
      console.error('Error splitting prompt:', error);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className={`
      ${isMobile ? 'fixed inset-0 z-50 bg-background' : 'h-full flex flex-col'}
    `}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-base">Agent Prompt Flow</h2>
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className="rounded-full h-9 w-9"
          onClick={() => setIsOpen(false)}
        >
          <X size={20} />
        </Button>
      </div>
      
      <div className="p-4 border-b">
        <form onSubmit={handleNewIdeaSubmit} className="flex flex-col gap-2">
          <label htmlFor="idea" className="text-sm font-medium">
            Main Idea
          </label>
          <div className="flex gap-2">
            <input
              id="idea"
              name="idea"
              type="text"
              className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-background"
              placeholder="Describe your AI agent idea"
              defaultValue={promptFlow.mainIdea}
            />
            <Button type="submit" variant="secondary" size="sm">
              Update
            </Button>
          </div>
        </form>
        
        <div className="mt-4 flex justify-between">
          <Button 
            variant="primary" 
            size="sm"
            onClick={handleSplitPrompt}
            disabled={!promptFlow.mainIdea}
          >
            <Plus size={16} className="mr-1" />
            Auto-Split Prompt
          </Button>
          
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {promptFlow.tasks.length} tasks
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="h-[600px] p-4">
            <PromptFlowBoard
              promptFlow={promptFlow}
              onPromptFlowChange={handlePromptFlowChange}
              className="h-full"
            />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
