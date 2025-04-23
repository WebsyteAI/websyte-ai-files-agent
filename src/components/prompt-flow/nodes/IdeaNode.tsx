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
    <div className="px-4 py-3 rounded-lg shadow-md bg-gradient-to-r from-blue-500 to-purple-500 text-white min-w-[200px] max-w-[300px]">
      <div className="font-bold text-lg mb-2">Main Idea</div>
      <div className="text-sm">{data.label}</div>
      
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
