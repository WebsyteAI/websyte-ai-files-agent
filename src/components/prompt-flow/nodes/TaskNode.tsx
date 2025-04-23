import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { AgentTask } from '../utils/prompt-flow-utils';
import { CATEGORY_COLORS } from '../utils/prompt-flow-utils';

interface TaskNodeProps {
  data: {
    task: AgentTask;
    onStatusChange: (newStatus: 'todo' | 'inProgress' | 'done') => void;
  };
  isConnectable: boolean;
}

export function TaskNode({ data, isConnectable }: TaskNodeProps) {
  const { task, onStatusChange } = data;
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
      className={`px-4 py-3 rounded-lg shadow-md bg-white dark:bg-gray-800 border-l-4 min-w-[250px] max-w-[350px] transition-all duration-200 ${isExpanded ? 'h-auto' : 'h-auto'}`}
      style={{ borderLeftColor: categoryColor }}
    >
      {/* Top handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-gray-400"
      />
      
      <div className="flex justify-between items-start mb-2">
        <div className="font-medium text-base dark:text-white">{task.title}</div>
        <div 
          className={`text-xs px-2 py-0.5 rounded-full ${statusStyles[task.status]}`}
        >
          {task.status === 'todo' ? 'To Do' : task.status === 'inProgress' ? 'In Progress' : 'Done'}
        </div>
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {task.category.charAt(0).toUpperCase() + task.category.slice(1)}
      </div>
      
      {/* Toggle description visibility */}
      <button 
        className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? 'Hide details' : 'Show details'}
      </button>
      
      {/* Description (conditionally rendered) */}
      {isExpanded && (
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
          {task.description}
        </div>
      )}
      
      {/* Status change buttons */}
      <div className="flex justify-between mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          className={`text-xs px-2 py-1 rounded ${
            task.status === 'todo' 
              ? 'bg-gray-300 text-gray-700 cursor-not-allowed' 
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
          onClick={() => task.status !== 'todo' && onStatusChange('todo')}
          disabled={task.status === 'todo'}
        >
          To Do
        </button>
        
        <button
          className={`text-xs px-2 py-1 rounded ${
            task.status === 'inProgress' 
              ? 'bg-blue-300 text-blue-700 cursor-not-allowed' 
              : 'bg-blue-200 hover:bg-blue-300 text-blue-700'
          }`}
          onClick={() => task.status !== 'inProgress' && onStatusChange('inProgress')}
          disabled={task.status === 'inProgress'}
        >
          In Progress
        </button>
        
        <button
          className={`text-xs px-2 py-1 rounded ${
            task.status === 'done' 
              ? 'bg-green-300 text-green-700 cursor-not-allowed' 
              : 'bg-green-200 hover:bg-green-300 text-green-700'
          }`}
          onClick={() => task.status !== 'done' && onStatusChange('done')}
          disabled={task.status === 'done'}
        >
          Done
        </button>
      </div>
      
      {/* Bottom handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-gray-400"
      />
    </div>
  );
}
