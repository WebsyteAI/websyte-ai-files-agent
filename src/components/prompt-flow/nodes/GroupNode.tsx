import React, { useState } from "react";
import { Handle, Position } from "reactflow";
import type { AgentTask } from "../utils/prompt-flow-utils";
import { CATEGORY_COLORS } from "../utils/prompt-flow-utils";

interface GroupNodeProps {
  data: {
    task: AgentTask;
    onStatusChange: (newStatus: "todo" | "inProgress" | "done") => void;
  };
  isConnectable: boolean;
}

export function GroupNode({ data, isConnectable }: GroupNodeProps) {
  const { task } = data;
  const [isExpanded, setIsExpanded] = useState(true);

  // Get color based on category
  const categoryColor = CATEGORY_COLORS[task.category];

  // Status badge styles
  const statusStyles = {
    todo: "bg-gray-200 text-gray-800",
    inProgress: "bg-blue-200 text-blue-800",
    done: "bg-green-200 text-green-800",
  };

  return (
    <div className={`group-parent-node`}>
      {/* Kanban column header */}
      <div className="absolute top-0 left-0 right-0 bg-slate-600 dark:bg-slate-700 px-3 py-2 rounded-t-lg shadow-md flex flex-col">
        <div className="flex justify-between items-center">
          <div className="font-bold text-base text-white">{task.title}</div>
        </div>
        <div className="text-xs text-gray-200 mt-1 mb-1">
          {task.description}
        </div>
      </div>

      {/* Top handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-gray-400"
      />

      {/* Bottom handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-gray-400"
      />
    </div>
  );
}
