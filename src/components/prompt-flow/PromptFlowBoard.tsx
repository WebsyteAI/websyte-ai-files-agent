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
import type { Connection, Edge, NodeTypes, Node } from 'reactflow';
import 'reactflow/dist/style.css';

import { IdeaNode } from './nodes/IdeaNode';
import { TaskNode } from './nodes/TaskNode';
import { GroupNode } from './nodes/GroupNode';
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
  groupNode: GroupNode,
};

interface PromptFlowBoardProps {
  promptFlow: PromptFlow;
  onPromptFlowChange: (updatedFlow: PromptFlow) => void;
  className?: string;
  onSendToAgent?: (message: string) => void;
}

export function PromptFlowBoard({ 
  promptFlow, 
  onPromptFlowChange,
  className = '',
  onSendToAgent
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
  
  // Handle node position update after dragging
  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    // Skip the main idea node
    if (node.id === 'main-idea') {
      return;
    }
    
    // Find the task in the promptFlow
    const taskIndex = promptFlow.tasks.findIndex(task => task.id === node.id);
    
    if (taskIndex === -1) {
      return;
    }
    
    // Update the task position
    const updatedTasks = [...promptFlow.tasks];
    updatedTasks[taskIndex] = {
      ...updatedTasks[taskIndex],
      position: node.position
    };
    
    // Update the prompt flow
    onPromptFlowChange({
      ...promptFlow,
      tasks: updatedTasks,
    });
  }, [promptFlow, onPromptFlowChange]);
  
  // Handle task deletion
  const handleDeleteTask = useCallback((taskId: string) => {
    // Find the task to delete
    const taskToDelete = promptFlow.tasks.find(task => task.id === taskId);
    
    if (!taskToDelete) {
      return;
    }
    
    // Remove the task from the tasks array
    const updatedTasks = promptFlow.tasks.filter(task => task.id !== taskId);
    
    // If this is a group, also remove all its children
    if (taskToDelete.type === 'group') {
      const childTasks = promptFlow.tasks.filter(task => task.parentId === taskId);
      if (childTasks.length > 0) {
        // Remove all child tasks
        const tasksWithoutChildren = updatedTasks.filter(task => task.parentId !== taskId);
        updatedTasks.splice(0, updatedTasks.length, ...tasksWithoutChildren);
      }
    }
    
    // Update the prompt flow
    onPromptFlowChange({
      ...promptFlow,
      tasks: updatedTasks,
    });
  }, [promptFlow, onPromptFlowChange]);
  
  // Handle sending task to agent
  const handleSendToAgent = useCallback((task: AgentTask) => {
    if (onSendToAgent) {
      // Format the task information as a message
      const message = `Task from Prompt Flow:\n\nTitle: ${task.title}\nCategory: ${task.category}\nDescription: ${task.description}`;
      onSendToAgent(message);
    }
  }, [onSendToAgent]);
  
  // Update nodes and edges when promptFlow changes or filter changes
  useEffect(() => {
    // Filter tasks based on status filter
    const filteredTasks = statusFilter === 'all' 
      ? promptFlow.tasks 
      : promptFlow.tasks.filter(task => task.status === statusFilter);
    
    // Generate nodes with the status change handler
    const newNodes = generateNodes(filteredTasks, promptFlow.mainIdea);
    
    // Add the status change, delete, and send to agent handlers to each task node
    newNodes.forEach(node => {
      if (node.type === 'taskNode') {
        node.data.onStatusChange = handleTaskStatusChange;
        node.data.onDelete = handleDeleteTask;
        node.data.onSendToAgent = handleSendToAgent;
      }
    });
    
    setNodes(newNodes);
    setEdges(generateEdges(filteredTasks));
  }, [promptFlow, statusFilter, setNodes, setEdges, handleTaskStatusChange, handleDeleteTask, handleSendToAgent]);
  
  // Handle edge connections
  const onConnect = useCallback(
    (connection: Connection) => {
      // Find the source and target tasks
      const targetTask = promptFlow.tasks.find(task => task.id === connection.target);
      const sourceTask = promptFlow.tasks.find(task => task.id === connection.source);
      
      // Don't allow connections if either task doesn't exist
      if (!targetTask || !sourceTask) {
        return;
      }
      
      // Case 1: Connection from main idea to any node
      if (connection.source === 'main-idea') {
        // Allow connections from main idea to root-level tasks only
        if (!targetTask.parentId) {
          setEdges(addEdge(connection, edges));
        }
        return;
      }
      
      // Case 2: Connection from a group node to its children
      if (sourceTask.type === 'group' && targetTask.parentId === sourceTask.id) {
        // This is a valid parent-child connection
        setEdges(addEdge(connection, edges));
        return;
      }
      
      // Case 3: Connection between nodes at the same level (both root or both in same group)
      const sourceIsRoot = !sourceTask.parentId;
      const targetIsRoot = !targetTask.parentId;
      
      // Only allow connections between nodes at the same level
      if (sourceIsRoot && targetIsRoot) {
        // Both are root level, allow the connection
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
      } else if (sourceTask.parentId && targetTask.parentId && sourceTask.parentId === targetTask.parentId) {
        // Both are in the same group, but we don't allow connections between siblings
        // as per the user's request to only connect child nodes to their parent
        return;
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
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.4}
            maxZoom={1.2}
            defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
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
              
              {/* Task buttons removed */}
            </Panel>
          </ReactFlow>
        </div>
      </ReactFlowProvider>
    </div>
  );
}
