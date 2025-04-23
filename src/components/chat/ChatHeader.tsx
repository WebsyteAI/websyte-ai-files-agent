import { useState } from "react";
import { Button } from "@/components/button/Button";
import { Toggle } from "@/components/toggle/Toggle";
import { 
  Bug, 
  GitCommit, 
  Trash,
  X
} from "@phosphor-icons/react";

interface ChatHeaderProps {
  showDebug: boolean;
  setShowDebug: React.Dispatch<React.SetStateAction<boolean>>;
  setIsTimelineOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStoragePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPromptFlowOpen: React.Dispatch<React.SetStateAction<boolean>>;
  clearHistory: () => void;
}

export function ChatHeader({
  showDebug,
  setShowDebug,
  setIsTimelineOpen,
  setIsStoragePanelOpen,
  setIsPromptFlowOpen,
  clearHistory
}: ChatHeaderProps) {
  return (
    <div className="py-3 flex items-center gap-3 sticky top-0 z-10 bg-background">
      <div className="flex-1">
        <h2 className="font-semibold text-base">Chat</h2>
      </div>

      <div className="flex items-center gap-2 mr-2">
        <Toggle
          toggled={showDebug}
          aria-label="Toggle debug mode"
          onClick={() => setShowDebug((prev) => !prev)}
        />
      </div>


      <Button
        variant="ghost"
        size="md"
        shape="square"
        className="rounded-full h-9 w-9"
        onClick={() => setIsTimelineOpen((prev) => !prev)}
        title="Toggle Commit History"
      >
        <GitCommit size={20} />
      </Button>


      <Button
        variant="ghost"
        size="md"
        shape="square"
        className="rounded-full h-9 w-9"
        onClick={clearHistory}
        title="Clear Chat History"
      >
        <Trash size={20} />
      </Button>
      
      <Button
        variant="ghost"
        size="md"
        shape="square"
        className="rounded-full h-9 w-9 md:hidden"
        onClick={() => setIsStoragePanelOpen(true)}
        title="Close Chat"
      >
        <X size={20} />
      </Button>
    </div>
  );
}
