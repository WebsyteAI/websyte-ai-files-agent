import { memo } from "react";
import { Handle, Position } from "reactflow";
import { 
  FileTs, 
  FileJsx, 
  FileJs, 
  FileCss, 
  FileHtml, 
  File, 
  FileCode
} from "@phosphor-icons/react";

interface FileNodeProps {
  data: {
    label: string;
    path: string;
    modified: string;
    domain: string;
    domainGroup?: string;
    isRecent?: boolean;
    streaming?: boolean;
  };
  isConnectable: boolean;
}

/**
 * Get the appropriate icon based on file extension
 */
const getIconForExtension = (extension: string) => {
  switch (extension.toLowerCase()) {
    case "ts":
    case "tsx":
      return <FileTs size={24} weight="fill" className="text-blue-500" />;
    case "jsx":
      return <FileJsx size={24} weight="fill" className="text-yellow-500" />;
    case "js":
      return <FileJs size={24} weight="fill" className="text-yellow-400" />;
    case "json":
    case "jsonc":
      return <FileCode size={24} weight="fill" className="text-green-500" />;
    case "css":
    case "scss":
    case "sass":
      return <FileCss size={24} weight="fill" className="text-purple-500" />;
    case "html":
      return <FileHtml size={24} weight="fill" className="text-orange-500" />;
    default:
      return <File size={24} weight="fill" className="text-gray-500" />;
  }
};

/**
 * Get color for domain group
 */
const getDomainColor = (domain: string): string => {
  const domainColors: Record<string, string> = {
    models: "bg-blue-100 dark:bg-blue-900",
    services: "bg-green-100 dark:bg-green-900",
    repositories: "bg-purple-100 dark:bg-purple-900",
    controllers: "bg-yellow-100 dark:bg-yellow-900",
    views: "bg-pink-100 dark:bg-pink-900",
    components: "bg-indigo-100 dark:bg-indigo-900",
    utils: "bg-gray-100 dark:bg-gray-900",
    hooks: "bg-teal-100 dark:bg-teal-900",
    contexts: "bg-orange-100 dark:bg-orange-900",
    providers: "bg-red-100 dark:bg-red-900",
  };

  return domainColors[domain] || "bg-gray-100 dark:bg-gray-800";
};

/**
 * Custom node component for files in the dependency graph
 */
const FileNode = memo(({ data, isConnectable, ...props }: FileNodeProps & Record<string, any>) => {
  // Extract file extension to determine icon
  const extension = data.label.split(".").pop() || "";
  
  // Get domain color
  const domainColor = getDomainColor(data.domain);
  
  // Determine if file was recently modified
  const recentClass = data.isRecent 
    ? "border-green-500 dark:border-green-500" 
    : "border-gray-300 dark:border-gray-700";
  
  return (
    <div 
      className={`file-node rounded-md p-2 border-2 ${recentClass} ${domainColor} shadow-sm cursor-pointer hover:shadow-md transition-shadow relative`}
      {...props}
    >
      {/* Status indicator for streaming (editing) */}
      {data.streaming && (
        <span className="absolute top-1 right-1 flex items-center">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse mr-1"></span>
          <span className="text-xs text-blue-500">editing</span>
        </span>
      )}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-gray-400 dark:bg-gray-600"
      />
      
      <div className="flex items-center gap-2">
        <div className="file-icon">
          {getIconForExtension(extension)}
        </div>
        <div className="file-name text-sm font-medium truncate max-w-[120px]">
          {data.label}
        </div>
      </div>
      
      <div className="file-domain text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
        {data.domain}
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-gray-400 dark:bg-gray-600"
      />
    </div>
  );
});

export default FileNode;
