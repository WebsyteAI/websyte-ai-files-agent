import { useState } from "react";
import { Card } from "@/components/card/Card";
import { Button } from "@/components/button/Button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/tooltip";
import { 
  ArrowClockwise, 
  GitCommit, 
  ArrowCounterClockwise, 
  CheckCircle, 
  XCircle, 
  Clock,
  Warning,
  Info
} from "@phosphor-icons/react";

interface BuildStatus {
  state: string;
  total_count?: number;
  statuses?: Array<{
    state: string;
    description: string;
    context: string;
    target_url?: string;
    created_at?: string;
    updated_at?: string;
  }>;
}

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    }
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  } | null;
  status?: BuildStatus;
}

interface CommitHistory {
  repository: string;
  branch: string;
  commits: Commit[];
  timestamp: string;
}

interface CommitTimelineProps {
  commitHistory: CommitHistory | undefined;
  loading: boolean;
  onRefresh: () => void;
  onRevertToCommit: (sha: string) => void;
}

export function CommitTimeline({ 
  commitHistory, 
  loading, 
  onRefresh, 
  onRevertToCommit 
}: CommitTimelineProps) {
  const [revertingCommit, setRevertingCommit] = useState<string | null>(null);
  
  // Format date to a readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  // Format time to a readable format
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Truncate commit message if it's too long
  const truncateMessage = (message: string, maxLength = 30) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  // Handle revert to commit
  const handleRevert = (sha: string) => {
    setRevertingCommit(sha);
    onRevertToCommit(sha);
    setTimeout(() => setRevertingCommit(null), 2000);
  };

  // Get build status icon
  const getBuildStatusIcon = (status: BuildStatus | undefined) => {
    if (!status) return <Clock size={12} className="text-yellow-500" />;
    
    switch(status.state.toLowerCase()) {
      case 'success':
        return <CheckCircle size={12} className="text-green-500" />;
      case 'failure':
      case 'error':
        return <XCircle size={12} className="text-red-500" />;
      case 'pending':
        return <Clock size={12} className="text-yellow-500" />;
      default:
        return <Info size={12} className="text-blue-500" />;
    }
  };

  // Get build status text color class
  const getBuildStatusColorClass = (status: BuildStatus | undefined) => {
    if (!status) return 'text-yellow-500';
    
    switch(status.state.toLowerCase()) {
      case 'success':
        return 'text-green-500';
      case 'failure':
      case 'error':
        return 'text-red-500';
      case 'pending':
        return 'text-yellow-500';
      default:
        return 'text-blue-500';
    }
  };

  // Generate build status tooltip content
  const getBuildStatusTooltip = (commit: Commit) => {
    if (!commit.status) return 'Build status: Unknown';
    return `Build status: ${commit.status.state}`;
  };

  // Generate commit tooltip content
  const getCommitTooltip = (commit: Commit) => {
    let content = `${commit.commit.message}\n\n`;
    content += `SHA: ${commit.sha.substring(0, 7)}\n`;
    content += getBuildStatusTooltip(commit);
    
    return content;
  };

  return (
    <Card className="h-full w-full flex flex-col overflow-hidden shadow-xl rounded-md border border-neutral-300 dark:border-neutral-800 bg-black">
      <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-center sticky top-0 z-10">
        <div 
          className="flex items-center justify-center h-8 w-8 cursor-pointer"
          onClick={onRefresh}
        >
          <GitCommit size={24} className={`text-[#F48120] ${loading ? "animate-spin" : ""}`} />
        </div>
      </div>

      <div className="flex-1 h-full flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-muted-foreground">Loading...</div>
          </div>
        ) : !commitHistory?.commits || commitHistory.commits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-2">
            <div className="text-xs text-muted-foreground">No commits</div>
            <Button variant="secondary" size="sm" onClick={onRefresh} className="h-6 text-xs">
              Refresh
            </Button>
          </div>
        ) : (
          <div className="relative py-2 h-full flex flex-col">
            {/* Vertical timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 w-[1px] bg-neutral-300 dark:bg-neutral-700"></div>
            
            {/* Timeline items */}
            <div className="flex flex-col justify-center h-full flex-1 gap-4" style={{ height: "100%" }}>
              {commitHistory.commits.map((commit: Commit, index: number, array: Commit[]) => {
                return (
                  <div key={commit.sha} className="relative flex justify-center py-1">
                    {/* Rectangle node with tooltip */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className={`relative z-10 rounded-md border border-neutral-300 dark:border-neutral-700 h-8 flex items-center justify-between px-2 text-xs 
                              ${getBuildStatusColorClass(commit.status)}
                              bg-neutral-100 dark:bg-neutral-900 cursor-pointer`}
                          >
                            {getBuildStatusIcon(commit.status)}
                            <span className="text-[9px] font-mono ml-1">{formatTime(commit.commit.author.date)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="z-50">
                          <p className="whitespace-pre-line">{getCommitTooltip(commit)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* Revert button in tooltip */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-7 left-1/2 transform -translate-x-1/2 text-xs flex items-center justify-center h-5 w-5 opacity-0 hover:opacity-100"
                            onClick={() => handleRevert(commit.sha)}
                            disabled={revertingCommit === commit.sha}
                          >
                            <ArrowCounterClockwise 
                              size={10} 
                              className={revertingCommit === commit.sha ? "animate-spin" : ""} 
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Revert to this commit</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
