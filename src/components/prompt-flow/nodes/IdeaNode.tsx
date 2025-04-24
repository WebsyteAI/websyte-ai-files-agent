import React from 'react';
import { Handle, Position } from 'reactflow';

interface IdeaNodeProps {
  data: {
    label: string;
  };
  isConnectable: boolean;
}

export function IdeaNode({ data, isConnectable }: IdeaNodeProps) {
  return (
    <div className="px-3 py-2 rounded-lg shadow-md bg-gradient-to-r from-blue-500 to-purple-500 text-white min-w-[180px] max-w-[250px]">
      <div className="font-bold text-sm mb-1">Main Idea</div>
      <div className="text-xs">{data.label}</div>
      
      {/* Bottom handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-white border-2 border-blue-500"
      />
    </div>
  );
}
