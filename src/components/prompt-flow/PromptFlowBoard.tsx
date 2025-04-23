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
import { Button } from '@/components/button/Button';

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
  
  // Add filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'inProgress' | 'done'>('all');
  
  // Initialize nodes and edges from promptFlow
  const [nodes, setNodes, onNodesChange] = useNodesState(
    generateNodes(promptFlow.tasks, promptFlow.mainIdea)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    generateEdges(promptFlow.tasks)
  );
  
  // Handle task status change
  const handleTaskStatusChange = useCallback((taskId: string, newStatus: 'todo' | 'inProgress' | 'done') => {
    const updatedTasks = updateTaskStatus(promptFlow.tasks, taskId, newStatus);
    onPromptFlowChange({
      ...promptFlow,
      tasks: updatedTasks,
    });
  }, [promptFlow, onPromptFlowChange]);
  
  // Update nodes and edges when promptFlow changes or filter changes
  useEffect(() => {
    // Filter tasks based on status filter
    const filteredTasks = statusFilter === 'all' 
      ? promptFlow.tasks 
      : promptFlow.tasks.filter(task => task.status === statusFilter);
    
    // Generate nodes with the status change handler
    const newNodes = generateNodes(filteredTasks, promptFlow.mainIdea);
    
    // Add the status change handler to each task node
    newNodes.forEach(node => {
      if (node.type === 'taskNode') {
        node.data.onStatusChange = handleTaskStatusChange;
      }
    });
    
    setNodes(newNodes);
    setEdges(generateEdges(filteredTasks));
  }, [promptFlow, statusFilter, setNodes, setEdges, handleTaskStatusChange]);
  
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
  
  // Count tasks by status
  const taskCounts = {
    todo: promptFlow.tasks.filter(task => task.status === 'todo').length,
    inProgress: promptFlow.tasks.filter(task => task.status === 'inProgress').length,
    done: promptFlow.tasks.filter(task => task.status === 'done').length,
    all: promptFlow.tasks.length
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
            <Controls />
            <MiniMap />
            <Background gap={12} size={1} />
            
            {/* Filter and Add Task Panel */}
            <Panel position="top-right" className="flex flex-col gap-2">
              {/* Status Filter */}
              <div className="flex gap-1 bg-white dark:bg-gray-800 p-1 rounded-md shadow-sm">
                <Button
                  variant={statusFilter === 'all' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                  className="text-xs"
                >
                  All ({taskCounts.all})
                </Button>
                <Button
                  variant={statusFilter === 'todo' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatusFilter('todo')}
                  className="text-xs"
                >
                  To Do ({taskCounts.todo})
                </Button>
                <Button
                  variant={statusFilter === 'inProgress' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatusFilter('inProgress')}
                  className="text-xs"
                >
                  In Progress ({taskCounts.inProgress})
                </Button>
                <Button
                  variant={statusFilter === 'done' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatusFilter('done')}
                  className="text-xs"
                >
                  Done ({taskCounts.done})
                </Button>
              </div>
              
              {/* Add Task Button */}
              <Button
                variant="primary"
                size="sm"
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
              </Button>
            </Panel>
          </ReactFlow>
        </div>
      </ReactFlowProvider>
    </div>
  );
}
