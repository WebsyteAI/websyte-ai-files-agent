import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { AgentTask } from '../utils/prompt-flow-utils';
import { CATEGORY_COLORS } from '../utils/prompt-flow-utils';
import { X, PaperPlaneTilt } from '@phosphor-icons/react';

interface TaskNodeProps {
  data: {
    task: AgentTask;
    onStatusChange: (newStatus: 'todo' | 'inProgress' | 'done') => void;
    onDelete?: (taskId: string) => void;
    onSendToAgent?: (task: AgentTask) => void;
  };
  isConnectable: boolean;
}

export function TaskNode({ data, isConnectable }: TaskNodeProps) {
  const { task, onStatusChange, onDelete, onSendToAgent } = data;
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get color based on category
  const categoryColor = CATEGORY_COLORS[task.category];
  
  // Status badge styles
  const statusStyles = {
    todo: 'bg-gray-200 text-gray-800',
    inProgress: 'bg-blue-200 text-blue-800',
    done: 'bg-green-200 text-green-800',
  };
  
  return (
    <div 
      className={`px-2 py-2 rounded-lg shadow-md bg-white dark:bg-gray-800 border-l-4 min-w-[180px] max-w-[220px] transition-all duration-200`}
      style={{ 
        borderLeftColor: categoryColor,
        borderTopColor: task.status === 'done' ? '#10b981' : task.status === 'inProgress' ? '#3b82f6' : '#d1d5db',
        borderTopWidth: '2px'
      }}
    >
      {/* Top handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-gray-400"
      />
      
      <div className="flex justify-between items-start">
        <div className="font-medium text-sm dark:text-white">{task.title}</div>
        
        <div className="flex items-center gap-1">
          {/* Send to Agent button */}
          <button
            className="text-blue-500 hover:text-blue-700 rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900"
            onClick={(e) => {
              e.stopPropagation();
              if (onSendToAgent) {
                onSendToAgent(task);
              }
            }}
            title="Send to Agent"
          >
            <PaperPlaneTilt size={12} weight="bold" />
          </button>
          
          {/* Delete button */}
          {onDelete && (
            <button
              className="text-red-500 hover:text-red-700 rounded-full p-0.5 hover:bg-red-100 dark:hover:bg-red-900"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              title="Delete task"
            >
              <X size={12} weight="bold" />
            </button>
          )}
        </div>
      </div>
      
      {/* Toggle description visibility */}
      <button 
        className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-1"
        style={{ fontSize: '0.65rem' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? 'Hide details' : 'Show details'}
      </button>
      
      {/* Description (conditionally rendered) */}
      {isExpanded && (
        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 p-1 bg-gray-100 dark:bg-gray-700 rounded">
          {task.description}
        </div>
      )}
      
      {/* Bottom handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-gray-400"
      />
    </div>
  );
}
