import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from 'reactflow';
import type { Connection, Edge, NodeTypes } from 'reactflow';
import 'reactflow/dist/style.css';

import { IdeaNode } from './nodes/IdeaNode';
import { TaskNode } from './nodes/TaskNode';
import type { AgentTask, PromptFlow } from './utils/prompt-flow-utils';
import { 
  generateNodes, 
  generateEdges, 
  updateTaskStatus, 
  generateTaskId,
  TASK_CATEGORIES
} from './utils/prompt-flow-utils';

// Define custom node types
const nodeTypes: NodeTypes = {
  ideaNode: IdeaNode,
  taskNode: TaskNode,
};

interface PromptFlowBoardProps {
  promptFlow: PromptFlow;
  onPromptFlowChange: (updatedFlow: PromptFlow) => void;
  className?: string;
}

export function PromptFlowBoard({ 
  promptFlow, 
  onPromptFlowChange,
  className = ''
}: PromptFlowBoardProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  // Initialize nodes and edges from promptFlow
  const [nodes, setNodes, onNodesChange] = useNodesState(
    generateNodes(promptFlow.tasks, promptFlow.mainIdea)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    generateEdges(promptFlow.tasks)
  );
  
  // Update nodes and edges when promptFlow changes
  useEffect(() => {
    setNodes(generateNodes(promptFlow.tasks, promptFlow.mainIdea));
    setEdges(generateEdges(promptFlow.tasks));
  }, [promptFlow, setNodes, setEdges]);
  
  // Handle task status change
  const handleTaskStatusChange = useCallback((taskId: string, newStatus: 'todo' | 'inProgress' | 'done') => {
    const updatedTasks = updateTaskStatus(promptFlow.tasks, taskId, newStatus);
    onPromptFlowChange({
      ...promptFlow,
      tasks: updatedTasks,
    });
  }, [promptFlow, onPromptFlowChange]);
  
  // Handle edge connections
  const onConnect = useCallback(
    (connection: Connection) => {
      // Only allow connections from task nodes to task nodes
      if (connection.source !== 'main-idea' && connection.target !== 'main-idea') {
        // Find the target task
        const targetTask = promptFlow.tasks.find(task => task.id === connection.target);
        const sourceTask = promptFlow.tasks.find(task => task.id === connection.source);
        
        if (targetTask && sourceTask) {
          // Add the source as a dependency to the target
          const updatedTasks = promptFlow.tasks.map(task => {
            if (task.id === targetTask.id) {
              return {
                ...task,
                dependencies: [...task.dependencies, sourceTask.id]
              };
            }
            return task;
          });
          
          onPromptFlowChange({
            ...promptFlow,
            tasks: updatedTasks,
          });
          
          // Add the edge
          setEdges(addEdge(connection, edges));
        }
      } else if (connection.source === 'main-idea') {
        // Allow connections from main idea to tasks
        setEdges(addEdge(connection, edges));
      }
    },
    [promptFlow, onPromptFlowChange, edges, setEdges]
  );
  
  // Column headers for the kanban board
  const renderColumnHeaders = () => {
    return (
      <div className="absolute top-0 left-0 right-0 flex justify-between px-4 py-2 z-10 pointer-events-none">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-t-lg px-4 py-2 font-medium text-sm w-[250px] text-center">
          To Do
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-t-lg px-4 py-2 font-medium text-sm w-[250px] text-center">
          In Progress
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-t-lg px-4 py-2 font-medium text-sm w-[250px] text-center">
          Done
        </div>
      </div>
    );
  };
  
  return (
    <div className={`w-full h-full ${className}`}>
      <ReactFlowProvider>
        <div className="w-full h-full" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            {renderColumnHeaders()}
            <Controls />
            <MiniMap />
            <Background gap={12} size={1} />
            
            {/* Add task button */}
            <Panel position="top-right">
              <button
                className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
                onClick={() => {
                  // Create a new task
                  const newTask: AgentTask = {
                    id: generateTaskId(),
                    title: 'New Task',
                    description: 'Add description here',
                    category: 'core',
                    status: 'todo',
                    dependencies: [],
                  };
                  
                  onPromptFlowChange({
                    ...promptFlow,
                    tasks: [...promptFlow.tasks, newTask],
                  });
                }}
              >
                Add Task
              </button>
            </Panel>
          </ReactFlow>
        </div>
      </ReactFlowProvider>
    </div>
  );
}
